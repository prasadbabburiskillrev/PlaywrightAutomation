import { Locator } from '@playwright/test';
import { checkExact, checkTolerance } from './designCheck';
import {
  FigmaNode, StyleOverrides, alignLabel, effectiveFamily, lineHeightPct, plainText, pxValue, weightLabel,
} from './figmaBaseline';

// Reads computed styles from the live page and compares them with a Figma node, one recorded
// row per property (see designCheck.ts). Tolerances follow docs/design-validation.md.

export const FONT_SIZE_TOLERANCE_PX = 2;
export const SPACING_TOLERANCE_PX = 10;
/** Border width has no agreed rule; 1px keeps sub-pixel rendering (0.8px vs 1px) from failing. */
export const BORDER_WIDTH_TOLERANCE_PX = 1;

export const rgbToHex = (rgb: string): string => {
  const m = rgb.match(/[\d.]+/g);
  if (!m || m.length < 3) return rgb;
  if (m.length > 3 && Number(m[3]) === 0) return 'transparent';
  const hex = m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase();
  return `#${hex}${m.length > 3 && Number(m[3]) < 1 ? ` @${Math.round(Number(m[3]) * 100)}%` : ''}`;
};

export interface LiveText {
  family: string;
  size: number;
  weight: string;
  lineHeightPct: number | 'normal';
  colour: string;
  align: string;
  letterSpacing: string;
  textTransform: string;
  textDecoration: string;
  text: string;
  /** Distance from the element's left edge to where its text starts (icon + gap). */
  textOffsetLeft: number;
}

// The evaluate callbacks stay free of named inner functions: tsx/esbuild injects a `__name`
// helper into them that does not exist in the page.
export const readText = (locator: Locator): Promise<LiveText> =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize);
    const lh = s.lineHeight === 'normal' ? ('normal' as const) : Math.round((parseFloat(s.lineHeight) / size) * 1000) / 10;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let offset = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.textContent && n.textContent.trim()) {
        const range = document.createRange();
        range.selectNodeContents(n);
        offset = range.getBoundingClientRect().left - el.getBoundingClientRect().left;
        break;
      }
    }
    return {
      family: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      size,
      weight: s.fontWeight,
      lineHeightPct: lh,
      colour: s.color,
      align: s.textAlign,
      letterSpacing: s.letterSpacing,
      textTransform: s.textTransform,
      textDecoration: s.textDecorationLine,
      text: ((el as HTMLElement).innerText || el.textContent || '').trim(),
      textOffsetLeft: Math.round(offset * 10) / 10,
    };
  });

export interface LiveBox {
  bg: string;
  borderColour: string;
  borderWidth: number;
  radius: number;
  padding: [number, number, number, number];
  width: number;
  height: number;
  /** Colour an SVG icon is painted with. */
  iconColour: string;
}

export const readBox = (locator: Locator): Promise<LiveBox> =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const fill = s.fill && s.fill.startsWith('rgb') ? s.fill : s.color;
    return {
      bg: s.backgroundColor,
      borderColour: s.borderTopColor,
      borderWidth: parseFloat(s.borderTopWidth),
      radius: parseFloat(s.borderTopLeftRadius),
      padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat) as [number, number, number, number],
      width: r.width,
      height: r.height,
      iconColour: fill,
    };
  });

/** Background actually painted behind an element (first non-transparent ancestor). */
export const readPaintedBackground = (locator: Locator): Promise<string> =>
  locator.evaluate((el) => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const b = getComputedStyle(e).backgroundColor;
      if (b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b;
    }
    return 'rgba(0, 0, 0, 0)';
  });

export interface TextOptions {
  overrides: StyleOverrides;
  /** Locator whose text is compared with the Figma copy (defaults to the styled element). */
  textFrom?: Locator;
}

/** Compares copy, font, size, weight, line-height, colour, alignment (and spacing/case/decoration when Figma sets them). */
export async function compareText(
  element: string,
  node: FigmaNode,
  live: Locator,
  { overrides, textFrom }: TextOptions,
): Promise<void> {
  const style = node.textStyle;
  if (!style || node.text === undefined) throw new Error(`${element}: Figma node is not a text node`);
  const l = await readText(live);
  const text = textFrom ? (await readText(textFrom)).text : l.text;

  checkExact(element, 'Copy', plainText(node.text), plainText(text));
  checkExact(element, 'Font family', effectiveFamily(node, overrides), l.family);
  checkTolerance(element, 'Font size', style.fontSize, l.size, FONT_SIZE_TOLERANCE_PX);
  checkExact(element, 'Font weight', weightLabel(style.fontWeight), weightLabel(l.weight));
  const expectedLh = lineHeightPct(style.lineHeight);
  if (expectedLh !== undefined) checkExact(element, 'Line-height', `${expectedLh}%`, l.lineHeightPct === 'normal' ? 'normal' : `${l.lineHeightPct}%`);
  const fill = node.fills?.[0];
  if (fill) checkExact(element, 'Text colour', fill.toUpperCase(), rgbToHex(l.colour));
  // A hug-width text box has no space to align within, so Figma's alignment is not visible there.
  const sizing = node.layout?.sizing?.horizontal;
  if (style.textAlignHorizontal && sizing !== 'hug') {
    checkExact(element, 'Alignment', alignLabel(style.textAlignHorizontal), alignLabel(l.align));
  }
  if (style.letterSpacing) checkExact(element, 'Letter-spacing', style.letterSpacing, l.letterSpacing);
  if (style.textCase) checkExact(element, 'Text transform', style.textCase.toLowerCase(), l.textTransform);
  if (style.textDecoration) checkExact(element, 'Text decoration', style.textDecoration.toLowerCase(), l.textDecoration);
}

export interface BoxLive {
  /** Element painting the background / size (defaults to `main`). */
  main: Locator;
  /** Element carrying the border and corner radius (defaults to `main`). */
  border?: Locator;
}

/** Compares fill, border colour/width, corner radius and (when Figma fixes them) width and height. */
export async function compareBox(element: string, node: FigmaNode, live: BoxLive): Promise<LiveBox> {
  const main = await readBox(live.main);
  const border = live.border ? await readBox(live.border) : main;
  const fill = node.fills?.[0];
  // The field itself may be transparent over a white card: compare what is actually painted.
  if (fill) checkExact(element, 'Fill', fill.toUpperCase(), rgbToHex(await readPaintedBackground(live.main)));
  const stroke = node.strokes?.[0];
  if (stroke) {
    checkExact(element, 'Border colour', stroke.toUpperCase(), rgbToHex(border.borderColour));
    checkTolerance(element, 'Border width', pxValue(node.strokeWeight), border.borderWidth, BORDER_WIDTH_TOLERANCE_PX);
  } else {
    checkTolerance(element, 'Border width', 0, border.borderWidth, BORDER_WIDTH_TOLERANCE_PX);
  }
  if (node.borderRadius) checkTolerance(element, 'Corner radius', pxValue(node.borderRadius), border.radius, SPACING_TOLERANCE_PX);
  const dims = node.layout?.dimensions;
  if (dims?.width !== undefined) checkTolerance(element, 'Width', dims.width, main.width, SPACING_TOLERANCE_PX);
  if (dims?.height !== undefined) checkTolerance(element, 'Height', dims.height, main.height, SPACING_TOLERANCE_PX);
  return main;
}
