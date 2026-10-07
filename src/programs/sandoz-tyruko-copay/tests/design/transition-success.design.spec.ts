import { test, expect } from '../../fixtures';
import { Browser, BrowserContext, Locator } from '@playwright/test';
import { config } from '../../config';
import { checkExact, checkTolerance } from '../../../../shared/design-validation/designCheck';
import { LandingPage } from '../../pages/LandingPage';
import { TransitionSuccessPage } from '../../pages/TransitionSuccessPage';

// Figma "05.10 Tyruko- Apply to Patient Transition- Success" (node 28570:12184),
// body only (header/footer excluded), checked at the 1920x1080 frame size.
// Project tolerances: padding/margin/gap +/-10px, font size +/-2px. Everything
// else (colour, weight, line-height %, copy) must match exactly.
const SPACING_TOLERANCE_PX = 10;
const FONT_SIZE_TOLERANCE_PX = 2;

test.use({ viewport: { width: 1920, height: 1080 } });

interface Computed {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  lineHeightPct: number;
  color: string;
  background: string;
  textAlign: string;
  padding: number[];
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
}

const computed = (locator: Locator): Promise<Computed> =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el);
    const px = (v: string) => parseFloat(v);
    return {
      fontFamily: s.fontFamily,
      fontSize: px(s.fontSize),
      fontWeight: s.fontWeight,
      // Figma specifies line-height in %, so compare in % (not px).
      lineHeightPct: Math.round((px(s.lineHeight) / px(s.fontSize)) * 1000) / 10,
      color: s.color,
      background: s.backgroundColor,
      textAlign: s.textAlign,
      padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px),
      borderRadius: px(s.borderTopLeftRadius),
      borderWidth: px(s.borderTopWidth),
      borderColor: s.borderTopColor,
    };
  });

const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  if (!b) throw new Error('element has no bounding box');
  return b;
};

const rgbToHex = (rgb: string): string => {
  const m = rgb.match(/\d+/g);
  return m ? '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase() : rgb;
};

test.describe('Patient Transition Success page - Figma design (1920x1080)', () => {
  // The QA host is slow (a full run of the flow can take well over a minute), so the
  // page is reached once and shared by every test, as in patient-info-visual-styling.
  let context: BrowserContext;
  let p: TransitionSuccessPage;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    test.setTimeout(300_000);
    context = await browser.newContext({ baseURL: config.baseURL, viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    const landingPage = new LandingPage(page);
    p = new TransitionSuccessPage(page);
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'transitionProgram');
    await landingPage.goNext();
    await p.gotoDirect();
    await p.expectVisible();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('shows the Figma copy and both action buttons', async () => {
    await expect(p.processingNote).toHaveText('Your application will be processed within four (4) weeks.');
    await expect(p.contactNote).toContainText(
      'For status updates or more information, please contact Tyruko Patient Support Program at 1-855-4TYRUKO (1-855-489-7856, Option 2), Monday through Friday, 8AM - 8PM ET.',
    );
    await expect(p.downloadSummaryButton).toBeVisible();
    await expect(p.completeAnotherServiceButton).toBeVisible();
    await expect(p.programDisclaimer).toContainText('one-time reimbursement of costs to patients who transition from Tysabri');
    await expect(p.programDisclaimer).toContainText('$650.00 pre-loaded debit card');
    await expect(p.programDisclaimer).toContainText('without further notice.');
    await expect(p.prescribingInfoLine).toContainText(
      'Please see full Prescribing Information, including the Boxed Warning and Medication Guide, for TYRUKO.',
    );
  });

  test('heading: Jost Bold 42px, line-height 100%, centred, navy', async () => {
    const el = 'Heading "Thank you!"';
    const h = await computed(p.heading);
    checkExact(el, 'Font family', 'Jost', h.fontFamily.includes('Jost') ? 'Jost' : h.fontFamily);
    checkTolerance(el, 'Font size', 42, h.fontSize, FONT_SIZE_TOLERANCE_PX);
    checkExact(el, 'Font weight', 'Bold (700)', h.fontWeight === '700' ? 'Bold (700)' : h.fontWeight);
    checkExact(el, 'Line-height', '100%', `${h.lineHeightPct}%`);
    checkExact(el, 'Text colour', '#001C4A', rgbToHex(h.color));
    checkExact(el, 'Alignment', 'centre', h.textAlign === 'center' ? 'centre' : h.textAlign);
  });

  test('paragraphs: Jost Medium 18px, line-height 150%, centred, 800px wide', async () => {
    for (const [el, para] of [['Paragraph 1', p.processingNote], ['Paragraph 2', p.contactNote]] as const) {
      const s = await computed(para);
      checkTolerance(el, 'Font size', 18, s.fontSize, FONT_SIZE_TOLERANCE_PX);
      checkExact(el, 'Font weight', 'Medium (500)', s.fontWeight === '500' ? 'Medium (500)' : s.fontWeight);
      checkExact(el, 'Line-height', '150%', `${s.lineHeightPct}%`);
      checkExact(el, 'Text colour', '#001C4A', rgbToHex(s.color));
      checkExact(el, 'Alignment', 'centre', s.textAlign === 'center' ? 'centre' : s.textAlign);
      checkTolerance(el, 'Width', 800, (await box(para)).width, SPACING_TOLERANCE_PX);
    }
  });

  test('buttons: 14px 34px padding, 2px radius, Jost Medium 18px, 20px apart', async () => {
    const buttons = [
      ['"Download Summary" button', p.downloadSummaryButton, '#001C4A'],
      ['"Complete Another Service" button', p.completeAnotherServiceButton, '#1C59B5'],
    ] as const;
    for (const [el, button, fill] of buttons) {
      const s = await computed(button);
      checkExact(el, 'Fill', fill, rgbToHex(s.background));
      checkExact(el, 'Text colour', '#FFFFFF', rgbToHex(s.color));
      checkExact(el, 'Font weight', 'Medium (500)', s.fontWeight === '500' ? 'Medium (500)' : s.fontWeight);
      checkExact(el, 'Line-height', '100%', `${s.lineHeightPct}%`);
      checkTolerance(el, 'Font size', 18, s.fontSize, FONT_SIZE_TOLERANCE_PX);
      checkTolerance(el, 'Padding (vertical)', 14, s.padding[0], SPACING_TOLERANCE_PX);
      checkTolerance(el, 'Padding (horizontal)', 34, s.padding[1], SPACING_TOLERANCE_PX);
      checkTolerance(el, 'Corner radius', 2, s.borderRadius, SPACING_TOLERANCE_PX);
    }
    const first = await box(p.downloadSummaryButton);
    const second = await box(p.completeAnotherServiceButton);
    checkTolerance('"Download Summary" button', 'Width', 278, first.width, SPACING_TOLERANCE_PX);
    checkTolerance('Both buttons', 'Gap between buttons', 20, second.x - (first.x + first.width), SPACING_TOLERANCE_PX);
  });

  test('disclaimer box: #E5E5EF fill, navy 1px border, 20px padding, Jost 16px at 125%', async () => {
    const el = 'Disclaimer box';
    const s = await computed(p.programDisclaimer);
    checkExact(el, 'Fill', '#E5E5EF', rgbToHex(s.background));
    checkExact(el, 'Border colour', '#001C4A', rgbToHex(s.borderColor));
    checkTolerance(el, 'Border width', 1, s.borderWidth, 1);
    ['top', 'right', 'bottom', 'left'].forEach((side, i) =>
      checkTolerance(el, `Padding (${side})`, 20, s.padding[i], SPACING_TOLERANCE_PX),
    );
    checkTolerance(el, 'Font size', 16, s.fontSize, FONT_SIZE_TOLERANCE_PX);
    checkExact(el, 'Font weight', 'Regular (400)', s.fontWeight === '400' ? 'Regular (400)' : s.fontWeight);
    checkExact(el, 'Line-height', '125%', `${s.lineHeightPct}%`);
    checkTolerance(el, 'Box width', 840, (await box(p.programDisclaimer)).width, SPACING_TOLERANCE_PX);
  });

  test('prescribing-information line: Jost Bold 16px, centred, navy', async () => {
    const el = 'Prescribing-information line';
    const s = await computed(p.prescribingInfoLine);
    checkTolerance(el, 'Font size', 16, s.fontSize, FONT_SIZE_TOLERANCE_PX);
    checkExact(el, 'Font weight', 'Bold (700)', s.fontWeight === '700' ? 'Bold (700)' : s.fontWeight);
    checkExact(el, 'Line-height', '125%', `${s.lineHeightPct}%`);
    checkExact(el, 'Text colour', '#001C4A', rgbToHex(s.color));
    checkExact(el, 'Alignment', 'centre', s.textAlign === 'center' ? 'centre' : s.textAlign);
  });

  test('vertical rhythm: 24px text stack, 24px to buttons, 64px to disclaimer, 120px to PI line', async () => {
    const h = await box(p.heading);
    const firstPara = await box(p.processingNote);
    const lastPara = await box(p.contactNote);
    const buttons = await box(p.downloadSummaryButton);
    const disclaimer = await box(p.programDisclaimer);
    const pi = await box(p.prescribingInfoLine);
    const el = 'Vertical spacing';
    checkTolerance(el, 'Heading → paragraph', 24, firstPara.y - (h.y + h.height), SPACING_TOLERANCE_PX);
    checkTolerance(el, 'Paragraph → buttons', 24, buttons.y - (lastPara.y + lastPara.height), SPACING_TOLERANCE_PX);
    checkTolerance(el, 'Buttons → disclaimer', 64, disclaimer.y - (buttons.y + buttons.height), SPACING_TOLERANCE_PX);
    checkTolerance(
      el, 'Disclaimer → prescribing-information line', 120, pi.y - (disclaimer.y + disclaimer.height), SPACING_TOLERANCE_PX,
    );
  });

  test('page background is #F1ECE9', async () => {
    const background = await p.heading.evaluate((el) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const b = getComputedStyle(e).backgroundColor;
        if (b !== 'rgba(0, 0, 0, 0)') return b;
      }
      return '';
    });
    checkExact('Page', 'Background', '#F1ECE9', rgbToHex(background));
  });
});
