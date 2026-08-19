# Visual-Regression Screenshot Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, path-wise screenshot/documentation framework under `src/screenshots/` that drives the existing Playwright POM/module layer through the Patient and HCP enrollment wizards at 6 configurable resolutions, capturing individually-named, sequence-numbered PNGs incrementally to disk and merging each run into an ordered PDF — without modifying any existing test/page/module/fixture code.

**Architecture:** Three layers under `src/screenshots/`: `core/` (capture + naming + PDF-merge + dropdown-expansion helpers, reusable, no business logic), `pages/` (exactly 3 files — one per shared Landing page, one for the full Patient path, one for the full HCP path — each a thin orchestration script that calls existing `src/pages`/`src/modules` methods), and `runner/` (Node entry points that launch a real browser via Playwright's raw `chromium`/`firefox`/`webkit` launchers — not the Playwright test runner — parametrized by `--device=<resolutionName>`). All device/browser/execution knobs live in one new file, `src/utils/deviceBrowsers.ts`.

**Tech Stack:** `@playwright/test` ^1.62.1 (raw browser launchers, not the test runner, for this framework), TypeScript ^7 (strict), `pdf-lib` ^1.17.1 (new devDependency, PNG→PDF merge), `tsx` ^4.23.12 (new devDependency, runs the `.ts` runner entry points directly via `npm run screenshots:*` — supersedes `ts-node`, see amendment below).

**Amendment (found during Task 1 execution, confirmed by the human partner):** the plan originally specified `ts-node@^10.9.2` as the run-time TypeScript executor. On this machine, `ts-node@10.9.2` (the newest stable release) crashes immediately (`TypeError: Cannot read properties of undefined (reading 'fileExists')`) because it's incompatible with this repo's `typescript@^7.0.2` devDependency (already installed, used by the existing test suite) — `ts-node` was built against TS 4/5's internal API shape, which TS 7 no longer exposes the same way. This is not fixable via flags or a ts-node version bump (only an `11.0.0-beta.1` exists beyond 10.9.2). Every task below has been updated to use `tsx` instead of `ts-node` — same purpose (execute a `.ts` file directly via `npx <tool> <file>`), no code-shape difference (tsx transpiles and runs; it does not type-check, but every task's separate `npx tsc --noEmit` step already covers that).

## Global Constraints

- Do not modify `src/pages/`, `src/modules/`, `src/fixtures/`, `src/testdata/`, `src/tests/`, or `playwright.config.ts` — only import from them.
- No new locator logic inside the 3 `NN_*.screenshot.ts` files in `src/screenshots/pages/` — they call existing page-object methods/properties only. (`core/dropdownExpander.ts` is the one exception: it mirrors, but cannot literally call, `PatientInformationPage`'s *private* `selectComboboxOption`/`selectStateOption` scroll logic, since those are `private` methods on that class.)
- Strict TypeScript, no `any`. Barrel `index.ts` per new folder, updated as files are added.
- Reuse `generatePatientInformation()` from `src/utils/DataGenerator.ts` for all filled-form captures — never hand-roll fake data.
- Every capture is saved to disk immediately (no in-memory buffering until the end); an ordered manifest (array of file paths, in capture order) is built as you go and consumed by the PDF merge step at the end of each path run.
- Naming: `<NN>_<path>_<page>_<state>`, 2-digit zero-padded, continuously incrementing across files within one path run (never resets between `01_homePage` and `02_patientPath`/`03_hcpPath`). The sequence counter lives in `screenshotHelper.ts`, not hardcoded per call site.
- Output folder: `screenshots/<programName>/<runTimestamp>/<deviceType>/PNG/all screenshots/*.png` and `.../PDF/<programName>_<deviceType>_<date>.pdf`. `programName` = `PortalAutomation` (constant in `deviceBrowsers.ts`). `deviceType` = `<resolutionName>_<browserName>` (e.g. `xlDesktop_chrome`).
- Resolutions (exact): `xlDesktop` 1920×1080, `lDesktop` 1440×1080, `Desktop` 1024×1080, `lTablet` 1280×800, `pTablet` 768×1024, `xsMobile` 375×1080.
- Execution runs **path-wise**: Patient path fully (Landing→Eligibility→Patient Information→Consent→[NotEligible detour]→Success), then HCP path fully (same, minus Consent). Never interleaved.
- These scripts perform **real submissions** against the shared QA host (`https://portal-qa.trialcard.com/apotex/evdi/`), exactly like the existing `src/tests/*.spec.ts` suite already does — this is expected, not a new risk introduced by this framework.

## Verified live app behavior (confirmed by driving the real QA site during planning — not assumed)

- Eligibility empty-submit: stays on the **same** page/URL and shows `"There are 4 errors"` (does not navigate away) — safe to capture without breaking the subsequent flow.
- Patient Information empty-submit: stays on the same page, `"There are 10 errors"` (Patient path) / `9` (HCP path, email optional) — matches `expectValidationErrorCount`.
- Patient Consent empty-submit (`Enroll` clicked with no checkbox/signature): stays on the **same** `/patient/patient-consent/` URL, shows `"There are 2 errors"` — confirmed safe to call `consentPage.submit()` for the error capture and continue with a real `agreeAndSign()` + `submit()` afterward.
- Gender combobox: a plain 3-option list (`Male`, `Female`, `Prefer not to answer`), all visible immediately on one click — no scrolling needed.
- State combobox: virtualized (Vuetify `v-virtual-scroll`) — roughly 20 options exist in the DOM on open (`Alabama`...`Kansas`), further options only render after scrolling the open `listbox` (`hover()` + `mouse.wheel(0, 300)`, repeated) — matches `PatientInformationPage`'s existing private `selectStateOption` logic.
- Answering the eligibility cash/federal-program question "Yes" routes immediately to `/not-eligible` — a dead end (no further wizard steps reachable from there).
- Patient path full submission reaches `/patient/patient-success` (~30s after the real `Enroll` click, backend-dependent — matches `SuccessPage`'s existing 60s timeout).
- Design decision (confirmed with the user): the Not-Eligible branch is captured **right after** the Eligibility default/error captures (while already on a fresh, unanswered Eligibility page) rather than immediately before Success — this needs only 2 full Landing→Eligibility restarts per path run instead of 3, since a single eligibility instance can go straight from "unanswered" to "answered ineligible" without leaving the page.
- Design decision (confirmed with the user): an `_eligibility_answered` capture (state right after answering eligible, before advancing) is included in addition to `_eligibility_default`/`_eligibility_validationError`.
- Design decision (confirmed with the user): the HCP path's known-flaky terminal `Submit` click (documented in `hcp-enrollment.spec.ts`, ~1-in-3 to 1-in-4 live pass rate) is attempted **once**, with no retry loop in the screenshot tooling — if it doesn't resolve to `/success`, the `hcp_success_default` capture is skipped with a logged warning rather than crashing the run.

## Final capture sequence (per path run — sequence numbers are illustrative; the real numbers come from the shared counter)

**Patient path** (14 captures): `patient_landing_default`, `patient_landing_roleSelected`, `patient_eligibility_default`, `patient_eligibility_validationError`, `patient_notEligible_default`, `patient_eligibility_answered`, `patient_patientInformation_default`, `patient_patientInformation_genderExpanded`, `patient_patientInformation_stateExpanded`, `patient_patientInformation_validationError_10errors`, `patient_patientInformation_filled`, `patient_consent_default`, `patient_consent_validationError`, `patient_success_default`.

**HCP path** (12 captures): `hcp_landing_default`, `hcp_landing_roleSelected`, `hcp_eligibility_default`, `hcp_eligibility_validationError`, `hcp_notEligible_default`, `hcp_eligibility_answered`, `hcp_patientInformation_default`, `hcp_patientInformation_genderExpanded`, `hcp_patientInformation_stateExpanded`, `hcp_patientInformation_validationError_9errors`, `hcp_patientInformation_filled`, `hcp_success_default` (skipped with a warning, not a hard failure, if the known flaky bug hits).

**Amendment (found during Task 6 review, confirmed by the human partner):** the two lists above originally used 2-segment names (`patient_notEligible`, `patient_success`, `hcp_notEligible`, `hcp_success`), conflicting with the Global Constraints' stated 3-segment `<path>_<page>_<state>` naming convention that every other capture in this plan follows (including Task 5's `patient_landing_default`). The human partner approved adding an explicit `_default` state segment to all four names — reflected in every task below that references them (Task 6, Task 7, Task 8, Task 11).

---

### Task 1: Device/browser configuration (`deviceBrowsers.ts`) + new devDependencies

**Files:**
- Create: `src/utils/deviceBrowsers.ts`
- Modify: `src/utils/index.ts` (add barrel export)
- Modify: `package.json` (add `pdf-lib`, `tsx` devDependencies)

**Interfaces:**
- Produces: `Resolution` (`{ name: string; width: number; height: number }`), `RESOLUTIONS: Resolution[]`, `BrowserName` (`'chrome'|'edge'|'firefox'|'safari'`), `BrowserDefinition` (`{ name: BrowserName; engine: 'chromium'|'firefox'|'webkit'; channel?: string }`), `BROWSERS: BrowserDefinition[]`, `DEFAULT_BROWSER: BrowserName`, `ExecutionMode` (`'headless'|'headed'`), `EXECUTION_MODE: ExecutionMode`, `PROGRAM_NAME: string`, `getResolution(name: string): Resolution` (throws on unknown name), `getBrowser(name: BrowserName): BrowserDefinition` (throws on unknown name). All later tasks import from this file — no other file redefines resolutions/browsers/program name.

- [ ] **Step 1: Install new devDependencies**

```bash
npm install -D pdf-lib@^1.17.1 tsx@^4.23.12
```

- [ ] **Step 2: Write the failing verification script**

Create a throwaway verification file (delete it at the end of this task — it is not part of the deliverable) at `scratch-verify-devicebrowsers.ts` in the repo root:

```ts
import * as assert from 'assert';
import {
  RESOLUTIONS,
  BROWSERS,
  DEFAULT_BROWSER,
  EXECUTION_MODE,
  PROGRAM_NAME,
  getResolution,
  getBrowser,
} from './src/utils/deviceBrowsers';

assert.strictEqual(RESOLUTIONS.length, 6);
assert.deepStrictEqual(
  RESOLUTIONS.map((r) => r.name),
  ['xlDesktop', 'lDesktop', 'Desktop', 'lTablet', 'pTablet', 'xsMobile']
);
assert.deepStrictEqual(getResolution('xlDesktop'), { name: 'xlDesktop', width: 1920, height: 1080 });
assert.deepStrictEqual(getResolution('pTablet'), { name: 'pTablet', width: 768, height: 1024 });
assert.throws(() => getResolution('notARealDevice'));

assert.strictEqual(BROWSERS.length, 4);
assert.deepStrictEqual(getBrowser('chrome'), { name: 'chrome', engine: 'chromium' });
assert.deepStrictEqual(getBrowser('edge'), { name: 'edge', engine: 'chromium', channel: 'msedge' });
assert.deepStrictEqual(getBrowser('firefox'), { name: 'firefox', engine: 'firefox' });
assert.deepStrictEqual(getBrowser('safari'), { name: 'safari', engine: 'webkit' });
assert.throws(() => getBrowser('notABrowser' as never));

assert.strictEqual(DEFAULT_BROWSER, 'chrome');
assert.strictEqual(EXECUTION_MODE, 'headless');
assert.strictEqual(PROGRAM_NAME, 'PortalAutomation');

console.log('deviceBrowsers.ts verification PASSED');
```

- [ ] **Step 3: Run it to confirm it fails (module doesn't exist yet)**

Run: `npx tsx scratch-verify-devicebrowsers.ts`
Expected: FAIL with `Cannot find module './src/utils/deviceBrowsers'`

- [ ] **Step 4: Implement `src/utils/deviceBrowsers.ts`**

```ts
// Single source of truth for device/browser/execution settings used by the
// screenshot framework under src/screenshots/.
//
// To change what gets captured, edit only this file:
// - Resolutions: edit the RESOLUTIONS array below (name/width/height).
// - Browsers: edit the BROWSERS array below (maps a friendly name to a
//   Playwright engine + optional channel — 'chrome' uses the bundled
//   Chromium binary with no channel; 'edge' uses the chromium engine with
//   the 'msedge' channel; 'firefox'/'safari' map to Playwright's firefox
//   and webkit engines respectively).
// - Headless vs headed: change EXECUTION_MODE below.
// - Default browser used by the per-resolution npm scripts: change
//   DEFAULT_BROWSER below.
// - Output folder program name (screenshots/<PROGRAM_NAME>/...): change
//   PROGRAM_NAME below.

export interface Resolution {
  name: string;
  width: number;
  height: number;
}

export const RESOLUTIONS: Resolution[] = [
  { name: 'xlDesktop', width: 1920, height: 1080 },
  { name: 'lDesktop', width: 1440, height: 1080 },
  { name: 'Desktop', width: 1024, height: 1080 },
  { name: 'lTablet', width: 1280, height: 800 },
  { name: 'pTablet', width: 768, height: 1024 },
  { name: 'xsMobile', width: 375, height: 1080 },
];

export type BrowserName = 'chrome' | 'edge' | 'firefox' | 'safari';

export interface BrowserDefinition {
  name: BrowserName;
  engine: 'chromium' | 'firefox' | 'webkit';
  channel?: string;
}

export const BROWSERS: BrowserDefinition[] = [
  { name: 'chrome', engine: 'chromium' },
  { name: 'edge', engine: 'chromium', channel: 'msedge' },
  { name: 'firefox', engine: 'firefox' },
  { name: 'safari', engine: 'webkit' },
];

export const DEFAULT_BROWSER: BrowserName = 'chrome';

export type ExecutionMode = 'headless' | 'headed';
export const EXECUTION_MODE: ExecutionMode = 'headless';

export const PROGRAM_NAME = 'PortalAutomation';

export function getResolution(name: string): Resolution {
  const found = RESOLUTIONS.find((r) => r.name === name);
  if (!found) {
    throw new Error(`Unknown resolution "${name}". Valid names: ${RESOLUTIONS.map((r) => r.name).join(', ')}`);
  }
  return found;
}

export function getBrowser(name: BrowserName): BrowserDefinition {
  const found = BROWSERS.find((b) => b.name === name);
  if (!found) {
    throw new Error(`Unknown browser "${name}". Valid names: ${BROWSERS.map((b) => b.name).join(', ')}`);
  }
  return found;
}
```

- [ ] **Step 5: Run the verification script again to confirm it passes**

Run: `npx tsx scratch-verify-devicebrowsers.ts`
Expected: `deviceBrowsers.ts verification PASSED`

- [ ] **Step 6: Delete the throwaway verification script**

```bash
rm scratch-verify-devicebrowsers.ts
```

- [ ] **Step 7: Add the barrel export**

Modify `src/utils/index.ts` to add:

```ts
export * from './deviceBrowsers';
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add src/utils/deviceBrowsers.ts src/utils/index.ts package.json package-lock.json
git commit -m "feat: add device/browser configuration for screenshot framework"
```

---

### Task 2: Core capture helper (`screenshotHelper.ts`)

**Files:**
- Create: `src/screenshots/core/screenshotHelper.ts`

**Interfaces:**
- Consumes: nothing new (only `@playwright/test`'s `Page` type and Node's `fs`/`path`).
- Produces: `RunContext` (`{ programName: string; runTimestamp: string; deviceType: string; baseDir: string; pngDir: string; pdfDir: string; manifest: string[] }`), `buildRunTimestamp(date?: Date): string` (format `YYYY-MM-DD_HH-mm-ss`), `createRunContext(programName: string, deviceType: string, runTimestamp: string): RunContext` (creates `PNG/all screenshots` and `PDF` dirs on disk), `resetSequence(): void`, `capture(page: Page, context: RunContext, descriptiveName: string): Promise<string>` (saves `<NN>_<descriptiveName>.png` into `context.pngDir`, pushes the path onto `context.manifest`, returns the path), `pdfOutputPath(context: RunContext, dateStamp: string): string`. Later tasks (dropdownExpander does not depend on this; the 3 `pages/*.screenshot.ts` files and all `runner/*.ts` files depend on this exact set of names).

- [ ] **Step 1: Write the failing verification script**

Create `scratch-verify-screenshothelper.ts` in the repo root:

```ts
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';
import {
  buildRunTimestamp,
  createRunContext,
  resetSequence,
  capture,
  pdfOutputPath,
} from './src/screenshots/core/screenshotHelper';

async function main() {
  const runTimestamp = buildRunTimestamp(new Date(2026, 0, 15, 9, 5, 3));
  assert.strictEqual(runTimestamp, '2026-01-15_09-05-03');

  const context = createRunContext('ScratchProgram', 'xsMobile_chrome', runTimestamp);
  assert.ok(fs.existsSync(context.pngDir));
  assert.ok(fs.existsSync(context.pdfDir));
  assert.deepStrictEqual(context.manifest, []);

  resetSequence();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<html><body>hello</body></html>');

  const first = await capture(page, context, 'sample_default');
  const second = await capture(page, context, 'sample_next');
  await browser.close();

  assert.ok(first.endsWith(`01_sample_default.png`));
  assert.ok(second.endsWith(`02_sample_next.png`));
  assert.ok(fs.existsSync(first));
  assert.ok(fs.existsSync(second));
  assert.deepStrictEqual(context.manifest, [first, second]);

  const pdfPath = pdfOutputPath(context, '2026-01-15');
  assert.ok(pdfPath.endsWith(path.join('PDF', 'ScratchProgram_xsMobile_chrome_2026-01-15.pdf')));

  fs.rmSync(path.join(process.cwd(), 'screenshots', 'ScratchProgram'), { recursive: true, force: true });
  console.log('screenshotHelper.ts verification PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx scratch-verify-screenshothelper.ts`
Expected: FAIL with `Cannot find module './src/screenshots/core/screenshotHelper'`

- [ ] **Step 3: Implement `src/screenshots/core/screenshotHelper.ts`**

```ts
import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface RunContext {
  programName: string;
  runTimestamp: string;
  deviceType: string;
  baseDir: string;
  pngDir: string;
  pdfDir: string;
  manifest: string[];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildRunTimestamp(date: Date = new Date()): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

export function createRunContext(programName: string, deviceType: string, runTimestamp: string): RunContext {
  const baseDir = path.join(process.cwd(), 'screenshots', programName, runTimestamp, deviceType);
  const pngDir = path.join(baseDir, 'PNG', 'all screenshots');
  const pdfDir = path.join(baseDir, 'PDF');
  fs.mkdirSync(pngDir, { recursive: true });
  fs.mkdirSync(pdfDir, { recursive: true });
  return { programName, runTimestamp, deviceType, baseDir, pngDir, pdfDir, manifest: [] };
}

let sequence = 0;

export function resetSequence(): void {
  sequence = 0;
}

function nextSequence(): string {
  sequence += 1;
  return pad(sequence);
}

export async function capture(page: Page, context: RunContext, descriptiveName: string): Promise<string> {
  const fileName = `${nextSequence()}_${descriptiveName}.png`;
  const filePath = path.join(context.pngDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  context.manifest.push(filePath);
  return filePath;
}

export function pdfOutputPath(context: RunContext, dateStamp: string): string {
  return path.join(context.pdfDir, `${context.programName}_${context.deviceType}_${dateStamp}.pdf`);
}
```

- [ ] **Step 4: Run the verification script again to confirm it passes**

Run: `npx tsx scratch-verify-screenshothelper.ts`
Expected: `screenshotHelper.ts verification PASSED`

- [ ] **Step 5: Delete the throwaway verification script**

```bash
rm scratch-verify-screenshothelper.ts
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/screenshots/core/screenshotHelper.ts
git commit -m "feat: add incremental screenshot capture + naming helper"
```

---

### Task 3: Dropdown-expansion helper (`dropdownExpander.ts`)

**Files:**
- Create: `src/screenshots/core/dropdownExpander.ts`

**Interfaces:**
- Consumes: nothing new (only `@playwright/test`'s `Page`/`expect`).
- Produces: `expandGenderDropdown(page: Page): Promise<void>`, `expandStateDropdown(page: Page): Promise<void>`, `closeDropdown(page: Page): Promise<void>`. Consumed by `02_patientPath.screenshot.ts` and `03_hcpPath.screenshot.ts` (Task 6/7).

- [ ] **Step 1: Write the failing verification script**

This needs a real, already-loaded Patient Information page (Gender/State are Vuetify virtualized comboboxes — no static HTML fixture reasonably reproduces the real virtualization). Create `scratch-verify-dropdownexpander.ts` in the repo root, driving the live QA app through the existing POMs (reused, not new locator logic) up to Patient Information:

```ts
import * as assert from 'assert';
import { chromium } from '@playwright/test';
import { LandingPage } from './src/pages/LandingPage';
import { EligibilityPage } from './src/pages/EligibilityPage';
import { PatientInformationPage } from './src/pages/PatientInformationPage';
import { expandGenderDropdown, expandStateDropdown, closeDropdown } from './src/screenshots/core/dropdownExpander';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL: 'https://portal-qa.trialcard.com/apotex/evdi/' });

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

  await expandGenderDropdown(page);
  const genderOptionCount = await page.getByRole('option').count();
  assert.ok(genderOptionCount >= 3, `expected >= 3 gender options, got ${genderOptionCount}`);
  await closeDropdown(page);
  assert.strictEqual(await page.getByRole('listbox').count(), 0);

  await expandStateDropdown(page);
  const stateOptionCount = await page.getByRole('option').count();
  assert.ok(stateOptionCount >= 15, `expected >= 15 state options after scroll, got ${stateOptionCount}`);
  await closeDropdown(page);

  await browser.close();
  console.log('dropdownExpander.ts verification PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx scratch-verify-dropdownexpander.ts`
Expected: FAIL with `Cannot find module './src/screenshots/core/dropdownExpander'`

- [ ] **Step 3: Implement `src/screenshots/core/dropdownExpander.ts`**

**Amendment (found during Task 8's live integration run, approved by the human partner):** the original version below opened each combobox with a single click + assert. Driving the full Patient path live at the `xsMobile` (375px) viewport surfaced a reproducible race: clicking the State field immediately after the Gender dropdown was closed via `Escape` sometimes gets "eaten" (the app runs whole-form validation instead of opening the listbox) - a second immediate click on the same field reliably opens it. This is specific to this screenshot framework's own open-then-Escape-close preview pattern; the real enrollment flow (`PatientInformationPage.fill`/`selectStateOption`) always commits a combobox by clicking an option, never via `Escape`, so it never hits this race. The code below includes the resulting retry-once `openListbox` helper.

```ts
import { Page, Locator, expect } from '@playwright/test';

function genderField(page: Page) {
  return page.locator('input[name="gender"]:not([type="hidden"])');
}

function stateField(page: Page) {
  return page.locator('input[name="state"]:not([type="hidden"])');
}

// Click a combobox field and wait for its listbox to open, retrying the
// click once if it doesn't. Confirmed live (xsMobile/375px viewport): the
// very first click on a field, immediately after a *different* field's
// dropdown was closed via Escape, is sometimes swallowed - instead of
// opening this field's menu, the app runs whole-form validation (both
// fields flip to "Required") and no listbox ever appears. Reproduced
// consistently outside this framework too: an immediate second click on the
// same field then opens the menu normally, so this is most likely the
// just-closed overlay's own "click outside" handler racing the new click's
// pointerdown, rather than anything wrong with the field itself. This only
// matters for this screenshot flow's open-then-Escape-close preview pattern
// - the real enrollment flow (PatientInformationPage.fill/
// selectStateOption) always commits a combobox by clicking an option, never
// via Escape, so it never hits this race.
async function openListbox(page: Page, field: Locator): Promise<Locator> {
  const listbox = page.getByRole('listbox');
  await field.click();
  try {
    await expect(listbox).toBeVisible({ timeout: 3_000 });
  } catch {
    await field.click();
    await expect(listbox).toBeVisible();
  }
  return listbox;
}

export async function expandGenderDropdown(page: Page): Promise<void> {
  await openListbox(page, genderField(page));
}

export async function expandStateDropdown(page: Page): Promise<void> {
  const listbox = await openListbox(page, stateField(page));
  // The state list is virtualized (Vuetify v-virtual-scroll): scroll a few
  // times so the capture shows more than just the initial ~20-option window,
  // mirroring PatientInformationPage's private selectStateOption logic.
  for (let attempt = 0; attempt < 8; attempt++) {
    await listbox.hover();
    await page.mouse.wheel(0, 300);
  }
}

export async function closeDropdown(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
}
```

- [ ] **Step 4: Run the verification script again to confirm it passes**

Run: `npx tsx scratch-verify-dropdownexpander.ts`
Expected: `dropdownExpander.ts verification PASSED`

- [ ] **Step 5: Delete the throwaway verification script**

```bash
rm scratch-verify-dropdownexpander.ts
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/screenshots/core/dropdownExpander.ts
git commit -m "feat: add Gender/State dropdown-expansion helper for screenshots"
```

---

### Task 4: PDF merge helper (`pdfMerger.ts`)

**Files:**
- Create: `src/screenshots/core/pdfMerger.ts`

**Interfaces:**
- Consumes: `pdf-lib`'s `PDFDocument`.
- Produces: `mergePngsToPdf(pngPaths: string[], outputPdfPath: string): Promise<void>`. Consumed by every `runner/*.ts` file (Task 8) at the end of a run, given `context.manifest` (Task 2) as `pngPaths`.

- [ ] **Step 1: Write the failing verification script**

Create `scratch-verify-pdfmerger.ts` in the repo root:

```ts
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { mergePngsToPdf } from './src/screenshots/core/pdfMerger';

async function main() {
  const tmpDir = path.join(process.cwd(), 'scratch-pdf-verify');
  fs.mkdirSync(tmpDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<html><body style="background:red">one</body></html>');
  const png1 = path.join(tmpDir, '01_one.png');
  await page.screenshot({ path: png1 });
  await page.setContent('<html><body style="background:blue">two</body></html>');
  const png2 = path.join(tmpDir, '02_two.png');
  await page.screenshot({ path: png2 });
  await browser.close();

  const outputPdf = path.join(tmpDir, 'merged.pdf');
  await mergePngsToPdf([png1, png2], outputPdf);

  assert.ok(fs.existsSync(outputPdf));
  const bytes = fs.readFileSync(outputPdf);
  const doc = await PDFDocument.load(bytes);
  assert.strictEqual(doc.getPageCount(), 2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('pdfMerger.ts verification PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx scratch-verify-pdfmerger.ts`
Expected: FAIL with `Cannot find module './src/screenshots/core/pdfMerger'`

- [ ] **Step 3: Implement `src/screenshots/core/pdfMerger.ts`**

```ts
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

export async function mergePngsToPdf(pngPaths: string[], outputPdfPath: string): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  for (const pngPath of pngPaths) {
    const imageBytes = fs.readFileSync(pngPath);
    const image = await pdfDoc.embedPng(imageBytes);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const bytes = await pdfDoc.save();
  fs.mkdirSync(path.dirname(outputPdfPath), { recursive: true });
  fs.writeFileSync(outputPdfPath, bytes);
}
```

- [ ] **Step 4: Run the verification script again to confirm it passes**

Run: `npx tsx scratch-verify-pdfmerger.ts`
Expected: `pdfMerger.ts verification PASSED`

- [ ] **Step 5: Delete the throwaway verification script**

```bash
rm scratch-verify-pdfmerger.ts
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/screenshots/core/pdfMerger.ts
git commit -m "feat: add PNG-to-PDF merge helper for screenshot runs"
```

---

### Task 5: Home/Landing page captures (`01_homePage.screenshot.ts`)

**Files:**
- Create: `src/screenshots/pages/01_homePage.screenshot.ts`

**Interfaces:**
- Consumes: `LandingPage` (from `src/pages/LandingPage.ts`), `PortalRole` (from `src/testdata/types.ts`), `RunContext`/`capture` (Task 2).
- Produces: `captureHomePage(page: Page, context: RunContext, role: PortalRole): Promise<void>` — leaves `page` navigated to the Eligibility step on return (calls `landingPage.goNext()` internally). Consumed by `run-patient-path.ts` and `run-hcp-path.ts` (Task 8).

- [ ] **Step 1: Implement `src/screenshots/pages/01_homePage.screenshot.ts`**

(No unit-style test precedes this — it is a thin orchestration script over already-verified POM methods and the already-verified `capture` helper; its correctness is verified by the live integration run in Task 11. This mirrors how `src/tests/*.spec.ts` itself has no lower-level unit tests in this repo.)

```ts
import { Page } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { PortalRole } from '../../testdata/types';
import { RunContext, capture } from '../core/screenshotHelper';

export async function captureHomePage(page: Page, context: RunContext, role: PortalRole): Promise<void> {
  const landingPage = new LandingPage(page);

  await landingPage.goto();
  await capture(page, context, `${role}_landing_default`);

  await landingPage.selectRoleAction(role, 'enroll');
  await capture(page, context, `${role}_landing_roleSelected`);

  await landingPage.goNext();
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/screenshots/pages/01_homePage.screenshot.ts
git commit -m "feat: add Landing page screenshot capture (both roles, shared entry point)"
```

---

### Task 6: Patient path captures (`02_patientPath.screenshot.ts`)

**Files:**
- Create: `src/screenshots/pages/02_patientPath.screenshot.ts`

**Interfaces:**
- Consumes: `LandingPage`, `EligibilityPage`, `PatientInformationPage`, `PatientConsentPage`, `NotEligiblePage`, `SuccessPage` (all from `src/pages/`), `EligibilityAnswers` (from `src/testdata/types.ts`), `generatePatientInformation` (from `src/utils/DataGenerator.ts`), `RunContext`/`capture` (Task 2), `expandGenderDropdown`/`expandStateDropdown`/`closeDropdown` (Task 3).
- Produces: `capturePatientPath(page: Page, context: RunContext): Promise<void>` — expects `page` to already be on the Eligibility step (i.e. called right after `captureHomePage(page, context, 'patient')`); leaves `page` on the Success page on return. Consumed by `run-patient-path.ts` (Task 8).

- [ ] **Step 1: Implement `src/screenshots/pages/02_patientPath.screenshot.ts`**

```ts
import { Page } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { EligibilityPage } from '../../pages/EligibilityPage';
import { PatientInformationPage } from '../../pages/PatientInformationPage';
import { PatientConsentPage } from '../../pages/PatientConsentPage';
import { NotEligiblePage } from '../../pages/NotEligiblePage';
import { SuccessPage } from '../../pages/SuccessPage';
import { EligibilityAnswers } from '../../testdata/types';
import { generatePatientInformation } from '../../utils/DataGenerator';
import { RunContext, capture } from '../core/screenshotHelper';
import { expandGenderDropdown, expandStateDropdown, closeDropdown } from '../core/dropdownExpander';

const eligibleAnswers: EligibilityAnswers = {
  paysWithCashOrFederalProgram: false,
  livesInEligibleState: true,
  hasCommercialInsurance: true,
  agreesToTerms: true,
};

const ineligibleAnswers: EligibilityAnswers = {
  ...eligibleAnswers,
  paysWithCashOrFederalProgram: true,
};

export async function capturePatientPath(page: Page, context: RunContext): Promise<void> {
  const eligibilityPage = new EligibilityPage(page);
  const patientInfoPage = new PatientInformationPage(page);
  const consentPage = new PatientConsentPage(page);
  const notEligiblePage = new NotEligiblePage(page);
  const successPage = new SuccessPage(page);
  const landingPage = new LandingPage(page);

  // Eligibility: default + validation-error states. Confirmed live: an
  // empty submit stays on this same page ("There are 4 errors"), so this is
  // safe to capture without breaking the flow below.
  await capture(page, context, 'patient_eligibility_default');
  await eligibilityPage.nextButton.click();
  await capture(page, context, 'patient_eligibility_validationError');

  // Not-Eligible branch: answering "Yes" to the cash/federal-program
  // question routes straight to /not-eligible, a dead end. Captured now,
  // while already on this fresh Eligibility instance, rather than right
  // before Success - avoids a 3rd full wizard restart.
  await eligibilityPage.answer(ineligibleAnswers);
  await eligibilityPage.goNext();
  await notEligiblePage.expectVisible();
  await capture(page, context, 'patient_notEligible_default');

  // Restart for the eligible branch that continues through to Success.
  await landingPage.goto();
  await landingPage.selectRoleAction('patient', 'enroll');
  await landingPage.goNext();

  await eligibilityPage.answer(eligibleAnswers);
  await capture(page, context, 'patient_eligibility_answered');
  await eligibilityPage.goNext();

  // Patient Information. Waiting for network idle (bounded + swallowed,
  // same pattern PatientInformationPage.submit() already uses for its own
  // HCP-path race) guards against capturing this page mid-route-transition,
  // per the eligibility->patient-information race PatientInformationPage.ts
  // documents (loading overlay before the new route's component mounts).
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await capture(page, context, 'patient_patientInformation_default');

  await expandGenderDropdown(page);
  await capture(page, context, 'patient_patientInformation_genderExpanded');
  await closeDropdown(page);

  await expandStateDropdown(page);
  await capture(page, context, 'patient_patientInformation_stateExpanded');
  await closeDropdown(page);

  await patientInfoPage.submit();
  await patientInfoPage.expectValidationErrorCount(10);
  await capture(page, context, 'patient_patientInformation_validationError_10errors');

  const patientData = generatePatientInformation();
  await patientInfoPage.fill(patientData);
  await capture(page, context, 'patient_patientInformation_filled');
  await patientInfoPage.submit();

  // Consent. Confirmed live: an empty Enroll click stays on this same
  // /patient/patient-consent/ URL ("There are 2 errors"), so it's safe to
  // capture the error state here and then sign + submit for real after.
  // Same route-transition guard as above - PatientConsentPage.ts documents
  // the analogous patient-information->consent race.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await capture(page, context, 'patient_consent_default');

  await consentPage.submit();
  await capture(page, context, 'patient_consent_validationError');

  await consentPage.agreeAndSign(`${patientData.firstName} ${patientData.lastName}`);
  await consentPage.submit();

  await successPage.expectVisible();
  await capture(page, context, 'patient_success_default');
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/screenshots/pages/02_patientPath.screenshot.ts
git commit -m "feat: add Patient path screenshot capture (eligibility through success)"
```

---

### Task 7: HCP path captures (`03_hcpPath.screenshot.ts`)

**Files:**
- Create: `src/screenshots/pages/03_hcpPath.screenshot.ts`

**Interfaces:**
- Consumes: same set as Task 6, minus `PatientConsentPage`.
- Produces: `captureHcpPath(page: Page, context: RunContext): Promise<void>` — expects `page` already on the Eligibility step (called right after `captureHomePage(page, context, 'hcp')`); on the known-flaky terminal submit, attempts once and logs+skips the `hcp_success_default` capture rather than throwing if `/success` isn't reached. Consumed by `run-hcp-path.ts` (Task 8).

- [ ] **Step 1: Implement `src/screenshots/pages/03_hcpPath.screenshot.ts`**

```ts
import { Page } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { EligibilityPage } from '../../pages/EligibilityPage';
import { PatientInformationPage } from '../../pages/PatientInformationPage';
import { NotEligiblePage } from '../../pages/NotEligiblePage';
import { SuccessPage } from '../../pages/SuccessPage';
import { EligibilityAnswers } from '../../testdata/types';
import { generatePatientInformation } from '../../utils/DataGenerator';
import { RunContext, capture } from '../core/screenshotHelper';
import { expandGenderDropdown, expandStateDropdown, closeDropdown } from '../core/dropdownExpander';

const eligibleAnswers: EligibilityAnswers = {
  paysWithCashOrFederalProgram: false,
  livesInEligibleState: true,
  hasCommercialInsurance: true,
  agreesToTerms: true,
};

const ineligibleAnswers: EligibilityAnswers = {
  ...eligibleAnswers,
  paysWithCashOrFederalProgram: true,
};

export async function captureHcpPath(page: Page, context: RunContext): Promise<void> {
  const eligibilityPage = new EligibilityPage(page);
  const patientInfoPage = new PatientInformationPage(page);
  const notEligiblePage = new NotEligiblePage(page);
  const successPage = new SuccessPage(page);
  const landingPage = new LandingPage(page);

  await capture(page, context, 'hcp_eligibility_default');
  await eligibilityPage.nextButton.click();
  await capture(page, context, 'hcp_eligibility_validationError');

  await eligibilityPage.answer(ineligibleAnswers);
  await eligibilityPage.goNext();
  await notEligiblePage.expectVisible();
  await capture(page, context, 'hcp_notEligible_default');

  await landingPage.goto();
  await landingPage.selectRoleAction('hcp', 'enroll');
  await landingPage.goNext();

  await eligibilityPage.answer(eligibleAnswers);
  await capture(page, context, 'hcp_eligibility_answered');
  await eligibilityPage.goNext();

  // Same eligibility->patient-information route-transition guard as the
  // Patient path (see 02_patientPath.screenshot.ts) - avoids capturing this
  // page mid-transition.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await capture(page, context, 'hcp_patientInformation_default');

  await expandGenderDropdown(page);
  await capture(page, context, 'hcp_patientInformation_genderExpanded');
  await closeDropdown(page);

  await expandStateDropdown(page);
  await capture(page, context, 'hcp_patientInformation_stateExpanded');
  await closeDropdown(page);

  await patientInfoPage.submit();
  await patientInfoPage.expectValidationErrorCount(9);
  await capture(page, context, 'hcp_patientInformation_validationError_9errors');

  const patientData = generatePatientInformation();
  await patientInfoPage.fill(patientData);
  await capture(page, context, 'hcp_patientInformation_filled');

  // Terminal action for the HCP path. Known, escalated live-app bug (see
  // hcp-enrollment.spec.ts): this click races the app's own validation and
  // fails roughly 2-in-3 to 3-in-4 attempts. Per design decision, this
  // framework attempts it once and skips the success capture (with a
  // warning) rather than adding retry complexity here.
  await patientInfoPage.submit({ extraPreClickWaitMs: 30_000 });

  try {
    await successPage.expectVisible();
    await capture(page, context, 'hcp_success_default');
  } catch (error) {
    console.warn(
      '[hcp_success_default] Skipped - known flaky HCP terminal-submit bug (see hcp-enrollment.spec.ts) ' +
        'did not reach /success on this single attempt.',
      error
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/screenshots/pages/03_hcpPath.screenshot.ts
git commit -m "feat: add HCP path screenshot capture (eligibility through success, no consent)"
```

---

### Task 8: Runner entry points

**Files:**
- Create: `src/screenshots/runner/run-patient-path.ts`
- Create: `src/screenshots/runner/run-hcp-path.ts`
- Create: `src/screenshots/runner/run-all.ts`
- Create: `src/screenshots/runner/run-all-resolutions.ts`

**Interfaces:**
- Consumes: `RESOLUTIONS`, `getResolution`, `getBrowser`, `DEFAULT_BROWSER`, `EXECUTION_MODE`, `PROGRAM_NAME`, `BrowserName`, `BrowserDefinition` (Task 1); `config` (from `src/config/index.ts`, existing, reused); `createRunContext`, `resetSequence`, `buildRunTimestamp`, `pdfOutputPath`, `RunContext` (Task 2); `mergePngsToPdf` (Task 4); `captureHomePage` (Task 5); `capturePatientPath` (Task 6); `captureHcpPath` (Task 7).
- Produces: `runPatientPath(resolutionName: string, browserName?: BrowserName): Promise<RunContext>`, `runHcpPath(resolutionName: string, browserName?: BrowserName): Promise<RunContext>`, `runAll(resolutionName: string, browserName?: BrowserName): Promise<void>`. Consumed by `package.json` npm scripts (Task 9).

- [ ] **Step 1: Implement `src/screenshots/runner/run-patient-path.ts`**

```ts
import { chromium, firefox, webkit, Browser, Page } from '@playwright/test';
import {
  BrowserDefinition,
  BrowserName,
  DEFAULT_BROWSER,
  EXECUTION_MODE,
  PROGRAM_NAME,
  getBrowser,
  getResolution,
} from '../../utils/deviceBrowsers';
import { config } from '../../config';
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../core/screenshotHelper';
import { mergePngsToPdf } from '../core/pdfMerger';
import { captureHomePage } from '../pages/01_homePage.screenshot';
import { capturePatientPath } from '../pages/02_patientPath.screenshot';

function launch(browserDef: BrowserDefinition): Promise<Browser> {
  const headless = EXECUTION_MODE === 'headless';
  if (browserDef.engine === 'chromium') {
    return chromium.launch({ headless, channel: browserDef.channel });
  }
  if (browserDef.engine === 'firefox') {
    return firefox.launch({ headless });
  }
  return webkit.launch({ headless });
}

export async function runPatientPath(resolutionName: string, browserName: BrowserName = DEFAULT_BROWSER): Promise<RunContext> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName);
  const deviceType = `${resolution.name}_${browserDef.name}`;
  const runTimestamp = buildRunTimestamp();

  resetSequence();
  const context = createRunContext(PROGRAM_NAME, deviceType, runTimestamp);

  const browser = await launch(browserDef);
  const browserContext = await browser.newContext({
    baseURL: config.baseURL,
    viewport: { width: resolution.width, height: resolution.height },
  });
  // This standalone runner does not go through the `playwright test` runner,
  // so playwright.config.ts's settings (including its 90s test timeout) do
  // not apply here - a bare browserContext otherwise falls back to
  // Playwright's hardcoded 30s default action/navigation timeout. Confirmed
  // live: the shared QA host's initial page load can take ~18-30s+, which
  // intermittently exceeded that 30s default and threw a
  // "page.goto: Timeout 30000ms exceeded" error. Raised to 60s to give this
  // slow host reliable headroom without being excessive.
  browserContext.setDefaultTimeout(60_000);
  browserContext.setDefaultNavigationTimeout(60_000);
  const page: Page = await browserContext.newPage();

  try {
    await captureHomePage(page, context, 'patient');
    await capturePatientPath(page, context);
  } finally {
    await browser.close();
  }

  const dateStamp = runTimestamp.split('_')[0];
  await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));

  return context;
}

if (require.main === module) {
  const deviceArg = process.argv.find((a) => a.startsWith('--device='));
  const browserArg = process.argv.find((a) => a.startsWith('--browser='));
  const resolutionName = deviceArg ? deviceArg.split('=')[1] : 'xlDesktop';
  const browserName = browserArg ? (browserArg.split('=')[1] as BrowserName) : undefined;

  runPatientPath(resolutionName, browserName).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Implement `src/screenshots/runner/run-hcp-path.ts`**

```ts
import { chromium, firefox, webkit, Browser, Page } from '@playwright/test';
import {
  BrowserDefinition,
  BrowserName,
  DEFAULT_BROWSER,
  EXECUTION_MODE,
  PROGRAM_NAME,
  getBrowser,
  getResolution,
} from '../../utils/deviceBrowsers';
import { config } from '../../config';
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../core/screenshotHelper';
import { mergePngsToPdf } from '../core/pdfMerger';
import { captureHomePage } from '../pages/01_homePage.screenshot';
import { captureHcpPath } from '../pages/03_hcpPath.screenshot';

function launch(browserDef: BrowserDefinition): Promise<Browser> {
  const headless = EXECUTION_MODE === 'headless';
  if (browserDef.engine === 'chromium') {
    return chromium.launch({ headless, channel: browserDef.channel });
  }
  if (browserDef.engine === 'firefox') {
    return firefox.launch({ headless });
  }
  return webkit.launch({ headless });
}

export async function runHcpPath(resolutionName: string, browserName: BrowserName = DEFAULT_BROWSER): Promise<RunContext> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName);
  const deviceType = `${resolution.name}_${browserDef.name}`;
  const runTimestamp = buildRunTimestamp();

  resetSequence();
  const context = createRunContext(PROGRAM_NAME, deviceType, runTimestamp);

  const browser = await launch(browserDef);
  const browserContext = await browser.newContext({
    baseURL: config.baseURL,
    viewport: { width: resolution.width, height: resolution.height },
  });
  // This standalone runner does not go through the `playwright test` runner,
  // so playwright.config.ts's settings (including its 90s test timeout) do
  // not apply here - a bare browserContext otherwise falls back to
  // Playwright's hardcoded 30s default action/navigation timeout. Confirmed
  // live: the shared QA host's initial page load can take ~18-30s+, which
  // intermittently exceeded that 30s default and threw a
  // "page.goto: Timeout 30000ms exceeded" error. Raised to 60s to give this
  // slow host reliable headroom without being excessive.
  browserContext.setDefaultTimeout(60_000);
  browserContext.setDefaultNavigationTimeout(60_000);
  const page: Page = await browserContext.newPage();

  try {
    await captureHomePage(page, context, 'hcp');
    await captureHcpPath(page, context);
  } finally {
    await browser.close();
  }

  const dateStamp = runTimestamp.split('_')[0];
  await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));

  return context;
}

if (require.main === module) {
  const deviceArg = process.argv.find((a) => a.startsWith('--device='));
  const browserArg = process.argv.find((a) => a.startsWith('--browser='));
  const resolutionName = deviceArg ? deviceArg.split('=')[1] : 'xlDesktop';
  const browserName = browserArg ? (browserArg.split('=')[1] as BrowserName) : undefined;

  runHcpPath(resolutionName, browserName).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 3: Implement `src/screenshots/runner/run-all.ts`**

```ts
import { BrowserName } from '../../utils/deviceBrowsers';
import { runPatientPath } from './run-patient-path';
import { runHcpPath } from './run-hcp-path';

export async function runAll(resolutionName: string, browserName?: BrowserName): Promise<void> {
  // Patient path fully, then HCP path fully - never interleaved.
  await runPatientPath(resolutionName, browserName);
  await runHcpPath(resolutionName, browserName);
}

if (require.main === module) {
  const deviceArg = process.argv.find((a) => a.startsWith('--device='));
  const browserArg = process.argv.find((a) => a.startsWith('--browser='));
  const resolutionName = deviceArg ? deviceArg.split('=')[1] : 'xlDesktop';
  const browserName = browserArg ? (browserArg.split('=')[1] as BrowserName) : undefined;

  runAll(resolutionName, browserName).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Implement `src/screenshots/runner/run-all-resolutions.ts`**

```ts
import { RESOLUTIONS, BrowserName } from '../../utils/deviceBrowsers';
import { runAll } from './run-all';

async function runAllResolutions(browserName?: BrowserName): Promise<void> {
  for (const resolution of RESOLUTIONS) {
    console.log(`--- Running screenshot capture for resolution: ${resolution.name} ---`);
    await runAll(resolution.name, browserName);
  }
}

if (require.main === module) {
  const browserArg = process.argv.find((a) => a.startsWith('--browser='));
  const browserName = browserArg ? (browserArg.split('=')[1] as BrowserName) : undefined;

  runAllResolutions(browserName).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Live smoke run against the fastest/smallest resolution (Patient path only)**

Run: `npx tsx src/screenshots/runner/run-patient-path.ts --device=xsMobile`
Expected: completes without throwing; prints no uncaught errors. This performs a real enrollment submission against the QA host, consistent with the existing `src/tests/patient-enrollment.spec.ts` suite's own live end-to-end test.

- [ ] **Step 7: Verify the output structure on disk**

```bash
ls "screenshots/PortalAutomation"
```

Expected: one timestamped directory containing `xsMobile_chrome/PNG/all screenshots/` (14 numbered PNGs, `01_...` through `14_...`) and `xsMobile_chrome/PDF/PortalAutomation_xsMobile_chrome_<date>.pdf`.

- [ ] **Step 8: Commit**

```bash
git add src/screenshots/runner/run-patient-path.ts src/screenshots/runner/run-hcp-path.ts src/screenshots/runner/run-all.ts src/screenshots/runner/run-all-resolutions.ts
git commit -m "feat: add screenshot runner entry points (per-path and combined)"
```

---

### Task 9: npm scripts

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: `run-all.ts` and `run-all-resolutions.ts` (Task 8).
- Produces: one `screenshots:<resolution>` script per breakpoint plus `screenshots:all`.

- [ ] **Step 1: Add the scripts**

Modify `package.json`'s `"scripts"` block to add:

```json
"screenshots:xlDesktop": "tsx src/screenshots/runner/run-all.ts --device=xlDesktop",
"screenshots:lDesktop": "tsx src/screenshots/runner/run-all.ts --device=lDesktop",
"screenshots:desktop": "tsx src/screenshots/runner/run-all.ts --device=Desktop",
"screenshots:lTablet": "tsx src/screenshots/runner/run-all.ts --device=lTablet",
"screenshots:pTablet": "tsx src/screenshots/runner/run-all.ts --device=pTablet",
"screenshots:xsMobile": "tsx src/screenshots/runner/run-all.ts --device=xsMobile",
"screenshots:all": "tsx src/screenshots/runner/run-all-resolutions.ts"
```

- [ ] **Step 2: Verify one script end-to-end**

Run: `npm run screenshots:xsMobile`
Expected: runs both Patient path then HCP path for `xsMobile`, in order; two `xsMobile_chrome` output directories are NOT created (same `deviceType` string for both paths within one `run-all` invocation) — instead each path run gets its own `runTimestamp` folder since `runPatientPath`/`runHcpPath` each call `buildRunTimestamp()` independently. Confirm two separate timestamped run folders exist under `screenshots/PortalAutomation/`, each with a complete `xsMobile_chrome/PNG/all screenshots/` + `PDF/` pair.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add per-resolution and all-resolutions npm scripts for screenshots"
```

---

### Task 10: Barrel exports + README

**Files:**
- Create: `src/screenshots/core/index.ts`
- Create: `src/screenshots/pages/index.ts`
- Create: `src/screenshots/runner/index.ts`
- Create: `src/screenshots/README.md`

**Interfaces:**
- Consumes: every export from Tasks 2–8.
- Produces: barrel re-exports (no new behavior).

- [ ] **Step 1: Implement `src/screenshots/core/index.ts`**

```ts
export * from './screenshotHelper';
export * from './dropdownExpander';
export * from './pdfMerger';
```

- [ ] **Step 2: Implement `src/screenshots/pages/index.ts`**

```ts
export * from './01_homePage.screenshot';
export * from './02_patientPath.screenshot';
export * from './03_hcpPath.screenshot';
```

- [ ] **Step 3: Implement `src/screenshots/runner/index.ts`**

```ts
export * from './run-patient-path';
export * from './run-hcp-path';
export * from './run-all';
export * from './run-all-resolutions';
```

- [ ] **Step 4: Write `src/screenshots/README.md`**

```markdown
# Screenshot Framework

Standalone visual-documentation/regression screenshot tooling, separate from
`src/tests/`. It drives the existing `src/pages`/`src/modules` Page Object
Model through the Patient and HCP enrollment wizards at configurable
resolutions, saving individually-named PNGs incrementally and merging each
run into a single ordered PDF.

## Folder layout

```
src/screenshots/
  core/               shared helpers - no business logic
    screenshotHelper.ts   capture + naming + folder-path builder + sequence counter
    dropdownExpander.ts   opens/expands Gender + State comboboxes for a screenshot
    pdfMerger.ts           merges an ordered list of PNGs into one PDF
  pages/               3 files, one per shared page / path
    01_homePage.screenshot.ts     Landing page (both roles' default + role-selected states)
    02_patientPath.screenshot.ts  Eligibility -> Patient Information -> Consent -> Not-Eligible -> Success
    03_hcpPath.screenshot.ts      same shape, no Consent step, 9-error validation instead of 10
  runner/
    run-patient-path.ts       Patient path only, one resolution
    run-hcp-path.ts           HCP path only, one resolution
    run-all.ts                Patient path then HCP path, one resolution
    run-all-resolutions.ts    run-all for every resolution in deviceBrowsers.ts, in order
```

Output is written to (not under `src/`):

```
screenshots/
  PortalAutomation/
    <runTimestamp>/            e.g. 2026-08-18_14-32-07
      <resolutionName>_<browserName>/
        PNG/all screenshots/*.png
        PDF/PortalAutomation_<resolutionName>_<browserName>_<date>.pdf
```

## Naming convention

Every capture is `<NN>_<path>_<page>_<state>.png`, e.g.
`08_patient_patientInformation_validationError_10errors.png`. `NN` is a
2-digit, zero-padded sequence number that increments continuously across
`01_homePage` into `02_patientPath`/`03_hcpPath` within one path run - it is
tracked by a shared counter in `screenshotHelper.ts`, so inserting or
removing a capture never requires manually renumbering anything else.

## Adding a new page or state to capture

1. Add a line to the relevant file in `src/screenshots/pages/` calling
   `capture(page, context, 'descriptiveName')` at the point in the flow you
   want to snapshot. Only call existing `src/pages`/`src/modules` methods to
   get there - don't add new locators in these 3 files (put reusable new
   interaction helpers in `src/screenshots/core/` instead, as
   `dropdownExpander.ts` does).
2. Nothing else needs to change - the sequence number and file path are
   derived automatically.

## Adding a new resolution

Add an entry to the `RESOLUTIONS` array in `src/utils/deviceBrowsers.ts`,
then add a matching `screenshots:<name>` npm script in `package.json`
pointing at `run-all.ts --device=<name>`.

## Adding a new browser

Add an entry to the `BROWSERS` array in `src/utils/deviceBrowsers.ts`
(`engine` must be `'chromium' | 'firefox' | 'webkit'`, `channel` is optional
and only meaningful for the `chromium` engine, e.g. `'msedge'`). Pass
`--browser=<name>` to any runner script, or change `DEFAULT_BROWSER` in the
same file to change what the npm scripts use by default.

## Headless vs headed

Set `EXECUTION_MODE` in `src/utils/deviceBrowsers.ts` to `'headed'` to watch
the browser while it runs.

## Known limitation

The HCP path's terminal `Submit` click is a documented, escalated, flaky
live-app bug (see `src/tests/hcp-enrollment.spec.ts`'s describe-block
comment) with roughly a 1-in-3 to 1-in-4 live pass rate. This framework
attempts it once per run and skips the `hcp_success_default` capture (logging a
warning) rather than retrying - re-run `screenshots:*` if you need that one
capture and it was skipped.
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/screenshots/core/index.ts src/screenshots/pages/index.ts src/screenshots/runner/index.ts src/screenshots/README.md
git commit -m "docs: add screenshot framework README and barrel exports"
```

---

### Task 11: Full live acceptance run (both paths, one resolution)

**Files:** none (verification only)

**Interfaces:** none (exercises the fully assembled framework end-to-end)

- [ ] **Step 1: Run the combined script for the smallest/fastest resolution**

Run: `npm run screenshots:xsMobile`

- [ ] **Step 2: Verify two complete run folders exist**

```bash
ls "screenshots/PortalAutomation"
```

Expected: 2 timestamped directories (one for the Patient path run, one for the HCP path run), each containing `xsMobile_chrome/PNG/all screenshots/` and `xsMobile_chrome/PDF/`.

- [ ] **Step 3: Verify the Patient path run has all 14 named captures, in order**

```bash
ls "screenshots/PortalAutomation/<patient-run-timestamp>/xsMobile_chrome/PNG/all screenshots"
```

Expected: `01_patient_landing_default.png` ... `14_patient_success_default.png`, no gaps, no duplicates.

- [ ] **Step 4: Verify the Patient path PDF has 14 pages**

```bash
npx tsx -e "
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
(async () => {
  const files = fs.readdirSync('screenshots/PortalAutomation').filter(d => d !== '');
  console.log(files);
})();
"
```

(Inspect the newest run folder's `PDF/*.pdf` and confirm with `PDFDocument.load` + `getPageCount() === 14` for the Patient path PDF, `=== 11` or `12` for the HCP path PDF depending on whether the flaky terminal submit succeeded on this attempt.)

- [ ] **Step 5: Confirm no regressions in the existing test suite**

Run: `npx playwright test`
Expected: unchanged from before this framework was added - `src/tests/*.spec.ts` still pass/fail exactly as they did previously (this framework only imports from `src/pages`/`src/modules`, never modifies them).

- [ ] **Step 6: Clean up scratch run artifacts from this verification task (optional)**

```bash
rm -rf screenshots
```

(Only if the user doesn't want the verification run's output committed/kept - `screenshots/` should also be added to `.gitignore` if it isn't already, since these are generated artifacts.)

- [ ] **Step 7: Add `screenshots/` to `.gitignore` if not already present**

Check `.gitignore` for a `screenshots/` (or `screenshots`) entry; if missing, append it, since this directory holds generated run output, not source.

- [ ] **Step 8: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore generated screenshots/ output directory"
```
