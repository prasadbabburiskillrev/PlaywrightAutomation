import path from 'node:path';
import { BrowserContext, Locator } from '@playwright/test';
import { test } from '../../fixtures';
import { PatientInformationDesignPage } from '../../pages/PatientInformationDesignPage';
import { checkExact, checkTolerance } from '../../../../shared/design-validation/designCheck';
import {
  FigmaNode, StyleOverrides, findAll, findFirst, loadFigmaFrame, loadStyleOverrides, plainText, pxValue, sides,
  starColour,
} from '../../../../shared/design-validation/figmaBaseline';
import {
  SPACING_TOLERANCE_PX, compareBox, compareText, readBox, readPaintedBackground, readText, rgbToHex,
} from '../../../../shared/design-validation/liveCompare';

// US-280439: Pharmacy path, Patient Information (Bivtuo - Enroll in Co-Pay Assistance), body only
// (sidebar, header and footer excluded), checked at the 1920x1080 frame size. Every expected
// value is read from the stored Figma JSON, not typed here. Two states are compared:
//   Figma "07.04 Bivtuo- Enroll in Co-Pay Assistance- Patient Information" (node 4010:9501)  default
//   Figma "07.05 Bivtuo- Enroll in Co-Pay Assistance- Patient Information" (node 4010:9537)  mandatory errors
//
// Rules: docs/design-validation.md. Font size +/-2px; padding, margin, gap, width, height +/-10px;
// border width +/-1px (no agreed rule); everything else (copy, font, weight, line-height, colours,
// alignment) exact. Vertical field padding is not compared: Figma's 1px is a hug value, while live
// centres the text in a fixed 40px box (the field height is compared instead).
//
// Not compared: the dropdown option list and the field values typed by a user.

const PAGE_URL = 'https://portal-pr.trialcard.com/86064/pharmacy/patient-information/';
const BASELINE = path.resolve(__dirname, '../../design-validation/baseline');
const DEFAULT_FRAME = '4010:9501';
const ERROR_FRAME = '4010:9537';

test.use({ viewport: { width: 1920, height: 1080 } });

interface FigmaField {
  name: string;
  instance: FigmaNode;
  label: FigmaNode;
  input: FigmaNode;
  hint?: FigmaNode;
  icon?: FigmaNode;
  error?: FigmaNode;
}

// The sidebar is excluded (own story): only the page content is searched.
const content = (body: FigmaNode): FigmaNode => findFirst(body, (n) => n.name === 'Form Fields');

const textChild = (n: FigmaNode, index = 0): FigmaNode | undefined => n.children?.filter((c) => c.type === 'TEXT')[index];

function figmaFields(body: FigmaNode): FigmaField[] {
  return findAll(body, (n) => n.type === 'INSTANCE' && !!n.children?.some((c) => c.name === 'Form Field')).map((instance) => {
    const input = instance.children!.find((c) => c.name === 'Form Field')!;
    const label = textChild(instance)!;
    return {
      name: plainText(label.text!).replace(/\*$/, ''),
      instance,
      label,
      input,
      hint: textChild(instance, 1),
      icon: input.children?.find((c) => c.type === 'IMAGE-SVG'),
      error: instance.children!.find((c) => c.name === 'Error Message'),
    };
  });
}

/** Distance between the bottom of `above` and the top of `below`, in px. */
async function gapBetween(above: Locator, below: Locator): Promise<number> {
  const a = await above.boundingBox();
  const b = await below.boundingBox();
  if (!a || !b) throw new Error('element has no bounding box');
  return Math.round((b.y - (a.y + a.height)) * 10) / 10;
}

const rowGap = async (left: Locator, right: Locator): Promise<number> => {
  const a = await left.boundingBox();
  const b = await right.boundingBox();
  if (!a || !b) throw new Error('element has no bounding box');
  return Math.round((b.x - (a.x + a.width)) * 10) / 10;
};

test.describe('US-280439: Patient Information page (Pharmacy) - Figma design (1920x1080)', () => {
  // The QA host is slow, so the page is reached once and shared by every test.
  let context: BrowserContext;
  let P: PatientInformationDesignPage;
  let overrides: StyleOverrides;
  let defaultBody: FigmaNode;
  let errorBody: FigmaNode;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    overrides = loadStyleOverrides(BASELINE);
    defaultBody = loadFigmaFrame(BASELINE, DEFAULT_FRAME);
    errorBody = loadFigmaFrame(BASELINE, ERROR_FRAME);
    context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    P = new PatientInformationDesignPage(await context.newPage());
    await P.open(PAGE_URL);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  // ---- shared checks, run once per state ----

  async function checkHeading(state: string, frame: FigmaNode): Promise<void> {
    const body = content(frame);
    const heading = findFirst(body, (n) => n.type === 'TEXT' && n.text === 'Patient Information');
    await compareText(`(${state}) Heading "Patient Information"`, heading, P.heading, { overrides });

    const intro = findFirst(body, (n) => n.type === 'TEXT' && /Enter the patient/.test(n.text ?? ''));
    const el = `(${state}) Intro text`;
    await compareText(el, intro, P.intro.locator('p').first(), { overrides, textFrom: P.intro });
    const star = starColour(intro.text!, overrides);
    if (star) checkExact(el, 'Required-field asterisk colour', star, rgbToHex((await readText(P.intro.locator('.required-star'))).colour));
    const box = await P.intro.boundingBox();
    const questions = findFirst(body, (n) => n.name === 'Questions' && n.layout?.dimensions?.width !== undefined);
    checkTolerance(el, 'Width', questions.layout!.dimensions!.width!, box!.width, SPACING_TOLERANCE_PX);

    const page = await readPaintedBackground(P.heading);
    checkExact(`(${state}) Page`, 'Background', frame.fills![0].toUpperCase(), rgbToHex(page));
  }

  async function checkField(state: string, f: FigmaField, live: Locator, index: number): Promise<void> {
    const el = `(${state}) Field "${f.name}"`;

    await compareText(`${el} - label`, f.label, P.label(live), { overrides });
    const star = starColour(f.label.text!, overrides);
    const markers = P.requiredMarker(live);
    if (star) {
      checkExact(`${el} - required asterisk`, 'Colour', star, rgbToHex((await readText(markers.first())).colour));
    } else {
      checkExact(`${el} - required asterisk`, 'Shown', 'no', (await markers.count()) ? 'yes' : 'no');
    }

    const slot = P.inputSlot(live);
    await compareBox(`${el} - input`, f.input, { main: slot, border: P.inputBorder(live) });
    const slotBox = await slot.boundingBox();
    const textBox = await P.inputText(live).boundingBox();
    const [, , , padLeft] = sides(f.input.layout?.padding);
    checkTolerance(`${el} - input`, 'Padding (left)', padLeft, Math.round((textBox!.x - slotBox!.x) * 10) / 10, SPACING_TOLERANCE_PX);
    checkTolerance(`${el} - input`, 'Gap label to input', pxValue(f.instance.layout?.gap), await gapBetween(P.label(live), slot), SPACING_TOLERANCE_PX);

    const hint = P.hint(live);
    if (f.hint) {
      await compareText(`${el} - hint`, f.hint, hint, { overrides });
      checkTolerance(`${el} - hint`, 'Gap input to hint', pxValue(f.instance.layout?.gap), await gapBetween(slot, hint), SPACING_TOLERANCE_PX);
    } else {
      checkExact(`${el} - hint`, 'Shown', 'no', (await hint.count()) ? 'yes' : 'no');
    }

    if (f.icon) {
      const icon = /phone/i.test(f.name) ? P.phoneIcon(live) : P.dropdownIcon(live);
      const iconBox = await readBox(icon.first());
      checkTolerance(`${el} - icon`, 'Width', f.icon.layout!.dimensions!.width!, iconBox.width, SPACING_TOLERANCE_PX);
      checkTolerance(`${el} - icon`, 'Height', f.icon.layout!.dimensions!.height!, iconBox.height, SPACING_TOLERANCE_PX);
      if (f.icon.fills?.[0]) checkExact(`${el} - icon`, 'Colour', f.icon.fills[0].toUpperCase(), rgbToHex(iconBox.iconColour));
    }

    const heightFixed = f.instance.layout?.dimensions?.height;
    if (heightFixed !== undefined) {
      checkTolerance(el, 'Field height', heightFixed, (await live.boundingBox())!.height, SPACING_TOLERANCE_PX);
    }

    const error = P.fieldError(live);
    if (state === 'Errors') {
      if (f.error) {
        const text = textChild(f.error)!;
        const icon = f.error.children!.find((c) => c.type === 'IMAGE-SVG')!;
        const eEl = `${el} - error message`;
        await compareText(eEl, text, error, { overrides });
        checkTolerance(eEl, 'Icon + gap before text', icon.layout!.dimensions!.width! + pxValue(f.error.layout?.gap), (await readText(error)).textOffsetLeft, SPACING_TOLERANCE_PX);
        const above = f.hint ? hint : slot;
        checkTolerance(eEl, 'Gap above message', pxValue(f.instance.layout?.gap), await gapBetween(above, error), SPACING_TOLERANCE_PX);
      } else {
        checkExact(`${el} - error message`, 'Shown', 'no', (await error.count()) ? 'yes' : 'no');
      }
    } else {
      checkExact(`${el} - error message`, 'Shown', 'no', (await error.count()) ? 'yes' : 'no');
    }
  }

  async function checkFields(state: string, frame: FigmaNode): Promise<void> {
    const expected = figmaFields(content(frame));
    checkExact(`(${state}) Form`, 'Number of fields', String(expected.length), String(await P.fields.count()));
    if (state === 'Errors') {
      checkExact(`(${state}) Form`, 'Number of field error messages', String(expected.filter((f) => f.error).length), String(await P.fieldError(P.fieldsContainer).count()));
    }
    for (const [i, f] of expected.entries()) {
      await checkField(state, f, P.fields.nth(i), i);
    }
  }

  async function checkButtons(state: string, frame: FigmaNode): Promise<void> {
    const body = content(frame);
    const [back, submit] = findAll(body, (n) => n.type === 'INSTANCE' && n.name === 'Buttons');
    for (const [node, live] of [[back, P.backButton], [submit, P.submitButton]] as const) {
      const label = textChild(node)!;
      const el = `(${state}) "${plainText(label.text!)}" button`;
      const box = await compareBox(el, node, { main: live });
      const [padTop, , , padLeft] = sides(node.layout?.padding);
      checkTolerance(el, 'Padding (vertical)', padTop, box.padding[0], SPACING_TOLERANCE_PX);
      checkTolerance(el, 'Padding (horizontal)', padLeft, box.padding[3], SPACING_TOLERANCE_PX);
      await compareText(`${el} - label`, label, P.buttonLabel(live), { overrides });
    }
  }

  async function checkLayout(state: string, frame: FigmaNode): Promise<void> {
    const body = content(frame);
    const el = `(${state}) Layout`;
    const outer = findFirst(body, (n) => n.name === 'Questions' && n.layout?.dimensions?.width !== undefined);
    const formQuestions = findFirst(body, (n) => n.name === 'Form Questions');
    const header = findFirst(body, (n) => n.name === 'Header');

    checkTolerance(el, 'Content width', outer.layout!.dimensions!.width!, (await P.questions.boundingBox())!.width, SPACING_TOLERANCE_PX);
    checkTolerance(el, 'Heading to intro', sides(header.layout?.padding)[2] + sides(formQuestions.layout?.padding)[0], await gapBetween(P.heading, P.intro), SPACING_TOLERANCE_PX);

    const gap = pxValue(outer.layout?.gap);
    if (state === 'Errors') {
      checkTolerance(el, 'Intro to error summary', gap, await gapBetween(P.intro, P.errorSummary), SPACING_TOLERANCE_PX);
      checkTolerance(el, 'Error summary to first field', gap, await gapBetween(P.errorSummary, P.fieldsContainer), SPACING_TOLERANCE_PX);
      const banner = findAll(body, (n) => n.name === 'Error Message' && /There are \d+ errors/.test(textChild(n)?.text ?? ''))[0];
      const text = textChild(banner)!;
      const icon = banner.children!.find((c) => c.type === 'IMAGE-SVG')!;
      await compareText(`(${state}) Error summary`, text, P.errorSummary, { overrides });
      checkTolerance(`(${state}) Error summary`, 'Icon + gap before text', icon.layout!.dimensions!.width! + pxValue(banner.layout?.gap), (await readText(P.errorSummary)).textOffsetLeft, SPACING_TOLERANCE_PX);
    } else {
      checkTolerance(el, 'Intro to first field', gap, await gapBetween(P.intro, P.fieldsContainer), SPACING_TOLERANCE_PX);
    }

    const rows = P.fieldsContainer.locator('> *');
    const rowCount = await rows.count();
    const groups = findAll(body, (n) => n.name === 'Form Field Group');
    const fieldGap = pxValue(findAll(body, (n) => n.name === 'Questions' && n.layout?.dimensions?.width !== undefined)[1]?.layout?.gap ?? outer.layout?.gap);
    for (let i = 0; i + 1 < rowCount; i++) {
      checkTolerance(el, `Gap between field rows ${i + 1} and ${i + 2}`, fieldGap, await gapBetween(rows.nth(i), rows.nth(i + 1)), SPACING_TOLERANCE_PX);
    }

    for (const [i, group] of groups.entries()) {
      const liveRow = P.fieldsContainer.locator('.field-row').nth(i);
      const cols = liveRow.locator('> .field');
      const n = await cols.count();
      const groupGap = pxValue(group.layout?.gap);
      const colWidth = (outer.layout!.dimensions!.width! - groupGap * (n - 1)) / n;
      for (let c = 0; c < n; c++) {
        checkTolerance(el, `Row ${i + 1} column ${c + 1} width`, Math.round(colWidth * 10) / 10, (await cols.nth(c).boundingBox())!.width, SPACING_TOLERANCE_PX);
        if (c > 0) checkTolerance(el, `Row ${i + 1} gap between columns ${c} and ${c + 1}`, groupGap, await rowGap(cols.nth(c - 1), cols.nth(c)), SPACING_TOLERANCE_PX);
      }
    }

    checkTolerance(el, 'Fields to buttons', pxValue(formQuestions.layout?.gap), await gapBetween(P.fieldsContainer, P.buttonsContainer), SPACING_TOLERANCE_PX);
    const buttonRow = findFirst(body, (n) => n.name === 'Buttons' && n.type === 'FRAME');
    checkTolerance(el, 'Gap between Back and Submit', pxValue(buttonRow.layout?.gap), await rowGap(P.backButton, P.submitButton), SPACING_TOLERANCE_PX);
  }

  // ---- default state (07.04) ----

  test('default: heading, intro text and page background', async () => {
    await checkHeading('Default', defaultBody);
  });

  test('default: every form field (label, input, hint, icon)', async () => {
    await checkFields('Default', defaultBody);
  });

  test('default: Back and Submit buttons', async () => {
    await checkButtons('Default', defaultBody);
  });

  test('default: layout and spacing', async () => {
    await checkLayout('Default', defaultBody);
  });

  // ---- mandatory-error state (07.05): the empty form is submitted (nothing is enrolled) ----

  test('errors: heading, intro text and page background', async () => {
    await P.showMandatoryErrors();
    await checkHeading('Errors', errorBody);
  });

  test('errors: every form field and its error message', async () => {
    await P.showMandatoryErrors();
    await checkFields('Errors', errorBody);
  });

  test('errors: Back and Submit buttons', async () => {
    await P.showMandatoryErrors();
    await checkButtons('Errors', errorBody);
  });

  test('errors: layout, spacing and error summary', async () => {
    await P.showMandatoryErrors();
    await checkLayout('Errors', errorBody);
  });
});
