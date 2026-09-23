# Onboard Summit Ivonescimab as a Second Program — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onboard Summit Therapeutics' Ivonescimab ("BIVTUO With You") portal as
this repo's second program, as far as its Patient enrollment flow can
currently go live (landing → eligibility → Patient Information), and produce
a reusable `docs/onboarding-new-program.md` guide validated by this real
onboarding.

**Architecture:** Three tasks. Task 1 scaffolds the program's core Playwright
test suite (pages, testdata, fixtures, config) and wires it into
`playwright.config.ts`/`package.json`, verified by 3 live tests. Task 2 builds
the screenshot-framework equivalent and applies the program-prefixed
screenshot-script naming scheme to *both* programs (a deferred decision from
the original restructuring plan, decided now that a second program exists).
Task 3 writes the reusable onboarding guide and trims `CLAUDE.md` to point at
it, using Tasks 1–2 as the worked example.

**Tech Stack:** TypeScript, Playwright Test, tsx, dotenv, Git. Live target:
`https://portal-qa.trialcard.com/summit/ivonescimab/` (same TrialCard-family
Vuetify SPA platform as `apotex-evdi` — confirmed via matching field names,
spinner class, and virtualized State dropdown behavior).

## Global Constraints

- `tsconfig.json` defines no path aliases — every import in this plan uses
  explicit relative paths, even several `../` deep.
- `.env` files are gitignored already (anchored `/screenshots/` and
  unanchored `.env` patterns both already correct) — never write a real
  secret into any committed file. `src/programs/summit-ivonescimab/.env` is
  optional in practice, since `config/index.ts`'s fallback already matches
  the real QA host, but create it anyway for parity with `apotex-evdi` and
  to keep the `.env`-per-program convention visible.
- This program's base-URL env var must be namespaced:
  `SUMMIT_IVONESCIMAB_BASE_URL`, never a bare `BASE_URL`.
- `PROGRAM_KEY` (output-folder isolation) and `PROGRAM_NAME` (cosmetic PDF
  label) are separate constants — do not conflate them. `PROGRAM_KEY` must
  equal this program's `src/programs/<key>` folder name.
- Zero behavior change to the existing `apotex-evdi` program or
  `src/shared/screenshots-engine/`, except the deliberate, called-out
  screenshot-script rename in Task 2.
- **Explicitly out of scope this round** (see
  `docs/superpowers/specs/2026-09-23-summit-ivonescimab-onboarding-design.md`
  for the full rationale): HCP role, Pharmacy role, Patient's standalone
  "Patient Consent" action, `PatientConsentPage`, `SuccessPage`, and the
  full happy-path "completes enrollment successfully end to end" test. The
  Patient Information → Consent transition is currently broken on the live
  QA site (reproducible client-side error `FHERequestConsiderationQuestion`,
  no network request even fires) — do not build Consent/Success pages
  against unverified/unseen DOM. If this plan's implementer independently
  finds the bug fixed, that unblocks follow-up work but is still out of
  scope for *this* plan — flag it and stop, don't expand scope mid-plan.
- Every value in this plan (field names, question wording, error message
  text, heading text, dropdown behavior) was confirmed against the live site
  on 2026-09-23 — see the design spec for the exact verification commands
  used. Do not second-guess these as guesses; they're transcribed from real
  DOM/CSS inspection.
- Running the tests and screenshot scripts performs real submissions against
  the shared QA host — this is a live external system, not a mock, same as
  `apotex-evdi`.

---

### Task 1: Scaffold the Summit Ivonescimab test suite (landing → eligibility → Patient Information)

**Files:**
- Create: `src/programs/summit-ivonescimab/testdata/types.ts`
- Create: `src/programs/summit-ivonescimab/pages/LandingPage.ts`
- Create: `src/programs/summit-ivonescimab/pages/EligibilityPage.ts`
- Create: `src/programs/summit-ivonescimab/pages/PatientInformationPage.ts`
- Create: `src/programs/summit-ivonescimab/pages/NotEligiblePage.ts`
- Create: `src/programs/summit-ivonescimab/fixtures/index.ts`
- Create: `src/programs/summit-ivonescimab/utils/DataGenerator.ts`
- Create: `src/programs/summit-ivonescimab/utils/deviceBrowsers.ts`
- Create: `src/programs/summit-ivonescimab/utils/index.ts`
- Create: `src/programs/summit-ivonescimab/config/index.ts`
- Create: `src/programs/summit-ivonescimab/tests/patient-enrollment.spec.ts`
- Create: `src/programs/summit-ivonescimab/.env` (not git-tracked)
- Modify: `playwright.config.ts`
- Modify: `package.json` (add `test:summit-ivonescimab` only — screenshot
  scripts are Task 2)

**Interfaces:**
- Produces: `PortalRole = 'patient'`, `PortalAction = 'enrollCopay'`,
  `EligibilityAnswers` (5 boolean fields), `PatientInformationData` (same
  shape as Apotex's), all from `testdata/types.ts` — Task 2's screenshot
  files consume these exact names.
- Produces: `LandingPage`, `EligibilityPage`, `PatientInformationPage`,
  `NotEligiblePage` classes and the `test`/`expect` re-exports from
  `fixtures/index.ts` — Task 2 imports the page classes directly (screenshot
  code doesn't use fixtures, matching the `apotex-evdi` convention).
- Produces: `generatePatientInformation()` from `utils/DataGenerator.ts`,
  `RESOLUTIONS`/`BROWSERS`/`DEFAULT_BROWSER`/`EXECUTION_MODE`/`PROGRAM_NAME`/
  `PROGRAM_KEY`/`SPINNER_SELECTOR`/`getResolution`/`getBrowser` from
  `utils/deviceBrowsers.ts` — both consumed directly by Task 2's screenshot
  runner files (not through `utils/index.ts`, matching `apotex-evdi`'s own
  runner files' import style).
- Produces: `config: PortalConfig` (`{ baseURL: string }`) from
  `config/index.ts` — consumed by Task 2's `run-patient-path.ts`.

- [ ] **Step 1: Create `testdata/types.ts`**

```ts
export type PortalRole = 'patient';
export type PortalAction = 'enrollCopay';

export interface EligibilityAnswers {
  enrolledInFederalOrStateProgram: boolean;
  isAdult: boolean;
  livesInUsOrTerritories: boolean;
  hasCommercialInsurance: boolean;
  agreesToTerms: boolean;
}

export interface PatientInformationData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Prefer not to answer';
  addressLine1: string;
  addressLine2?: string;
  zipCode: string;
  city: string;
  state: string;
  mobilePhone: string;
  homePhone?: string;
  email: string;
}
```

Only `patient`/`enrollCopay` exist in `PortalRole`/`PortalAction` — HCP and
Pharmacy roles, and Patient's other action ("Patient Consent"), are
explicit follow-up work (see Global Constraints), not pre-built as unused
placeholder union members.

- [ ] **Step 2: Create `pages/LandingPage.ts`**

```ts
import { Page, Locator } from '@playwright/test';
import { PortalRole, PortalAction } from '../testdata/types';

const ACTION_LABEL: Record<PortalRole, Record<PortalAction, string>> = {
  patient: {
    enrollCopay: 'Enroll in Co-pay Assistance',
  },
};

export class LandingPage {
  readonly page: Page;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async goto(): Promise<void> {
    // Same rationale as apotex-evdi's LandingPage.goto(): baseURL already
    // includes a subpath (.../summit/ivonescimab/), so goto('') preserves it
    // instead of resolving to the shared QA host's unrelated root tenant.
    await this.page.goto('');
  }

  async selectRoleAction(role: PortalRole, action: PortalAction): Promise<void> {
    const label = ACTION_LABEL[role][action];
    // Unlike Apotex's single combined role+action selector, this site renders
    // 3 separate role-cards (Healthcare Provider / Patient / Pharmacy), each
    // with its own action radiogroup - confirmed live: selecting one role's
    // action disables the other two cards' radios. Every action label across
    // all 3 cards is unique text on the page, so no radiogroup-index scoping
    // is needed (unlike Apotex's `.nth(ROLE_RADIOGROUP_INDEX[role])`).
    // Same Vuetify ripple-intercepted-radio quirk as Apotex (confirmed live):
    // click the visible label text, not the underlying input.
    await this.page.getByText(label, { exact: true }).click();
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
```

- [ ] **Step 3: Create `pages/EligibilityPage.ts`**

```ts
import { Page, Locator } from '@playwright/test';
import { EligibilityAnswers } from '../testdata/types';

export class EligibilityPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Patient Eligibility' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  private async answerQuestion(index: number, answerYes: boolean): Promise<void> {
    const radiogroup = this.page.getByRole('radiogroup').nth(index);
    // Same Vuetify ripple-intercepted-radio quirk as Apotex (confirmed live).
    await radiogroup.getByText(answerYes ? 'Yes' : 'No', { exact: true }).click();
  }

  // Question order confirmed live, 2026-09-23, on
  // https://portal-qa.trialcard.com/summit/ivonescimab/patient/eligibility/ :
  //   0. Enrolled in a federal/state-subsidized healthcare program? (No = eligible)
  //   1. 18 years of age or older? (Yes = eligible)
  //   2. Currently live in the United States or its territories? (Yes = eligible)
  //   3. Currently have commercial insurance that covers BIVTUO? (Yes = eligible)
  //   4. Agree to terms and conditions? (Yes = eligible)
  async answer(answers: EligibilityAnswers): Promise<void> {
    await this.answerQuestion(0, answers.enrolledInFederalOrStateProgram);
    await this.answerQuestion(1, answers.isAdult);
    await this.answerQuestion(2, answers.livesInUsOrTerritories);
    await this.answerQuestion(3, answers.hasCommercialInsurance);
    await this.answerQuestion(4, answers.agreesToTerms);
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
```

- [ ] **Step 4: Create `pages/NotEligiblePage.ts`**

```ts
import { Page, Locator, expect } from '@playwright/test';

export class NotEligiblePage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Confirmed live, 2026-09-23: "Thank you for your request" - no
    // exclamation mark, unlike Apotex's "Thank you for your request!".
    this.heading = page.getByRole('heading', { name: 'Thank you for your request' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/not-eligible/);
    await expect(this.heading).toBeVisible();
  }
}
```

- [ ] **Step 5: Create `pages/PatientInformationPage.ts`**

```ts
import { Page, Locator, expect } from '@playwright/test';
import { PatientInformationData } from '../testdata/types';

export class PatientInformationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Patient Information' });
    this.continueButton = page.getByRole('button', { name: 'Next' });
  }

  private field(name: string): Locator {
    // Same Vuetify combobox-proxy quirk as Apotex, confirmed live via DOM
    // inspection: gender/state render a second, hidden
    // `<input type="hidden" name="...">` proxy sharing the same `name`
    // attribute as the visible combobox input. Excluding hidden inputs scopes
    // this to the single interactive element for every field.
    return this.page.locator(`input[name="${name}"]:not([type="hidden"])`);
  }

  // Same route-transition-collision guard as Apotex's PatientInformationPage:
  // waiting for this page's own heading guarantees the real form (and its
  // "Next" button) has mounted before any interaction, rather than racing the
  // previous page's identically-named button.
  private async waitUntilReady(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  // Field `name` attributes confirmed live, 2026-09-23, via
  // `document.querySelectorAll('input, [role="combobox"]')` on
  // https://portal-qa.trialcard.com/summit/ivonescimab/patient/patient-information/ :
  // firstName, lastName, dateOfBirth, gender, addressOne, addressTwo, zip,
  // city, state, patientPhone, patientHomePhone, email - identical to
  // Apotex's field names.
  async fill(data: PatientInformationData): Promise<void> {
    await this.waitUntilReady();
    await this.field('firstName').fill(data.firstName);
    await this.field('lastName').fill(data.lastName);
    await this.field('dateOfBirth').fill(data.dateOfBirth);
    await this.selectComboboxOption('gender', data.gender);
    await this.field('addressOne').fill(data.addressLine1);
    if (data.addressLine2) {
      await this.field('addressTwo').fill(data.addressLine2);
    }
    await this.field('zip').fill(data.zipCode);
    await this.field('city').fill(data.city);
    await this.selectStateOption(data.state);
    await this.field('patientPhone').fill(data.mobilePhone);
    if (data.homePhone) {
      await this.field('patientHomePhone').fill(data.homePhone);
    }
    await this.field('email').fill(data.email);
  }

  private async selectComboboxOption(fieldName: string, optionName: string): Promise<void> {
    await this.field(fieldName).click();
    await this.page.getByRole('option', { name: optionName, exact: true }).click();
  }

  private async selectStateOption(stateName: string): Promise<void> {
    await this.field('state').click();
    const listbox = this.page.getByRole('listbox');
    const option = this.page.getByRole('option', { name: stateName, exact: true });
    // Confirmed live, 2026-09-23: same virtualized State dropdown as Apotex
    // (20 options initially rendered, `max-height: 304px`,
    // `overflow-y: auto`) - scroll-loop until the target option mounts.
    for (let attempt = 0; attempt < 20 && (await option.count()) === 0; attempt++) {
      await listbox.hover();
      await this.page.mouse.wheel(0, 300);
    }
    await option.click();
  }

  async submit(): Promise<void> {
    await this.waitUntilReady();
    await this.continueButton.click();
  }

  async expectValidationErrorCount(count: number): Promise<void> {
    // Confirmed live, 2026-09-23: submitting empty shows "There are 10
    // errors" (10 required fields: firstName, lastName, dateOfBirth, gender,
    // addressOne, zip, city, state, patientPhone, email - addressTwo and
    // patientHomePhone are optional), same message format as Apotex.
    await expect(this.page.getByText(`There are ${count} errors`, { exact: true })).toBeVisible();
  }
}
```

Note: this page object does not build `selectStateOption`/`fill` support for
anything past this page (no `submit({ extraPreClickWaitMs })` HCP variant,
no "Submit" button-text alternative) — those exist in Apotex's version only
because its HCP path terminates on this page; Summit's HCP path isn't built
this round.

- [ ] **Step 6: Create `fixtures/index.ts`**

```ts
import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { NotEligiblePage } from '../pages/NotEligiblePage';
import { PatientInformationPage } from '../pages/PatientInformationPage';

interface PortalFixtures {
  landingPage: LandingPage;
  eligibilityPage: EligibilityPage;
  notEligiblePage: NotEligiblePage;
  patientInfoPage: PatientInformationPage;
}

export const test = base.extend<PortalFixtures>({
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },
  eligibilityPage: async ({ page }, use) => {
    await use(new EligibilityPage(page));
  },
  notEligiblePage: async ({ page }, use) => {
    await use(new NotEligiblePage(page));
  },
  patientInfoPage: async ({ page }, use) => {
    await use(new PatientInformationPage(page));
  },
});

export { expect } from '@playwright/test';
```

No `modules/` folder or `PatientEnrollmentModule` this round: every test this
round calls page objects directly (matching how Apotex's own not-eligible/
validation-error/continues-to-patient-info tests already work, without using
its `patientEnrollment` module fixture) — a module composing a 2-step flow
that no test exercises would be unused, untested code. Build it alongside the
Consent/Success follow-up work, when there's an actual multi-step flow worth
composing.

- [ ] **Step 7: Create `utils/DataGenerator.ts`**

```ts
import { faker } from '@faker-js/faker';
import { PatientInformationData } from '../testdata/types';

function generateDateOfBirth(): string {
  const birthdate = faker.date.birthdate({ min: 18, max: 100, mode: 'age' });
  const mm = String(birthdate.getMonth() + 1).padStart(2, '0');
  const dd = String(birthdate.getDate()).padStart(2, '0');
  const yyyy = birthdate.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function generateMobilePhone(): string {
  // NANP-style: 1st (area code) and 4th (exchange code) digits must not be 0 or 1.
  const digit = () => faker.number.int({ min: 0, max: 9 });
  const leadingDigit = () => faker.number.int({ min: 2, max: 9 });
  const digits = [
    leadingDigit(),
    digit(),
    digit(),
    leadingDigit(),
    digit(),
    digit(),
    digit(),
    digit(),
    digit(),
    digit(),
  ];
  return digits.join('');
}

export function generatePatientInformation(): PatientInformationData {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    dateOfBirth: generateDateOfBirth(),
    gender: 'Prefer not to answer',
    addressLine1: faker.location.streetAddress(),
    zipCode: '10010',
    city: 'New York',
    state: 'New York',
    mobilePhone: generateMobilePhone(),
    email: faker.internet.email(),
  };
}
```

Identical to Apotex's generator — same field shape, same static
zip/city/state values (confirmed live: Summit's zip-code field triggers a
`GET .../location/v1/City?zipCode=...` lookup call, but a manually-typed City
value is not overwritten by it, so the static "New York"/"10010" pairing is
safe to reuse as-is).

- [ ] **Step 8: Create `utils/deviceBrowsers.ts`**

```ts
// Single source of truth for device/browser/execution settings used by the
// screenshot framework under src/programs/summit-ivonescimab/screenshots/.
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
// - Onboarding a new program (copying this whole folder): PROGRAM_KEY MUST
//   be changed to that program's own src/programs/<key> folder name. It's
//   what actually keeps two programs' screenshot output directories from
//   colliding - PROGRAM_NAME alone is just a cosmetic label used in PDF
//   filenames and does not guarantee uniqueness.

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

// Valid values: chrome, edge, firefox, safari.
export const DEFAULT_BROWSER: BrowserName = 'chrome';

export type ExecutionMode = 'headless' | 'headed';
export const EXECUTION_MODE: ExecutionMode = 'headed';

export const PROGRAM_NAME = 'BivtuoWithYou';

// Matches this program's own src/programs/<PROGRAM_KEY> folder name. Used
// only to partition screenshot output (screenshots/<PROGRAM_KEY>/...) so a
// second program's captures can never land in this one's folder even if its
// PROGRAM_NAME brand label was copy-pasted without changing.
export const PROGRAM_KEY = 'summit-ivonescimab';

// Confirmed live, 2026-09-23: Summit's loaded stylesheet contains the exact
// same `.half-circle-spinner` CSS rules (including `circle-1`/`circle-2`
// sub-selectors and keyframe animation name) as Apotex's — same platform,
// same overlay component. Passed into the shared screenshot engine's
// `createRunContext(...)` so it can wait for it without the shared engine
// hardcoding any program-specific selector.
export const SPINNER_SELECTOR = '.half-circle-spinner';

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

- [ ] **Step 9: Create `utils/index.ts`**

```ts
export { generatePatientInformation } from './DataGenerator';
export * from './deviceBrowsers';
```

- [ ] **Step 10: Create `config/index.ts`**

```ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export interface PortalConfig {
  baseURL: string;
}

export const config: PortalConfig = {
  baseURL: process.env.SUMMIT_IVONESCIMAB_BASE_URL ?? 'https://portal-qa.trialcard.com/summit/ivonescimab/',
};
```

- [ ] **Step 11: Create `src/programs/summit-ivonescimab/.env`**

```
SUMMIT_IVONESCIMAB_BASE_URL=https://portal-qa.trialcard.com/summit/ivonescimab/
```

Not git-tracked (matches `apotex-evdi/.env`'s existing convention — verify
with `git status` that this file does not appear as untracked-to-be-added
after this step; if it does, the gitignore pattern needs investigating before
continuing).

- [ ] **Step 12: Add the `summit-ivonescimab` project to `playwright.config.ts`**

Current relevant section:
```ts
dotenv.config({ path: path.resolve(__dirname, 'src/programs/apotex-evdi/.env') });
// Onboarding a new program: add another dotenv.config({ path: ... }) call
// here pointing at that program's own .env file. Because every program's
// base-URL var is namespaced (e.g. APOTEX_EVDI_BASE_URL), loading multiple
// programs' .env files into this one process is safe — dotenv won't
// override a key that's already set, and there's no shared key to collide.

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'apotex-evdi',
      testDir: './src/programs/apotex-evdi/tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.APOTEX_EVDI_BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/',
      },
    },
    // Onboarding a new program: add one entry here, e.g.
    // {
    //   name: '<new-program>',
    //   testDir: './src/programs/<new-program>/tests',
    //   use: {
    //     ...devices['Desktop Chrome'],
    //     baseURL: process.env.<NEW_PROGRAM>_BASE_URL ?? '<new-program-default-url>',
    //   },
    // },
  ],
});
```

Replace with:
```ts
dotenv.config({ path: path.resolve(__dirname, 'src/programs/apotex-evdi/.env') });
dotenv.config({ path: path.resolve(__dirname, 'src/programs/summit-ivonescimab/.env') });
// Onboarding a new program: add another dotenv.config({ path: ... }) call
// here pointing at that program's own .env file. Because every program's
// base-URL var is namespaced (e.g. APOTEX_EVDI_BASE_URL), loading multiple
// programs' .env files into this one process is safe — dotenv won't
// override a key that's already set, and there's no shared key to collide.

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'apotex-evdi',
      testDir: './src/programs/apotex-evdi/tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.APOTEX_EVDI_BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/',
      },
    },
    {
      name: 'summit-ivonescimab',
      testDir: './src/programs/summit-ivonescimab/tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.SUMMIT_IVONESCIMAB_BASE_URL ?? 'https://portal-qa.trialcard.com/summit/ivonescimab/',
      },
    },
    // Onboarding a new program: add one entry here, e.g.
    // {
    //   name: '<new-program>',
    //   testDir: './src/programs/<new-program>/tests',
    //   use: {
    //     ...devices['Desktop Chrome'],
    //     baseURL: process.env.<NEW_PROGRAM>_BASE_URL ?? '<new-program-default-url>',
    //   },
    // },
  ],
});
```

- [ ] **Step 13: Add `test:summit-ivonescimab` to `package.json`**

Current line:
```json
    "test:apotex-evdi": "playwright test --project=apotex-evdi",
```
Replace with:
```json
    "test:apotex-evdi": "playwright test --project=apotex-evdi",
    "test:summit-ivonescimab": "playwright test --project=summit-ivonescimab",
```

- [ ] **Step 14: Create `tests/patient-enrollment.spec.ts`**

```ts
import { test, expect } from '../fixtures';
import { EligibilityAnswers } from '../testdata/types';
import { generatePatientInformation } from '../utils/DataGenerator';

const eligibleAnswers: EligibilityAnswers = {
  enrolledInFederalOrStateProgram: false,
  isAdult: true,
  livesInUsOrTerritories: true,
  hasCommercialInsurance: true,
  agreesToTerms: true,
};

const ineligibleAnswers: EligibilityAnswers = {
  ...eligibleAnswers,
  enrolledInFederalOrStateProgram: true,
};

test.describe('Patient enrollment', () => {
  test('routes to the not-eligible page when enrolled in a federal/state program', async ({
    landingPage,
    eligibilityPage,
    notEligiblePage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'enrollCopay');
    await landingPage.goNext();

    await eligibilityPage.answer(ineligibleAnswers);
    await eligibilityPage.goNext();

    await notEligiblePage.expectVisible();
  });

  test('continues to the Patient Information step with eligible answers', async ({
    page,
    landingPage,
    eligibilityPage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'enrollCopay');
    await landingPage.goNext();

    await eligibilityPage.answer(eligibleAnswers);
    await eligibilityPage.goNext();

    await expect(page).toHaveURL(/patient\/patient-information/);
  });

  test('shows a validation error per required field when submitted empty', async ({
    landingPage,
    eligibilityPage,
    patientInfoPage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'enrollCopay');
    await landingPage.goNext();

    await eligibilityPage.answer(eligibleAnswers);
    await eligibilityPage.goNext();

    await patientInfoPage.submit();
    await patientInfoPage.expectValidationErrorCount(10);
  });
});
```

3 tests (not 4, matching Apotex's depth minus the blocked happy-path test —
see Global Constraints).

- [ ] **Step 15: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 16: Run the new tests live**

Run: `npx playwright test --project=summit-ivonescimab`
Expected: 3/3 passing. If any fail, this is real TDD red-green feedback, not
a plan defect to route around — inspect the failure (Playwright's HTML
report / trace via `npm run report`, or a fresh live browser check of the
specific page) and fix the page object, not the test's expectations, unless
live inspection shows the transcribed fact above was actually wrong.

- [ ] **Step 17: Run the existing Apotex suite to confirm zero regression**

Run: `npx playwright test --project=apotex-evdi`
Expected: same pass/fail outcome as before this task (the HCP spec's
documented flaky terminal-submit defect, independent of this change, is not
a regression to chase).

- [ ] **Step 18: Commit**

```bash
git add src/programs/summit-ivonescimab/testdata src/programs/summit-ivonescimab/pages src/programs/summit-ivonescimab/fixtures src/programs/summit-ivonescimab/utils src/programs/summit-ivonescimab/config src/programs/summit-ivonescimab/tests playwright.config.ts package.json
git commit -m "Scaffold Summit Ivonescimab test suite (landing -> eligibility -> Patient Information)"
```

(`.env` stays untracked, per Global Constraints.)

---

### Task 2: Screenshot framework for Summit Ivonescimab + program-prefixed script naming for both programs

**Files:**
- Create: `src/programs/summit-ivonescimab/screenshots/core/dropdownExpander.ts`
- Create: `src/programs/summit-ivonescimab/screenshots/core/index.ts`
- Create: `src/programs/summit-ivonescimab/screenshots/pages/01_homePage.screenshot.ts`
- Create: `src/programs/summit-ivonescimab/screenshots/pages/02_patientPath.screenshot.ts`
- Create: `src/programs/summit-ivonescimab/screenshots/pages/index.ts`
- Create: `src/programs/summit-ivonescimab/screenshots/runner/run-all.ts`
- Create: `src/programs/summit-ivonescimab/screenshots/runner/run-patient-path.ts`
- Create: `src/programs/summit-ivonescimab/screenshots/runner/run-all-resolutions.ts`
- Create: `src/programs/summit-ivonescimab/screenshots/runner/index.ts`
- Modify: `package.json` (rename Apotex's 7 screenshot scripts, add 7 new
  Summit ones)
- Modify: `CLAUDE.md` (Commands + Screenshot framework sections only — the
  onboarding paragraph and Multi-program layout diagram are Task 3)

**Interfaces:**
- Consumes from Task 1: `PortalRole`, `LandingPage`, `EligibilityPage`,
  `PatientInformationPage`, `NotEligiblePage`, `EligibilityAnswers`,
  `generatePatientInformation()`, `config.baseURL`, and every
  `utils/deviceBrowsers.ts` export listed in Task 1's Interfaces.
- Consumes from `src/shared/screenshots-engine/screenshotHelper.ts`
  (unchanged): `RunContext`, `capture(page, context, name, heightOptions?)`,
  `buildRunTimestamp()`, `createRunContext(programName, programKey,
  deviceType, runTimestamp, spinnerSelector?, resolutionName?)`,
  `resetSequence()`, `pdfOutputPath()`. From `pdfMerger.ts`:
  `mergePngsToPdf()`.

- [ ] **Step 1: Create `screenshots/core/dropdownExpander.ts`**

```ts
import { Page, Locator, expect } from '@playwright/test';

function genderField(page: Page) {
  return page.locator('input[name="gender"]:not([type="hidden"])');
}

function stateField(page: Page) {
  return page.locator('input[name="state"]:not([type="hidden"])');
}

// Click a combobox field and wait for its listbox to open, retrying the
// click once if it doesn't. Ported from Apotex's dropdownExpander.ts, which
// documents this same race live on its own xsMobile viewport - not
// independently re-verified for Summit, but kept as a defensive retry since
// it's harmless if unneeded and this is the same underlying Vuetify combobox
// component.
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
  await openListbox(page, stateField(page));
}

export async function closeDropdown(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
}
```

- [ ] **Step 2: Create `screenshots/core/index.ts`**

```ts
export * from './dropdownExpander';
```

- [ ] **Step 3: Create `screenshots/pages/01_homePage.screenshot.ts`**

```ts
import { Page } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { PortalRole } from '../../testdata/types';
import { RunContext, capture } from '../../../../shared/screenshots-engine/screenshotHelper';

export async function captureHomePage(page: Page, context: RunContext, role: PortalRole): Promise<void> {
  const landingPage = new LandingPage(page);

  await landingPage.goto();
  await page.waitForTimeout(3000);
  await capture(page, context, `${role}_landing_default`);

  await landingPage.selectRoleAction(role, 'enrollCopay');
  await capture(page, context, `${role}_landing_roleSelected`);

  await landingPage.goNext();
}
```

- [ ] **Step 4: Create `screenshots/pages/02_patientPath.screenshot.ts`**

```ts
import { Page, expect } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { EligibilityPage } from '../../pages/EligibilityPage';
import { PatientInformationPage } from '../../pages/PatientInformationPage';
import { NotEligiblePage } from '../../pages/NotEligiblePage';
import { EligibilityAnswers } from '../../testdata/types';
import { generatePatientInformation } from '../../utils/DataGenerator';
import { RunContext, capture } from '../../../../shared/screenshots-engine/screenshotHelper';
import { expandGenderDropdown, expandStateDropdown, closeDropdown } from '../core/dropdownExpander';

const eligibleAnswers: EligibilityAnswers = {
  enrolledInFederalOrStateProgram: false,
  isAdult: true,
  livesInUsOrTerritories: true,
  hasCommercialInsurance: true,
  agreesToTerms: true,
};

const ineligibleAnswers: EligibilityAnswers = {
  ...eligibleAnswers,
  enrolledInFederalOrStateProgram: true,
};

export async function capturePatientPath(page: Page, context: RunContext): Promise<void> {
  const eligibilityPage = new EligibilityPage(page);
  const patientInfoPage = new PatientInformationPage(page);
  const notEligiblePage = new NotEligiblePage(page);
  const landingPage = new LandingPage(page);

  await expect(eligibilityPage.heading).toBeVisible();
  await capture(page, context, 'patient_eligibility_default');
  await eligibilityPage.nextButton.click();
  await capture(page, context, 'patient_eligibility_validationError');

  await eligibilityPage.answer(ineligibleAnswers);
  await eligibilityPage.goNext();
  await notEligiblePage.expectVisible();
  await capture(page, context, 'patient_notEligible_default');

  await landingPage.goto();
  await landingPage.selectRoleAction('patient', 'enrollCopay');
  await landingPage.goNext();

  await eligibilityPage.answer(eligibleAnswers);
  await capture(page, context, 'patient_eligibility_answered');
  await eligibilityPage.goNext();

  await expect(patientInfoPage.heading).toBeVisible();
  await capture(page, context, 'patient_patientInformation_default');

  await expandGenderDropdown(page);
  await capture(page, context, 'patient_patientInformation_genderExpanded');
  await closeDropdown(page);

  await expandStateDropdown(page);
  // No capHeightPx yet, unlike Apotex's equivalent capture - Apotex's exact
  // px values (2946/3200/3966 etc.) were tuned from ITS OWN natural page
  // heights and must not be assumed to transfer to a differently-branded
  // page. Step 8 below checks this capture's actual dimensions live and adds
  // capHeightPx here (following screenshotHelper.ts's CaptureHeightOptions
  // pattern) only if dead space is actually observed.
  await capture(page, context, 'patient_patientInformation_stateExpanded');
  await closeDropdown(page);

  await patientInfoPage.submit();
  await patientInfoPage.expectValidationErrorCount(10);
  await capture(page, context, 'patient_patientInformation_validationError_10errors');

  const patientData = generatePatientInformation();
  await patientInfoPage.fill(patientData);
  await capture(page, context, 'patient_patientInformation_filled');

  // Does NOT proceed past this point: the Patient Information -> Consent
  // transition is blocked by a live QA bug (see
  // docs/superpowers/specs/2026-09-23-summit-ivonescimab-onboarding-design.md).
  // PatientConsentPage/SuccessPage captures are follow-up work once the bug
  // is fixed - do not add capture calls here for pages that don't exist yet.
}
```

- [ ] **Step 5: Create `screenshots/pages/index.ts`**

```ts
export * from './01_homePage.screenshot';
export * from './02_patientPath.screenshot';
```

- [ ] **Step 6: Create `screenshots/runner/run-patient-path.ts`**

```ts
import { chromium, firefox, webkit, Browser, Page } from '@playwright/test';
import {
  BrowserDefinition,
  BrowserName,
  DEFAULT_BROWSER,
  EXECUTION_MODE,
  PROGRAM_KEY,
  PROGRAM_NAME,
  SPINNER_SELECTOR,
  getBrowser,
  getResolution,
} from '../../utils/deviceBrowsers';
import { config } from '../../config';
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../../../../shared/screenshots-engine/screenshotHelper';
import { mergePngsToPdf } from '../../../../shared/screenshots-engine/pdfMerger';
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

export async function runPatientPath(
  resolutionName: string,
  browserName: BrowserName = DEFAULT_BROWSER,
  sharedContext?: RunContext
): Promise<RunContext> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName);
  const deviceType = `${resolution.name}_${browserDef.name}`;

  console.log(`Running screenshots against: ${config.baseURL} (resolution: ${resolutionName}, browser: ${browserDef.name})`);

  let context: RunContext;
  if (sharedContext) {
    context = sharedContext;
  } else {
    const runTimestamp = buildRunTimestamp();
    resetSequence();
    context = createRunContext(PROGRAM_NAME, PROGRAM_KEY, deviceType, runTimestamp, SPINNER_SELECTOR, resolution.name);
  }

  const browser = await launch(browserDef);
  const browserContext = await browser.newContext({
    baseURL: config.baseURL,
    viewport: { width: resolution.width, height: resolution.height },
  });
  // Same 60s override as Apotex's runner - a bare browserContext outside the
  // `playwright test` runner otherwise falls back to Playwright's hardcoded
  // 30s default action/navigation timeout.
  browserContext.setDefaultTimeout(60_000);
  browserContext.setDefaultNavigationTimeout(60_000);
  const page: Page = await browserContext.newPage();

  let captureError: unknown;
  try {
    await captureHomePage(page, context, 'patient');
    await capturePatientPath(page, context);
  } catch (error) {
    captureError = error;
  } finally {
    await browser.close();
  }

  if (!sharedContext) {
    const dateStamp = context.runTimestamp.split('_')[0];
    if (context.manifest.length > 0) {
      await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));
    }
  }

  if (captureError) {
    throw captureError;
  }

  console.log(`Completed: ${context.manifest.length} screenshots saved to ${context.pngDir}`);

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

- [ ] **Step 7: Create `screenshots/runner/run-all.ts`**

```ts
import {
  BrowserName,
  DEFAULT_BROWSER,
  PROGRAM_KEY,
  PROGRAM_NAME,
  SPINNER_SELECTOR,
  getBrowser,
  getResolution,
} from '../../utils/deviceBrowsers';
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../../../../shared/screenshots-engine/screenshotHelper';
import { mergePngsToPdf } from '../../../../shared/screenshots-engine/pdfMerger';
import { runPatientPath } from './run-patient-path';

export async function runAll(resolutionName: string, browserName?: BrowserName): Promise<void> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName ?? DEFAULT_BROWSER);
  const deviceType = `${resolution.name}_${browserDef.name}`;
  const runTimestamp = buildRunTimestamp();

  resetSequence();
  const context: RunContext = createRunContext(PROGRAM_NAME, PROGRAM_KEY, deviceType, runTimestamp, SPINNER_SELECTOR, resolution.name);

  let runError: unknown;
  try {
    // Patient path only this round - no HCP flow built yet (see the design
    // spec's Non-Goals).
    await runPatientPath(resolutionName, browserName, context);
  } catch (error) {
    runError = error;
  }

  const dateStamp = runTimestamp.split('_')[0];
  if (context.manifest.length > 0) {
    await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));
  }

  if (runError) {
    throw runError;
  }
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

- [ ] **Step 8: Create `screenshots/runner/run-all-resolutions.ts`**

```ts
import { RESOLUTIONS, BrowserName } from '../../utils/deviceBrowsers';
import { runAll } from './run-all';

async function runAllResolutions(browserName?: BrowserName): Promise<void> {
  const failures: string[] = [];
  for (const resolution of RESOLUTIONS) {
    console.log(`--- Running screenshot capture for resolution: ${resolution.name} ---`);
    try {
      await runAll(resolution.name, browserName);
    } catch (error) {
      console.error(`--- Resolution ${resolution.name} failed, continuing with remaining resolutions ---`, error);
      failures.push(resolution.name);
    }
  }
  if (failures.length > 0) {
    console.error(`Completed with failures for: ${failures.join(', ')}`);
    process.exitCode = 1;
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

This is a self-contained copy (not a shared, parameterized dispatcher) —
consistent with every other file in this program folder, and simpler than
threading a `--program=` argument through shared code for what's a
3-line loop.

- [ ] **Step 9: Create `screenshots/runner/index.ts`**

```ts
export * from './run-patient-path';
export * from './run-all';
export * from './run-all-resolutions';
```

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Rename Apotex's screenshot scripts and add Summit's, in `package.json`**

Current `scripts` block:
```json
  "scripts": {
    "test": "playwright test",
    "test:apotex-evdi": "playwright test --project=apotex-evdi",
    "test:summit-ivonescimab": "playwright test --project=summit-ivonescimab",
    "test:headed": "playwright test --headed",
    "report": "playwright show-report",
    "screenshots:xlDesktop": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=xlDesktop",
    "screenshots:lDesktop": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=lDesktop",
    "screenshots:desktop": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=Desktop",
    "screenshots:lTablet": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=lTablet",
    "screenshots:pTablet": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=pTablet",
    "screenshots:xsMobile": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=xsMobile",
    "screenshots:all": "tsx src/programs/apotex-evdi/screenshots/runner/run-all-resolutions.ts"
  },
```
Replace with:
```json
  "scripts": {
    "test": "playwright test",
    "test:apotex-evdi": "playwright test --project=apotex-evdi",
    "test:summit-ivonescimab": "playwright test --project=summit-ivonescimab",
    "test:headed": "playwright test --headed",
    "report": "playwright show-report",
    "screenshots:apotex-evdi:xlDesktop": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=xlDesktop",
    "screenshots:apotex-evdi:lDesktop": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=lDesktop",
    "screenshots:apotex-evdi:desktop": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=Desktop",
    "screenshots:apotex-evdi:lTablet": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=lTablet",
    "screenshots:apotex-evdi:pTablet": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=pTablet",
    "screenshots:apotex-evdi:xsMobile": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=xsMobile",
    "screenshots:apotex-evdi:all": "tsx src/programs/apotex-evdi/screenshots/runner/run-all-resolutions.ts",
    "screenshots:summit-ivonescimab:xlDesktop": "tsx src/programs/summit-ivonescimab/screenshots/runner/run-all.ts --device=xlDesktop",
    "screenshots:summit-ivonescimab:lDesktop": "tsx src/programs/summit-ivonescimab/screenshots/runner/run-all.ts --device=lDesktop",
    "screenshots:summit-ivonescimab:desktop": "tsx src/programs/summit-ivonescimab/screenshots/runner/run-all.ts --device=Desktop",
    "screenshots:summit-ivonescimab:lTablet": "tsx src/programs/summit-ivonescimab/screenshots/runner/run-all.ts --device=lTablet",
    "screenshots:summit-ivonescimab:pTablet": "tsx src/programs/summit-ivonescimab/screenshots/runner/run-all.ts --device=pTablet",
    "screenshots:summit-ivonescimab:xsMobile": "tsx src/programs/summit-ivonescimab/screenshots/runner/run-all.ts --device=xsMobile",
    "screenshots:summit-ivonescimab:all": "tsx src/programs/summit-ivonescimab/screenshots/runner/run-all-resolutions.ts"
  },
```

- [ ] **Step 12: Run Summit's xsMobile screenshot capture live**

Run: `npm run screenshots:summit-ivonescimab:xsMobile`
Expected: completes without throwing, prints
`Completed: N screenshots saved to ...screenshots/summit-ivonescimab/<timestamp>/xsMobile_chrome/PNG/all screenshots` and a PDF path under the sibling `PDF/` dir.

- [ ] **Step 13: Check the `patient_patientInformation_stateExpanded` capture for dead space below the footer**

Read the PNG dimensions of every capture in that run's `PNG/all screenshots/`
folder (same technique used earlier this session: parse each file's IHDR
chunk, or open the images directly) and compare
`patient_patientInformation_stateExpanded`'s height against the tallest
*other* capture in the same run. If it's dramatically taller (the Apotex
symptom was ~1000px+ of extra blank space below the footer), open the actual
PNG and visually confirm the dead space, then add a `capHeightPx` option to
that one `capture(...)` call in `02_patientPath.screenshot.ts`, following the
exact pattern (and its explanatory comment) already in Apotex's
`02_patientPath.screenshot.ts` — but with Summit's own measured numbers, not
Apotex's. If there's no meaningful height difference, leave the capture as-is
(no guessed `capHeightPx` value) and note in the commit message that this was
checked and found unnecessary.

- [ ] **Step 14: Run Apotex's xsMobile screenshot capture to confirm zero regression**

Run: `npm run screenshots:apotex-evdi:xsMobile`
Expected: same output shape as before this task (patient + HCP paths, same
PNG counts) — this specifically re-verifies the script rename didn't break
anything for the existing program.

- [ ] **Step 15: Update `CLAUDE.md`'s Commands and Screenshot-framework sections for the new script names**

Current:
```markdown
```bash
npm test                              # run every program's Playwright suite
npm run test:apotex-evdi              # run only the apotex-evdi program's suite
npm run test:headed                   # same, with a visible browser
npm run report                        # open the last HTML report (playwright-report/)
npx playwright test src/programs/apotex-evdi/tests/patient-enrollment.spec.ts   # run a single spec file
npx playwright test -g "routes to the not-eligible page"                        # run tests by title
```
```
Replace with:
```markdown
```bash
npm test                              # run every program's Playwright suite
npm run test:apotex-evdi              # run only the apotex-evdi program's suite
npm run test:summit-ivonescimab       # run only the summit-ivonescimab program's suite
npm run test:headed                   # same, with a visible browser
npm run report                        # open the last HTML report (playwright-report/)
npx playwright test src/programs/apotex-evdi/tests/patient-enrollment.spec.ts   # run a single spec file
npx playwright test -g "routes to the not-eligible page"                        # run tests by title
```
```

Current:
```markdown
### Screenshot framework (separate from the test suite)

\`\`\`bash
npm run screenshots:xlDesktop   # 1920x1080
npm run screenshots:lDesktop    # 1440x1080
npm run screenshots:desktop     # 1024x1080
npm run screenshots:lTablet     # 1280x800
npm run screenshots:pTablet     # 768x1024
npm run screenshots:xsMobile    # 375x1080
npm run screenshots:all         # every resolution above, sequentially

# ad hoc, without editing files:
npx tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=pTablet --browser=firefox
\`\`\`

Each run drives the Patient path fully, then the HCP path fully, using Chrome by
default. Output goes to `screenshots/apotex-evdi/<timestamp>/<resolution>_<browser>/`
(PNG + a merged PDF), and `screenshots/` is gitignored. The `apotex-evdi` segment comes
from `PROGRAM_KEY`, not `PROGRAM_NAME` — `PROGRAM_KEY` is what actually keeps two
programs' output from colliding (it must match this program's `src/programs/<key>`
folder name), while `PROGRAM_NAME` is just a cosmetic brand label used in PDF filenames
and does not guarantee uniqueness on its own. All resolution/browser/headless config
lives in one file: [src/programs/apotex-evdi/utils/deviceBrowsers.ts](src/programs/apotex-evdi/utils/deviceBrowsers.ts)
(`RESOLUTIONS`, `BROWSERS`, `DEFAULT_BROWSER`, `EXECUTION_MODE`, `PROGRAM_NAME`,
`PROGRAM_KEY`). Adding a resolution also requires a matching `screenshots:<name>` script
in `package.json`. See
[src/programs/apotex-evdi/screenshots/README.md](src/programs/apotex-evdi/screenshots/README.md)
for the full convention (naming, sequence numbering, where to add new captures).
```
Replace with:
```markdown
### Screenshot framework (separate from the test suite)

Scripts are program-prefixed (`screenshots:<program>:<resolution>`), since output must
stay isolated per program:

\`\`\`bash
npm run screenshots:apotex-evdi:xlDesktop         # 1920x1080
npm run screenshots:apotex-evdi:lDesktop          # 1440x1080
npm run screenshots:apotex-evdi:desktop           # 1024x1080
npm run screenshots:apotex-evdi:lTablet           # 1280x800
npm run screenshots:apotex-evdi:pTablet           # 768x1024
npm run screenshots:apotex-evdi:xsMobile          # 375x1080
npm run screenshots:apotex-evdi:all               # every resolution above, sequentially

npm run screenshots:summit-ivonescimab:xlDesktop  # same 6 resolutions + "all",
npm run screenshots:summit-ivonescimab:xsMobile   # for the summit-ivonescimab program

# ad hoc, without editing files:
npx tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=pTablet --browser=firefox
npx tsx src/programs/summit-ivonescimab/screenshots/runner/run-all.ts --device=pTablet --browser=firefox
\`\`\`

Apotex's run drives the Patient path fully, then the HCP path fully; Summit's currently
drives the Patient path only, up to Patient Information (see
[docs/onboarding-new-program.md](docs/onboarding-new-program.md) for why). Output goes to
`screenshots/<PROGRAM_KEY>/<timestamp>/<resolution>_<browser>/` (PNG + a merged PDF), and
`screenshots/` is gitignored. `PROGRAM_KEY` (e.g. `apotex-evdi`, `summit-ivonescimab`) is
what actually keeps two programs' output from colliding (it must match that program's
`src/programs/<key>` folder name); `PROGRAM_NAME` is just a cosmetic brand label used in
PDF filenames and does not guarantee uniqueness on its own. Each program's own
`utils/deviceBrowsers.ts` (e.g.
[src/programs/apotex-evdi/utils/deviceBrowsers.ts](src/programs/apotex-evdi/utils/deviceBrowsers.ts))
holds its `RESOLUTIONS`, `BROWSERS`, `DEFAULT_BROWSER`, `EXECUTION_MODE`, `PROGRAM_NAME`,
`PROGRAM_KEY`. Adding a resolution also requires a matching
`screenshots:<program>:<name>` script in `package.json`. See that program's own
`screenshots/README.md` for the full convention (naming, sequence numbering, where to
add new captures).
```

- [ ] **Step 16: Commit**

```bash
git add src/programs/summit-ivonescimab/screenshots package.json CLAUDE.md
git commit -m "Add Summit Ivonescimab screenshot framework; rename screenshots:* npm scripts to be program-prefixed"
```

---

### Task 3: Write the reusable onboarding guide and trim CLAUDE.md

**Files:**
- Create: `docs/onboarding-new-program.md`
- Modify: `CLAUDE.md` (the "Onboarding a new, similar program" paragraph and
  the "Multi-program layout" diagram only — Commands/Screenshot sections
  were Task 2)

**Interfaces:**
- Consumes: the finished Tasks 1–2 as the worked example (file paths,
  decisions made, the live-QA-bug encounter) — no new code interfaces
  produced, this task is documentation only.

- [ ] **Step 1: Create `docs/onboarding-new-program.md`**

```markdown
# Onboarding a New Program

A "program" in this repo is one similar site (e.g. a pharma co-pay/enrollment
portal) living entirely under `src/programs/<program-key>/`. This guide is a
generalized, step-by-step procedure for onboarding a new one, using the
Summit Ivonescimab ("BIVTUO With You") onboarding as the worked example
throughout — see
[docs/superpowers/specs/2026-09-23-summit-ivonescimab-onboarding-design.md](superpowers/specs/2026-09-23-summit-ivonescimab-onboarding-design.md)
and
[docs/superpowers/plans/2026-09-23-summit-ivonescimab-onboarding.md](superpowers/plans/2026-09-23-summit-ivonescimab-onboarding.md)
for the full detail behind each step below.

## Before you start: research the live site

Don't assume the new program's site works like the existing one(s) — verify.
For Summit Ivonescimab, live research (via a real browser, not guesswork)
found:

- The role/action model was structurally different from Apotex's (3 roles ×
  multiple actions each, vs. Apotex's 2 roles × 1 action) — this surfaced
  *before* any code was written, letting the round's scope be decided
  upfront (see "Decompose oversized scope" below) instead of discovered
  mid-implementation.
- The Patient Information form's field `name` attributes, the Gender
  dropdown's options, the State dropdown's virtualization behavior, and the
  route-transition spinner's CSS class were all confirmed **identical** to
  Apotex's, via direct DOM/CSS inspection (`document.querySelectorAll(...)`,
  `document.styleSheets` inspection) — not assumed from similar-looking
  screenshots. This is what let `PatientInformationPage.ts` and
  `dropdownExpander.ts` be ported near-verbatim instead of rewritten.

Do this research with a real browser tool before writing the design spec —
guessing at selectors from a rendered screenshot is how untested, silently-
wrong page objects get built.

## Decompose oversized scope

If the new program has a materially richer flow than existing ones (more
roles, more actions, more form steps), do not try to build full parity in
one round. Summit Ivonescimab has 3 roles with multiple actions each; this
onboarding scoped down to exactly one flow (Patient → Enroll in Co-pay
Assistance) as the first, provable slice, with the rest tracked as explicit,
well-scoped follow-up — not built speculatively, and not silently dropped
either.

## What to do when the live site itself blocks you

Sometimes the blocker isn't your code, your design, or your test data — it's
a real bug in the environment you're testing against. During this
onboarding, filling out Summit's Patient Information page with fully valid
data and clicking "Next" reproducibly failed with a client-side JS error and
no network request firing at all (confirmed via `browser_network_requests`)
— on the *live QA host itself*, not anything this repo controls.

When this happens:
1. **Reproduce it at least twice**, ideally with different data, to rule out
   a data-shape issue on your end.
2. **Check for a network request** — if a submission click doesn't even
   attempt a request, that's a client-side bug, not a server-side rejection;
   if it does fire a request, check the response for what was actually
   rejected.
3. **Scope this round's build down to what's actually reachable** — don't
   write page objects or tests against a page you were blocked from ever
   seeing. Guessed selectors on unverified DOM are worse than not having the
   page object at all: they look done, pass a naive read-through, and fail
   silently or confusingly the moment someone tries to use them.
4. **Document the blocker as explicit follow-up**, with what you tried and
   what you saw, so the next person doesn't have to re-discover it from
   scratch.

## Step-by-step procedure

1. **Research the live site** (see above) before writing anything.
2. **Write a design spec** (`docs/superpowers/specs/YYYY-MM-DD-<program>-onboarding-design.md`)
   covering: the new program's role/action model, its eligibility
   questions, its form fields (and how they compare to existing programs'),
   what's confirmed vs. still unverified, and this round's explicit scope
   (what's built now vs. deferred).
3. **Pick the program key and namespaced env var upfront**:
   - `PROGRAM_KEY` = the exact folder name you're about to create under
     `src/programs/` (e.g. `summit-ivonescimab`). This is what isolates the
     new program's screenshot output — get it right from the start rather
     than fixing a collision later.
   - `<PROGRAM_KEY_UPPER>_BASE_URL` = the namespaced `.env` variable (e.g.
     `SUMMIT_IVONESCIMAB_BASE_URL`). Never a bare `BASE_URL` — every
     program's `.env` gets loaded into the same process
     (`playwright.config.ts` calls `dotenv.config()` once per program), so
     an unnamespaced var would silently collide.
4. **Scaffold `src/programs/<program-key>/`**: `pages/`, `testdata/types.ts`,
   `fixtures/index.ts`, `utils/DataGenerator.ts`, `utils/deviceBrowsers.ts`
   (with its own `PROGRAM_NAME`/`PROGRAM_KEY`/`SPINNER_SELECTOR`),
   `utils/index.ts`, `config/index.ts`, `tests/`. Port page objects
   near-verbatim wherever live research confirmed identical selectors/
   behavior; rewrite (don't locator-tweak) wherever the structure is
   actually different.
5. **Wire it into shared config**: add a second `dotenv.config(...)` call
   and a `projects[]` entry in `playwright.config.ts` (the pattern and its
   own onboarding comment already anticipate this); add
   `test:<program-key>` to `package.json`.
6. **Write tests and run them live** — TDD against the real site, not
   assumptions. Every fact this guide's worked example used (question order,
   error message text, heading text, field names) was pulled from actually
   running things against the live host, not inferred from visual
   similarity.
7. **Build the screenshot-framework equivalent**, mirroring whichever
   existing program's structure fits best (`screenshots/core/`,
   `screenshots/pages/`, `screenshots/runner/`), consuming
   `src/shared/screenshots-engine/` — never re-implement engine code
   per-program. Add `screenshots:<program-key>:<resolution>` scripts to
   `package.json` for every resolution.
8. **Verify the stateExpanded-style captures for dead space below the
   footer** (or any other popup that might inflate `fullPage` height) before
   assuming an existing program's `capHeightPx` values apply — they're tuned
   from that program's own measured page heights and do not transfer.
9. **Update `CLAUDE.md`**: Commands section, Screenshot-framework section,
   and the "Onboarding a new program" paragraph (this file may need edits
   too, if the process itself changed).
10. **Run the *other* program's full suite** (tests + at least one
    screenshot resolution) before committing, to confirm zero regression —
    shared engine code and renamed/shared npm scripts are exactly the kind
    of change that can silently break a sibling program.

## Follow-up checklist template

Copy this into your design spec's Non-Goals / the plan's final task, filled
in with your program's specifics:

- [ ] Additional roles not built this round: `<list>`
- [ ] Additional actions per role not built this round: `<list>`
- [ ] Pages not built this round, and why: `<list>`
- [ ] Tests not written this round, and why: `<list>`
- [ ] Any live-site blockers encountered, with reproduction steps, so a
      future retry doesn't start from zero.
```

- [ ] **Step 2: Trim `CLAUDE.md`'s onboarding paragraph**

Current:
```markdown
Onboarding a new, similar program: copy `src/programs/apotex-evdi/`, rename the folder
and its `.env` var prefix, edit locators/testdata to match the new site, and add one
entry to `playwright.config.ts`'s `projects[]` array plus matching `package.json`
script lines — the one accepted exception to pure copy-paste, consistent with the
existing per-resolution `screenshots:<name>` script convention. **Also update
`PROGRAM_KEY` in the copied `utils/deviceBrowsers.ts` to match the new folder name** —
unlike `PROGRAM_NAME` (a cosmetic label), forgetting to change `PROGRAM_KEY` means the
new program's screenshots silently land in the old program's output folder instead of
their own. Never re-implement `src/shared/` per program — if a program needs a fix
there, it's fixed once, for every program.
```
Replace with:
```markdown
Onboarding a new, similar program: see
[docs/onboarding-new-program.md](../docs/onboarding-new-program.md) for the full,
validated procedure (research the live site first, pick `PROGRAM_KEY` and a namespaced
`.env` var upfront, scaffold, wire into `playwright.config.ts`/`package.json`, build the
screenshot framework, verify zero regression on every other program). Never
re-implement `src/shared/` per program — if a program needs a fix there, it's fixed
once, for every program.
```

(Note: the relative link path from `CLAUDE.md` at the repo root to
`docs/onboarding-new-program.md` is `docs/onboarding-new-program.md`, not
`../docs/...` — fix the link target to match `CLAUDE.md`'s actual location
before committing; verify by checking the link resolves, e.g. `ls
docs/onboarding-new-program.md` from the repo root.)

- [ ] **Step 3: Update the "Multi-program layout" diagram in `CLAUDE.md`**

Current:
```markdown
## Multi-program layout

\`\`\`
src/
  shared/                        engine code with no program-specific knowledge —
                                  reused by every program, never duplicated per program
    screenshots-engine/          screenshotHelper.ts (capture/naming/manifest/sequence),
                                  pdfMerger.ts (manifest -> ordered PDF)
  programs/
    apotex-evdi/                 everything specific to this one site
      pages/  modules/  fixtures/  testdata/  utils/  config/  tests/  screenshots/
      .env                       APOTEX_EVDI_BASE_URL (program-specific secret/config)
\`\`\`
```
Replace with:
```markdown
## Multi-program layout

\`\`\`
src/
  shared/                        engine code with no program-specific knowledge —
                                  reused by every program, never duplicated per program
    screenshots-engine/          screenshotHelper.ts (capture/naming/manifest/sequence),
                                  pdfMerger.ts (manifest -> ordered PDF)
  programs/
    apotex-evdi/                 everything specific to this one site
      pages/  modules/  fixtures/  testdata/  utils/  config/  tests/  screenshots/
      .env                       APOTEX_EVDI_BASE_URL (program-specific secret/config)
    summit-ivonescimab/          Patient enrollment flow only so far (see
                                  docs/onboarding-new-program.md for what's follow-up)
      pages/  fixtures/  testdata/  utils/  config/  tests/  screenshots/
      .env                       SUMMIT_IVONESCIMAB_BASE_URL
\`\`\`
```

Also update the first paragraph under "## What this is" (currently: "Today
there is exactly one program, `apotex-evdi`.") to: "Today there are two
programs: `apotex-evdi` (full Patient + HCP enrollment) and
`summit-ivonescimab` (Patient enrollment up to Patient Information — see
[docs/onboarding-new-program.md](docs/onboarding-new-program.md) for what's
follow-up)."

- [ ] **Step 4: Verify the onboarding doc's links resolve and typecheck is still clean**

Run: `npx tsc --noEmit` (should still be clean — this task is docs-only, but
confirms nothing was accidentally left broken).
Manually confirm (e.g. `ls docs/onboarding-new-program.md`,
`ls docs/superpowers/specs/2026-09-23-summit-ivonescimab-onboarding-design.md`)
that every file path referenced in the new doc actually exists.

- [ ] **Step 5: Commit**

```bash
git add docs/onboarding-new-program.md CLAUDE.md
git commit -m "Add reusable onboarding-new-program.md guide, validated by the Summit Ivonescimab onboarding"
```
