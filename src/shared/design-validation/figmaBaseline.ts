import fs from 'node:fs';
import path from 'node:path';

// Reads the stored, body-only Figma page JSON written by `npm run design:convert`
// (<program>/design-validation/baseline/pages/...) so design specs take their expected
// values from the Figma data instead of typing them by hand. No program knowledge here.

export interface FigmaTextStyle {
  fontFamily: string;
  fontStyle?: string;
  fontWeight: number;
  fontSize: number;
  lineHeight?: string; // '1.25em'
  letterSpacing?: string;
  textCase?: string;
  textDecoration?: string;
  textAlignHorizontal?: string; // LEFT | CENTER | RIGHT
}

export interface FigmaNode {
  id: string;
  name?: string;
  type: string;
  layout?: {
    mode?: string;
    padding?: string; // '14px 34px'
    gap?: string; // '20px'
    sizing?: { horizontal?: string; vertical?: string };
    dimensions?: { width?: number; height?: number };
  };
  text?: string;
  textStyle?: FigmaTextStyle;
  fills?: string[];
  strokes?: string[];
  strokeWeight?: string;
  borderRadius?: string;
  children?: FigmaNode[];
}

/** Inline text-style overrides ({ts21}...{/ts21}) resolved from _shared-definitions.txt. */
export type StyleOverrides = Record<string, { fontFamily?: string; colour?: string }>;

interface BaselineIndexEntry {
  nodeId: string;
  json: string;
}

export function loadFigmaFrame(baselineDir: string, nodeId: string): FigmaNode {
  const indexPath = path.join(baselineDir, 'pages', 'index.json');
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Figma baseline not found at ${indexPath}. It is gitignored: fetch it first ` +
        '(docs/design-validation.md, "Fetching and storing a section").',
    );
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as BaselineIndexEntry[];
  const entry = index.find((e) => e.nodeId === nodeId);
  if (!entry) throw new Error(`Figma node ${nodeId} is not in ${indexPath}`);
  return JSON.parse(fs.readFileSync(path.join(baselineDir, entry.json), 'utf8')).body as FigmaNode;
}

export function loadStyleOverrides(baselineDir: string): StyleOverrides {
  const file = path.join(baselineDir, 'pages', '_shared-definitions.txt');
  const out: StyleOverrides = {};
  let current: string | null = null;
  let inFills = false;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const head = line.match(/^(ts\d+):\s*$/);
    if (head) {
      current = head[1];
      out[current] = {};
      inFills = false;
      continue;
    }
    if (!current) continue;
    if (!line.startsWith('  ')) {
      current = null;
      continue;
    }
    const family = line.match(/^\s+fontFamily:\s*(.+)$/);
    if (family) out[current].fontFamily = family[1].trim();
    if (/^\s+fills:\s*$/.test(line)) inFills = true;
    const fill = line.match(/^\s+-\s*'?(#[0-9A-Fa-f]{6,8})'?/);
    if (inFills && fill && !out[current].colour) out[current].colour = fill[1].toUpperCase();
  }
  return out;
}

export function findAll(node: FigmaNode, predicate: (n: FigmaNode) => boolean): FigmaNode[] {
  const found: FigmaNode[] = [];
  const visit = (n: FigmaNode): void => {
    if (predicate(n)) found.push(n);
    (n.children ?? []).forEach(visit);
  };
  visit(node);
  return found;
}

export const findFirst = (node: FigmaNode, predicate: (n: FigmaNode) => boolean): FigmaNode => {
  const [first] = findAll(node, predicate);
  if (!first) throw new Error('Figma node not found');
  return first;
};

/** Copy as a user reads it: style markers removed, escaped asterisk restored, whitespace collapsed. */
export function plainText(text: string): string {
  return text
    .replace(/\{\/?ts\d+\}/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\\\*/g, '*')
    .replace(/\\([()])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Colour of the first inline-styled asterisk, e.g. '{ts21}\*{/ts21}' -> '#C80000'. */
export function starColour(text: string, overrides: StyleOverrides): string | undefined {
  const m = text.match(/\{(ts\d+)\}\\\*\{\/ts\d+\}/);
  return m ? overrides[m[1]]?.colour : undefined;
}

/** Font family after applying a whole-text inline override ({tsN}text{/tsN}). */
export function effectiveFamily(node: FigmaNode, overrides: StyleOverrides): string {
  const m = node.text?.match(/^\{(ts\d+)\}/);
  return (m && overrides[m[1]]?.fontFamily) || node.textStyle?.fontFamily || '';
}

/** '14px 34px' -> [top, right, bottom, left] (CSS shorthand rules). */
export function sides(value?: string): [number, number, number, number] {
  const n = (value ?? '0').split(/\s+/).map((v) => parseFloat(v));
  const [t, r = t, b = t, l = r] = n;
  return [t, r, b, l];
}

export const pxValue = (value?: string): number => parseFloat(value ?? '0');

/** '1.25em' -> 125 (Figma stores line-height in em; compare in %). */
export function lineHeightPct(lineHeight?: string): number | undefined {
  if (!lineHeight) return undefined;
  const v = parseFloat(lineHeight);
  return lineHeight.endsWith('%') ? v : Math.round(v * 1000) / 10;
}

const WEIGHT_NAMES: Record<number, string> = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };
export const weightLabel = (w: number | string): string => `${WEIGHT_NAMES[Number(w)] ?? 'Weight'} (${w})`;

export const alignLabel = (a: string): string =>
  ({ left: 'left', start: 'left', center: 'centre', right: 'right', end: 'right' } as Record<string, string>)[a.toLowerCase()] ?? a.toLowerCase();
