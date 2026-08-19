// Method 1: "resize-to-fit-content" (TestCafe-style takeFullpageScreenshot
// with an extendHeight option, adapted to Playwright). Grows the browser
// viewport BEFORE opening the State dropdown, hoping Vuetify's virtualized
// listbox will compute a taller max-height and mount more option rows
// without needing to scroll.
//
// RESULT (confirmed live, 2026-08-19, xlDesktop/1920x1080 viewport, Patient
// path against the real QA host): this does NOT work. Baseline option count
// at normal viewport was 20; after resizing to 1920x5080 (+4000px height)
// BEFORE opening the dropdown, option count was still 20 - no change. Only
// adding scroll iterations on top increased it (up to 62, the full US
// states + territories + armed-forces list).
//
// Root cause: the dropdown's actual scrollable container is NOT the page/
// viewport - it's an inner `.v-menu__content.v-autocomplete__content` div
// with a Vuetify-set `max-height: 304px` that is independent of the outer
// window size. Growing the window gives the virtualized list no reason to
// render more rows. See scratch-test-state-force-render.ts for Method 2,
// which targets that inner container directly instead.
//
// This is a standalone, throwaway diagnostic script (NOT part of the
// production src/screenshots/ framework) - kept on disk for reference per
// request, not wired into any npm script or CI. Run manually via:
//   npx tsx scratch-test-state-resize.ts
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

  // Baseline: open State dropdown at normal viewport, count options.
  const stateField = page.locator('input[name="state"]:not([type="hidden"])');
  await stateField.click();
  const listbox = page.getByRole('listbox');
  await listbox.waitFor({ state: 'visible' });
  const baselineCount = await page.getByRole('option').count();
  console.log(`Baseline option count at 1920x1080 viewport: ${baselineCount}`);
  await page.keyboard.press('Escape');
  await listbox.waitFor({ state: 'hidden' }).catch(() => {});

  // Resize-to-fit-content technique: grow the viewport height a LOT before
  // opening the dropdown, so Vuetify's menu can (in theory) compute a
  // taller max-height and mount more virtualized rows without scroll.
  const EXTEND_HEIGHT = 4000;
  await page.setViewportSize({ width: 1920, height: 1080 + EXTEND_HEIGHT });

  await stateField.click();
  await listbox.waitFor({ state: 'visible' });
  const resizedCount = await page.getByRole('option').count();
  console.log(`Option count after resizing viewport to 1920x${1080 + EXTEND_HEIGHT}: ${resizedCount}`);

  const optionTexts = await page.getByRole('option').allTextContents();
  console.log(`First 5: ${optionTexts.slice(0, 5).join(', ')}`);
  console.log(`Last 5: ${optionTexts.slice(-5).join(', ')}`);

  await page.screenshot({ path: 'scratch-state-dropdown-resized.png', fullPage: false });
  console.log('Screenshot saved: scratch-state-dropdown-resized.png');

  // Try scrolling on top of the resize to see if MORE options appear beyond
  // what the taller viewport alone rendered.
  for (let i = 0; i < 5; i++) {
    await listbox.hover();
    await page.mouse.wheel(0, 300);
  }
  const afterScrollCount = await page.getByRole('option').count();
  console.log(`Option count after resize + 5x scroll: ${afterScrollCount}`);
  const optionTextsAfterScroll = await page.getByRole('option').allTextContents();
  console.log(`Last 5 after scroll: ${optionTextsAfterScroll.slice(-5).join(', ')}`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
