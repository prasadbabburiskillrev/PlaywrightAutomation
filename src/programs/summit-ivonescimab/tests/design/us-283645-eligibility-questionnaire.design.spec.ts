import path from 'node:path';
import { BrowserContext, Locator } from '@playwright/test';
import { test } from '../../fixtures';
import { EligibilityPage } from '../../pages/EligibilityPage';
import { checkExact, checkTolerance } from '../../../../shared/design-validation/designCheck';
import {
  FigmaNode, StyleOverrides, findAll, findFirst, loadFigmaFrame, loadStyleOverrides, plainText, pxValue, sides,
  starColour,
} from '../../../../shared/design-validation/figmaBaseline';
import {
  SPACING_TOLERANCE_PX, compareBox, compareText, readBox, readPaintedBackground, readText, rgbToHex,
} from '../../../../shared/design-validation/liveCompare';

// US-283645: Pharmacy path, Eligibility Questionnaire (Bivtuo - Enroll in Co-Pay Assistance), body only
// (sidebar, header and footer excluded), checked at the 1920x1080 frame size. Every expected
// value is read from the stored Figma JSON, not typed here. Two states are compared:
//   Figma "07.01 Bivtuo- Enroll in Co-Pay Assistance- Eligibility Questionnaire" (node 4010:9360)  default
//   Figma "07.02 Bivtuo- Enroll in Co-Pay Assistance- Eligibility Questionnaire" (node 4010:9389)  mandatory errors
//
// Rules: docs/design-validation.md. Font size +/-2px; padding, margin, gap, width, height +/-10px;
// border width +/-1px (no agreed rule); everything else (copy, font, weight, line-height, colours,
// alignment) exact. The page is only read and the empty form is submitted for the error state;
// no answers are entered, so nothing is enrolled.

const PAGE_URL = 'https://portal-pr.trialcard.com/86210/pharmacy/eligibility/';
const BASELINE = path.resolve(__dirname, '../../design-validation/baseline');
const DEFAULT_FRAME = '4010:9360';
const ERROR_FRAME = '4010:9389';

test.use({ viewport: { width: 1920, height: 1080 } });

interface FigmaQuestion {
  name: string;
  instance: FigmaNode;
  label: FigmaNode;
  options: FigmaNode[];
  error?: FigmaNode;
}

// The sidebar is excluded (own story): only the page content is searched.
const content = (body: FigmaNode): FigmaNode => findFirst(body, (n) => n.name === 'Form Fields');

const textChild = (n: FigmaNode, index = 0): FigmaNode | undefined => n.children?.filter((c) => c.type === 'TEXT')[index];

function figmaQuestions(body: FigmaNode): FigmaQuestion[] {
  return findAll(body, (n) => n.type === 'INSTANCE' && n.name === 'Multiple Choice').map((instance) => {
    const label = textChild(instance)!;
    return {
      name: plainText(label.text!).replace(/^\*/, ''),
      instance,
      label,
      options: findAll(instance, (n) => n.type === 'INSTANCE' && n.name === 'Radio Button'),
      error: findAll(instance, (n) => n.name === 'Error Message')[0],
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

test.describe('US-283645: Eligibility Questionnaire page (Pharmacy) - Figma design (1920x1080)', () => {
  // The PR host is slow, so the page is reached once and shared by every test.
  let context: BrowserContext;
  let P: EligibilityPage;
  let overrides: StyleOverrides;
  let defaultBody: FigmaNode;
  let errorBody: FigmaNode;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    overrides = loadStyleOverrides(BASELINE);
    defaultBody = loadFigmaFrame(BASELINE, DEFAULT_FRAME);
    errorBody = loadFigmaFrame(BASELINE, ERROR_FRAME);
    context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    P = new EligibilityPage(await context.newPage());
    await P.openForDesign(PAGE_URL);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  // ---- shared checks, run once per state ----

  async function checkHeading(state: string, frame: FigmaNode): Promise<void> {
    const body = content(frame);
    const heading = findFirst(body, (n) => n.type === 'TEXT' && n.text === 'Patient Eligibility');
    await compareText(`(${state}) Heading "Patient Eligibility"`, heading, P.pageHeading, { overrides });

    const intro = findFirst(body, (n) => n.type === 'TEXT' && /Answer each question/.test(n.text ?? ''));
    const el = `(${state}) Intro text`;
    await compareText(el, intro, P.introText, { overrides, textFrom: P.intro });
    const star = starColour(intro.text!, overrides);
    if (star) checkExact(el, 'Required-field asterisk colour', star, rgbToHex((await readText(P.intro.locator('.required-star'))).colour));

    const page = await readPaintedBackground(P.pageHeading);
    checkExact(`(${state}) Page`, 'Background', frame.fills![0].toUpperCase(), rgbToHex(page));
  }

  async function checkQuestion(state: string, q: FigmaQuestion, live: Locator): Promise<void> {
    const el = `(${state}) Question "${q.name}"`;

    await compareText(`${el} - label`, q.label, P.questionLabel(live), { overrides });
    const star = starColour(q.label.text!, overrides);
    if (star) checkExact(`${el} - required asterisk`, 'Colour', star, rgbToHex((await readText(P.requiredMarker(live).first())).colour));

    checkExact(el, 'Number of options', String(q.options.length), String(await live.locator('.v-radio').count()));
    for (const [j, optionNode] of q.options.entries()) {
      const option = P.option(live, j);
      const text = textChild(optionNode)!;
      const oEl = `${el} - option "${plainText(text.text!)}"`;
      await compareText(`${oEl} - label`, text, P.optionLabel(option), { overrides });
      const circle = optionNode.children!.find((c) => c.type === 'ELLIPSE')!;
      const circleBox = await readBox(P.optionCircle(option));
      checkTolerance(oEl, 'Circle width', circle.layout!.dimensions!.width!, circleBox.width, SPACING_TOLERANCE_PX);
      checkTolerance(oEl, 'Circle height', circle.layout!.dimensions!.height!, circleBox.height, SPACING_TOLERANCE_PX);
      // Circle border colour (Figma #9898A2) is not compared: reading the control's computed colour
      // returns the text colour (#000000), not the ring. Listed as not checked in the report.
    }

    const error = P.questionError(live);
    if (state === 'Errors') {
      if (q.error) {
        const eEl = `${el} - error message`;
        await compareText(eEl, textChild(q.error)!, error, { overrides });
        const icon = q.error.children!.find((c) => c.type === 'IMAGE-SVG')!;
        checkTolerance(eEl, 'Icon + gap before text', icon.layout!.dimensions!.width! + pxValue(q.error.layout?.gap), (await readText(error)).textOffsetLeft, SPACING_TOLERANCE_PX);
      } else {
        checkExact(`${el} - error message`, 'Shown', 'no', (await error.count()) ? 'yes' : 'no');
      }
    } else {
      checkExact(`${el} - error message`, 'Shown', 'no', (await error.count()) ? 'yes' : 'no');
    }
  }

  async function checkQuestions(state: string, frame: FigmaNode): Promise<void> {
    const expected = figmaQuestions(content(frame));
    checkExact(`(${state}) Form`, 'Number of questions', String(expected.length), String(await P.questions.count()));
    if (state === 'Errors') {
      checkExact(`(${state}) Form`, 'Number of question error messages', String(expected.filter((q) => q.error).length), String(await P.questionError(P.page.locator('.eligibility-container')).count()));
    }
    for (const [i, q] of expected.entries()) {
      await checkQuestion(state, q, P.questions.nth(i));
    }
  }

  async function checkButtons(state: string, frame: FigmaNode): Promise<void> {
    const body = content(frame);
    const [back, next] = findAll(body, (n) => n.type === 'INSTANCE' && n.name === 'Buttons');
    for (const [node, live] of [[back, P.backButton], [next, P.submitButton]] as const) {
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
    const gap = pxValue(outer.layout?.gap);

    checkTolerance(el, 'Heading to intro', sides(header.layout?.padding)[2] + sides(formQuestions.layout?.padding)[0], await gapBetween(P.pageHeading, P.intro), SPACING_TOLERANCE_PX);

    const groups = P.questions;
    const count = await groups.count();
    if (state === 'Errors') {
      checkTolerance(el, 'Intro to error summary', gap, await gapBetween(P.intro, P.errorSummary), SPACING_TOLERANCE_PX);
      const banner = findAll(body, (n) => n.name === 'Error Message' && /There are \d+ errors?/.test(textChild(n)?.text ?? ''))[0];
      const text = textChild(banner)!;
      const icon = banner.children!.find((c) => c.type === 'IMAGE-SVG')!;
      await compareText(`(${state}) Error summary`, text, P.errorSummary, { overrides });
      checkTolerance(`(${state}) Error summary`, 'Icon + gap before text', icon.layout!.dimensions!.width! + pxValue(banner.layout?.gap), (await readText(P.errorSummary)).textOffsetLeft, SPACING_TOLERANCE_PX);
      checkTolerance(el, 'Error summary to first question', gap, await gapBetween(P.errorSummary, groups.first()), SPACING_TOLERANCE_PX);
    } else {
      checkTolerance(el, 'Intro to first question', gap, await gapBetween(P.intro, groups.first()), SPACING_TOLERANCE_PX);
    }
    for (let i = 0; i + 1 < count; i++) {
      checkTolerance(el, `Gap between questions ${i + 1} and ${i + 2}`, gap, await gapBetween(groups.nth(i), groups.nth(i + 1)), SPACING_TOLERANCE_PX);
    }

    checkTolerance(el, 'Questions to buttons', pxValue(formQuestions.layout?.gap), await gapBetween(groups.nth(count - 1), P.backButton), SPACING_TOLERANCE_PX);
    const buttonRow = findFirst(body, (n) => n.name === 'Buttons' && n.type === 'FRAME');
    checkTolerance(el, 'Gap between Back and Next', pxValue(buttonRow.layout?.gap), await rowGap(P.backButton, P.submitButton), SPACING_TOLERANCE_PX);
  }

  // ---- default state (07.01) ----

  test('default: heading, intro text and page background', async () => {
    await checkHeading('Default', defaultBody);
  });

  test('default: every question (label, options, radio circles)', async () => {
    await checkQuestions('Default', defaultBody);
  });

  test('default: Back and Next buttons', async () => {
    await checkButtons('Default', defaultBody);
  });

  test('default: layout and spacing', async () => {
    await checkLayout('Default', defaultBody);
  });

  // ---- mandatory-error state (07.02): Next is clicked on the unanswered form (nothing is enrolled) ----

  test('errors: heading, intro text and page background', async () => {
    await P.showMandatoryErrors();
    await checkHeading('Errors', errorBody);
  });

  test('errors: every question and its error message', async () => {
    await P.showMandatoryErrors();
    await checkQuestions('Errors', errorBody);
  });

  test('errors: Back and Next buttons', async () => {
    await P.showMandatoryErrors();
    await checkButtons('Errors', errorBody);
  });

  test('errors: layout, spacing and error summary', async () => {
    await P.showMandatoryErrors();
    await checkLayout('Errors', errorBody);
  });
});
