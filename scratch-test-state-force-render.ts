// Method 2: force-render the virtualized State dropdown by locating its
// ACTUAL scrollable container (not the outer `listbox` role element, and
// not the page viewport - see Method 1's failure in
// scratch-test-state-resize.ts) and overriding its CSS height/overflow,
// then dispatching `scroll`/`resize` events to nudge Vuetify's
// virtual-scroll logic into rendering more rows.
//
// RESULT (confirmed live, 2026-08-19, xlDesktop/1920x1080 viewport, Patient
// path against the real QA host): PARTIAL improvement, not full render.
//
//   Baseline option count:                                    20
//   After forcing CSS + dispatching scroll/resize (ONE pass):  40
//   (full list is ~62 entries: 50 states + DC + territories + Armed Forces)
//
// The real scrollable container was found one level inside the `listbox`
// role element:
//   <div class="v-menu__content ... v-autocomplete__content">
//     overflow-y: auto; height: 304px; max-height: 304px;
//     scrollHeight: 816 (at baseline); clientHeight: 304
// That fixed 304px max-height (independent of viewport size) is exactly why
// Method 1 (page-level resize) had zero effect - the outer window has
// nothing to do with this inner container's own height calculation.
//
// Forcing this container's max-height/overflow open and dispatching one
// scroll+resize event roughly doubled the rendered rows (20 -> 40), which
// suggests Vuetify's virtual-scroll advances its render window per
// scroll/resize event it receives, rather than computing "how much is
// visually available" and rendering everything at once. Dispatching the
// forced-event trick multiple times in a loop (not yet tried) might push
// coverage closer to the full ~62, but this remains fragile: it relies on
// undocumented internal behavior of a Vuetify component we don't own/control,
// and could silently regress on any app/library update. The reliable
// alternative (not implemented here) is a multi-step stitched-capture
// approach: scroll in increments and take a screenshot at each step,
// producing a small numbered series that together covers the full list.
//
// This is a standalone, throwaway diagnostic script (NOT part of the
// production src/screenshots/ framework) - kept on disk for reference per
// request, not wired into any npm script or CI. Run manually via:
//   npx tsx scratch-test-state-force-render.ts
// Delete it whenever it's no longer needed.

import { chromium } from '@playwright/test';
import { LandingPage } from './src/pages/LandingPage';
import { EligibilityPage } from './src/pages/EligibilityPage';
import { PatientInformationPage } from './src/pages/PatientInformationPage';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    baseURL: 'https://portal-qa.trialcard.com/apotex/evdi/',
    viewport: { width: 1920, height: 1080 },
  });
  context.setDefaultTimeout(60_000);
  context.setDefaultNavigationTimeout(60_000);
  const page = await context.newPage();

  const landingPage = new LandingPage(page);
  const eligibilityPage = new EligibilityPage(page);
  const patientInfoPage = new PatientInformationPage(page);

  await landingPage.goto();
  await landingPage.selectRoleAction('patient', 'enroll');
  await landingPage.goNext();
  await eligibilityPage.answer({
    paysWithCashOrFederalProgram: false,
    livesInEligibleState: true,
    hasCommercialInsurance: true,
    agreesToTerms: true,
  });
  await eligibilityPage.goNext();
  await patientInfoPage.heading.waitFor({ state: 'visible' });

  const stateField = page.locator('input[name="state"]:not([type="hidden"])');
  await stateField.click();
  const listbox = page.getByRole('listbox');
  await listbox.waitFor({ state: 'visible' });

  const baselineCount = await page.getByRole('option').count();
  console.log(`Baseline option count: ${baselineCount}`);

  // Inspect the DOM around the listbox to find the actual scrollable
  // virtual-scroll container (distinct from the outer `listbox` role
  // element itself).
  const structure = await page.evaluate(() => {
    const lb = document.querySelector('[role="listbox"]');
    if (!lb) return 'no listbox found';
    const report: string[] = [];
    let el: Element | null = lb;
    for (let depth = 0; depth < 6 && el; depth++) {
      const style = window.getComputedStyle(el);
      report.push(
        `depth ${depth}: <${el.tagName.toLowerCase()} class="${el.className}"> ` +
          `overflow-y=${style.overflowY} height=${style.height} max-height=${style.maxHeight} ` +
          `scrollHeight=${(el as HTMLElement).scrollHeight} clientHeight=${(el as HTMLElement).clientHeight}`
      );
      el = el.parentElement;
    }
    return report.join('\n');
  });
  console.log('--- DOM structure around listbox ---');
  console.log(structure);
  console.log('-------------------------------------');

  // Force every ancestor with overflow-y:auto/scroll and a height/max-height
  // to become unbounded, then dispatch resize + scroll events so any
  // ResizeObserver/scroll-listener-driven virtual-scroll logic recalculates
  // its visible range against the new (huge) height.
  const afterForce = await page.evaluate(() => {
    const lb = document.querySelector('[role="listbox"]');
    if (!lb) return -1;
    let el: HTMLElement | null = lb as HTMLElement;
    const touched: string[] = [];
    for (let depth = 0; depth < 6 && el; depth++) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.maxHeight !== 'none' || parseFloat(style.height) > 0) {
        el.style.setProperty('max-height', '20000px', 'important');
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
        touched.push(el.tagName.toLowerCase() + '.' + el.className);
        el.dispatchEvent(new Event('scroll', { bubbles: true }));
      }
      el = el.parentElement;
    }
    window.dispatchEvent(new Event('resize'));
    return touched.length;
  });
  console.log(`Elements force-styled: ${afterForce}`);

  await page.waitForTimeout(500);
  const countAfterForce = await page.getByRole('option').count();
  console.log(`Option count after forcing overflow/height + dispatching resize/scroll: ${countAfterForce}`);

  await page.screenshot({ path: 'scratch-state-force-render.png', fullPage: false });
  console.log('Screenshot saved: scratch-state-force-render.png');

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
