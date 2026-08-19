# EVDI Regression Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Playwright + TypeScript functional regression suite for the EVDI QA portal (https://portal-qa.trialcard.com/apotex/evdi/) covering all four real flows — Patient Enroll, HCP Enroll, Patient Upload Documents, HCP Upload Documents — with happy-path and key negative/branching coverage.

**Architecture:** Page Object Model (`src/pages/`) driven by business-flow modules (`src/modules/`), composed into Playwright tests (`src/tests/`) via a single custom fixture file (`src/fixtures/index.ts`) that injects typed page-object and module instances. No authentication or backend API is involved anywhere in this suite — all four flows are public, stateless multi-step forms.

**Tech Stack:** `@playwright/test` ^1.62.1, TypeScript ^7 (strict mode), `@faker-js/faker` (new dev dependency, for collision-free test data), `dotenv` (new dev dependency, for `.env` loading). Chromium only.

**Note on scope vs. the design spec:** the design spec mentions a `BasePage.ts` for shared footer/nav assertions. This plan omits it — nothing in the agreed happy-path-plus-key-negative-cases scope asserts on the footer or any other cross-page chrome, so a shared base class would have no actual callers (YAGNI). Each page object below is self-contained.

## Global Constraints

These apply to every task below — copied verbatim from `CLAUDE.md` and the approved design spec (`docs/superpowers/specs/2026-08-11-evdi-regression-suite-design.md`):

- Locators: prefer `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId`, in that order. Two flagged, user-approved exceptions apply on this app only (see "Verified site behavior" below): (1) text inputs with no `<label>`/`aria-label`/`placeholder` are targeted via `input[name="..."]` attribute selectors; (2) Vuetify radio/checkbox clicks target the visible label text, not the `radio`/`checkbox` role element (a ripple overlay intercepts pointer events on the real input) — `getByRole` is still used to *assert* checked state.
- Never use `page.waitForTimeout()`. Always use web-first assertions (`await expect(locator)...`) that auto-wait and retry.
- No `any` types anywhere. Every page object, module, fixture, and test-data shape is explicitly typed.
- Every test is isolated — no test depends on another's execution or leftover state. Each test starts fresh from the landing page (never deep-links into a mid-wizard URL — wizard state is client-side only and deep-linking renders stale/incorrect state, confirmed live).
- After writing or modifying any spec file, run it with `npx playwright test <file>` and confirm it passes against the real QA site before moving on. Root-cause failures from Playwright's error output/trace — never suppress or paper over with waits.

## Verified site behavior (reference for every task)

All of the following was confirmed by driving the live QA site during design, not assumed:

- Landing page (`/`) has exactly 2 `radiogroup`s: index `0` = "I am a Patient" (options "Enroll in Copay Assistance", "Upload Documents"), index `1` = "I am a Healthcare Provider" (options "Enroll Patient in Copay Assistance", "Upload Documents"). A `Next` button (disabled until a role+action is picked) advances.
- **Patient enroll**: `/patient/eligibility/` → `/patient/patient-information/` → `/patient/patient-consent/` → `/patient/patient-success` (heading "Congratulations!").
- **HCP enroll**: `/hcp/eligibility/` → `/hcp/patient-information/` → `/success` (heading "Congratulations!", body text "Your patient has been successfully enrolled...").
- **Not-eligible branch** (both roles): answering "Yes" to the first eligibility question (cash/federal program) routes to `/not-eligible` (heading "Thank you for your request!").
- Eligibility form: 4 `radiogroup`s in order — (0) cash/federal program, (1) US residency excl. MA/CA, (2) commercial insurance, (3) terms agreement. Eligible combination is No/Yes/Yes/Yes.
- Patient Information form field `name` attributes (shared component, used by both Patient and HCP flows): `firstName`, `lastName`, `dateOfBirth`, `gender` (combobox), `addressOne`, `addressTwo` (optional), `zip`, `city`, `state` (combobox), `patientPhone`, `patientHomePhone` (optional), `email`, plus optional caregiver fields (`caregiverFirstName`, `relationShipToPatient`, `caregiverPhone`, `caregiverHomePhone`, `caregiverEmail`).
- Submitting the Patient Information step empty shows a `"There are N errors"` banner: **N = 10** on the Patient path (email required), **N = 9** on the HCP path (email optional there) — confirmed live, both counts differ by exactly the `email` field's required-ness.
- The `state` combobox list is long and virtualized (Vuetify `v-virtual-scroll`) — options outside the visible window don't exist in the DOM until the open listbox is scrolled (`page.mouse.wheel` while hovering the `listbox`). Typing into the field does not filter it.
- Patient Consent step: checkbox (no `name` attribute, click its label text "I have read and agree to the Terms and Conditions" — same ripple-intercept issue), `input[name="signature"]`, a readonly auto-filled `input[name="signDate"]`, and an `Enroll` button.
- Document upload (`/upload-documents/`, identical URL/page for both Patient and HCP entry points): clicking the "Click Here" text triggers a native file chooser (`page.waitForEvent('filechooser')`). Accepted types: jpeg, jpg, pdf, png; 10MB single-file limit.
  - Invalid file type → alert: `"One or more files could not be uploaded due to an invalid file type. Please select files that match the valid type(s) listed above."` (shown immediately on file selection, before clicking Upload).
  - Oversized file (>10MB) → alert: `"One or more files could not be uploaded due to size limitations. The total size of all uploads must be 10MB or less."`
  - Successful upload (after clicking `Upload`) → navigates to `/upload-documents-success/`, heading "Thank you for your submission!", body text "Your document(s) has been successfully submitted."

---

### Task 1: Project cleanup and configuration

**Files:**
- Delete: `src/pages/ProductPage.ts`, `src/pages/CheckoutPage.ts`, `src/pages/HomePage.ts`, `src/pages/LoginPage.ts`
- Delete: `src/modules/CheckoutModule.ts`, `src/modules/ProductModule.ts`, `src/modules/LoginModule.ts`
- Delete: `src/api/AuthApi.ts`, `src/api/OrderApi.ts`, `src/api/ProductApi.ts`, `src/api/index.ts`
- Delete: `src/fixtures/auth.fixture.ts`
- Delete: `src/testdata/products.json`, `src/testdata/users.json`
- Delete: `src/utils/ApiHelper.ts`, `src/utils/CustomTTAReporter.ts`, `src/utils/Logger.ts`, `src/utils/WaitHelper.ts`
- Delete: `src/tests/checkout.spec.ts`, `src/tests/login.spec.ts`, `src/tests/product.spec.ts`, `src/tests/testbrowser.spec.ts`, `src/tests/UI/landingpage-visula.spec.ts`
- Delete: `tests/example.spec.ts` (root `tests/` dir — superseded by `testDir: './src/tests'` below)
- Modify: `playwright.config.ts`
- Modify: `tsconfig.json`
- Modify: `package.json`
- Modify: `.env`

**Interfaces:**
- Produces: a working `npx playwright test` command pointed at `src/tests/`, Chromium-only, with `baseURL` set from `.env`, and a `strict` TypeScript config that all later tasks compile under.

- [ ] **Step 1: Delete the unused e-commerce-template files**

```bash
rm -f src/pages/ProductPage.ts src/pages/CheckoutPage.ts src/pages/HomePage.ts src/pages/LoginPage.ts
rm -f src/modules/CheckoutModule.ts src/modules/ProductModule.ts src/modules/LoginModule.ts
rm -f src/api/AuthApi.ts src/api/OrderApi.ts src/api/ProductApi.ts src/api/index.ts
rm -f src/fixtures/auth.fixture.ts
rm -f src/testdata/products.json src/testdata/users.json
rm -f src/utils/ApiHelper.ts src/utils/CustomTTAReporter.ts src/utils/Logger.ts src/utils/WaitHelper.ts
rm -f src/tests/checkout.spec.ts src/tests/login.spec.ts src/tests/product.spec.ts src/tests/testbrowser.spec.ts
rm -rf src/tests/UI
rm -rf tests
```

- [ ] **Step 2: Install new dependencies**

```bash
npm install -D @faker-js/faker dotenv
```

- [ ] **Step 3: Write `.env`**

```
BASE_URL=https://portal-qa.trialcard.com/apotex/evdi/
```

- [ ] **Step 4: Replace `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "playwright.config.ts"]
}
```

- [ ] **Step 5: Replace `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 6: Update `package.json` scripts**

Open `package.json` and replace the `"scripts"` block:

```json
"scripts": {
  "test": "playwright test",
  "test:headed": "playwright test --headed",
  "report": "playwright show-report"
}
```

- [ ] **Step 7: Verify configuration compiles and loads**

Run: `npx playwright test --list`
Expected: exits with code 0, prints "Total: 0 tests in 0 files" (no tests exist yet, but no TypeScript or config errors).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: strip e-commerce scaffold, configure Playwright for EVDI portal"
```

---

### Task 2: Shared types, config loader, Landing/Eligibility/Not-Eligible pages, first passing spec

**Files:**
- Modify: `src/testdata/types.ts`
- Modify: `src/config/index.ts`
- Modify: `src/pages/LandingPage.ts`
- Create: `src/pages/EligibilityPage.ts`
- Create: `src/pages/NotEligiblePage.ts`
- Modify: `src/fixtures/index.ts`
- Create: `src/tests/patient-enrollment.spec.ts`

**Interfaces:**
- Produces: `PortalRole = 'patient' | 'hcp'`, `PortalAction = 'enroll' | 'upload'`, `EligibilityAnswers` interface (`src/testdata/types.ts`); `LandingPage` class with `goto()`, `selectRoleAction(role, action)`, `goNext()`; `EligibilityPage` class with `answer(answers)`, `goNext()`; `NotEligiblePage` class with `expectVisible()`; a `test`/`expect` export from `src/fixtures/index.ts` providing `landingPage` and `eligibilityPage` and `notEligiblePage` fixtures.

- [ ] **Step 1: Write `src/testdata/types.ts`**

```typescript
export type PortalRole = 'patient' | 'hcp';
export type PortalAction = 'enroll' | 'upload';

export interface EligibilityAnswers {
  paysWithCashOrFederalProgram: boolean;
  livesInEligibleState: boolean;
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

- [ ] **Step 2: Write `src/config/index.ts`**

```typescript
export interface PortalConfig {
  baseURL: string;
}

export const config: PortalConfig = {
  baseURL: process.env.BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/',
};
```

- [ ] **Step 3: Write `src/pages/LandingPage.ts`**

```typescript
import { Page, Locator } from '@playwright/test';
import { PortalRole, PortalAction } from '../testdata/types';

const ACTION_LABEL: Record<PortalRole, Record<PortalAction, string>> = {
  patient: {
    enroll: 'Enroll in Copay Assistance',
    upload: 'Upload Documents',
  },
  hcp: {
    enroll: 'Enroll Patient in Copay Assistance',
    upload: 'Upload Documents',
  },
};

const ROLE_RADIOGROUP_INDEX: Record<PortalRole, number> = {
  patient: 0,
  hcp: 1,
};

export class LandingPage {
  readonly page: Page;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async selectRoleAction(role: PortalRole, action: PortalAction): Promise<void> {
    const label = ACTION_LABEL[role][action];
    const radiogroup = this.page.getByRole('radiogroup').nth(ROLE_RADIOGROUP_INDEX[role]);
    // Vuetify radios: click the visible label text. Clicking the underlying
    // <input role="radio"> times out because a ripple overlay <div> intercepts
    // pointer events on it (verified live).
    await radiogroup.getByText(label, { exact: true }).click();
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
```

- [ ] **Step 4: Write `src/pages/EligibilityPage.ts`**

```typescript
import { Page, Locator } from '@playwright/test';
import { EligibilityAnswers } from '../testdata/types';

export class EligibilityPage {
  readonly page: Page;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  private async answerQuestion(index: number, answerYes: boolean): Promise<void> {
    const radiogroup = this.page.getByRole('radiogroup').nth(index);
    await radiogroup.getByText(answerYes ? 'Yes' : 'No', { exact: true }).click();
  }

  async answer(answers: EligibilityAnswers): Promise<void> {
    await this.answerQuestion(0, answers.paysWithCashOrFederalProgram);
    await this.answerQuestion(1, answers.livesInEligibleState);
    await this.answerQuestion(2, answers.hasCommercialInsurance);
    await this.answerQuestion(3, answers.agreesToTerms);
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
```

- [ ] **Step 5: Write `src/pages/NotEligiblePage.ts`**

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class NotEligiblePage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Thank you for your request!' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/not-eligible/);
    await expect(this.heading).toBeVisible();
  }
}
```

- [ ] **Step 6: Write `src/fixtures/index.ts`**

```typescript
import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { NotEligiblePage } from '../pages/NotEligiblePage';

interface PortalFixtures {
  landingPage: LandingPage;
  eligibilityPage: EligibilityPage;
  notEligiblePage: NotEligiblePage;
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
});

export { expect } from '@playwright/test';
```

- [ ] **Step 7: Write the failing test — `src/tests/patient-enrollment.spec.ts`**

```typescript
import { test, expect } from '../fixtures';
import { EligibilityAnswers } from '../testdata/types';

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

test.describe('Patient enrollment', () => {
  test('routes to the not-eligible page when the cash/federal-program answer is Yes', async ({
    landingPage,
    eligibilityPage,
    notEligiblePage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'enroll');
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
    await landingPage.selectRoleAction('patient', 'enroll');
    await landingPage.goNext();

    await eligibilityPage.answer(eligibleAnswers);
    await eligibilityPage.goNext();

    await expect(page).toHaveURL(/patient\/patient-information/);
  });
});
```

- [ ] **Step 8: Run the test and verify both cases pass against the live QA site**

Run: `npx playwright test patient-enrollment.spec.ts`
Expected: 2 passed. If a click times out on a radio/checkbox, confirm you're clicking the label text (via `getByText`) and not the `radio`/`checkbox` role locator directly — the ripple-overlay issue is expected on this app.

- [ ] **Step 9: Commit**

```bash
git add src/testdata/types.ts src/config/index.ts src/pages/LandingPage.ts src/pages/EligibilityPage.ts src/pages/NotEligiblePage.ts src/fixtures/index.ts src/tests/patient-enrollment.spec.ts
git commit -m "feat: add landing/eligibility page objects and eligibility branching tests"
```

---

### Task 3: Patient Information page, data generator, required-field validation test

**Files:**
- Create: `src/pages/PatientInformationPage.ts`
- Modify: `src/utils/DataGenerator.ts`
- Modify: `src/utils/index.ts`
- Modify: `src/fixtures/index.ts`
- Modify: `src/tests/patient-enrollment.spec.ts`

**Interfaces:**
- Consumes: `EligibilityAnswers`, `PatientInformationData` from `src/testdata/types.ts` (Task 2); `eligibleAnswers` pattern already used in `patient-enrollment.spec.ts`.
- Produces: `PatientInformationPage` class with `fill(data: PatientInformationData)`, `submit()`, `expectValidationErrorCount(count: number)`; `generatePatientInformation(): PatientInformationData` from `src/utils/DataGenerator.ts`; `patientInfoPage` fixture.

- [ ] **Step 1: Write `src/pages/PatientInformationPage.ts`**

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { PatientInformationData } from '../testdata/types';

export class PatientInformationPage {
  readonly page: Page;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // "Next" on the Patient path, "Submit" on the HCP path (its final step).
    this.continueButton = page.getByRole('button', { name: /^(Next|Submit)$/ });
  }

  private field(name: string): Locator {
    return this.page.locator(`input[name="${name}"]`);
  }

  async fill(data: PatientInformationData): Promise<void> {
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
    // The state list is virtualized (Vuetify v-virtual-scroll): options
    // outside the visible window don't exist in the DOM until scrolled in,
    // and typing into the field does not filter it (verified live).
    for (let attempt = 0; attempt < 20 && (await option.count()) === 0; attempt++) {
      await listbox.hover();
      await this.page.mouse.wheel(0, 300);
    }
    await option.click();
  }

  async submit(): Promise<void> {
    await this.continueButton.click();
  }

  async expectValidationErrorCount(count: number): Promise<void> {
    await expect(this.page.getByText(`There are ${count} errors`, { exact: true })).toBeVisible();
  }
}
```

- [ ] **Step 2: Write `src/utils/DataGenerator.ts`**

```typescript
import { faker } from '@faker-js/faker';
import { PatientInformationData } from '../testdata/types';

export function generatePatientInformation(): PatientInformationData {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    dateOfBirth: '01/15/1985',
    gender: 'Prefer not to answer',
    addressLine1: faker.location.streetAddress(),
    zipCode: '10001',
    city: 'New York',
    state: 'New York',
    mobilePhone: '2125551234',
    email: faker.internet.email(),
  };
}
```

Note: `zipCode`/`city`/`state`/`mobilePhone` are held fixed to a combination already verified live to pass the form's client-side validation. Only name/email/street-address vary per run (via faker) — enough to avoid duplicate-submission collisions without risking an unverified ZIP/area-code format rejection.

- [ ] **Step 3: Write `src/utils/index.ts`**

```typescript
export { generatePatientInformation } from './DataGenerator';
```

- [ ] **Step 4: Add the `patientInfoPage` fixture — modify `src/fixtures/index.ts`**

```typescript
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

- [ ] **Step 5: Write the failing test — append to `src/tests/patient-enrollment.spec.ts`**

Add this test inside the existing `test.describe('Patient enrollment', ...)` block, after the two existing tests:

```typescript
  test('shows a validation error per required field when submitted empty', async ({
    landingPage,
    eligibilityPage,
    patientInfoPage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'enroll');
    await landingPage.goNext();

    await eligibilityPage.answer(eligibleAnswers);
    await eligibilityPage.goNext();

    await patientInfoPage.submit();
    await patientInfoPage.expectValidationErrorCount(10);
  });
```

- [ ] **Step 6: Run and verify all three tests pass**

Run: `npx playwright test patient-enrollment.spec.ts`
Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PatientInformationPage.ts src/utils/DataGenerator.ts src/utils/index.ts src/fixtures/index.ts src/tests/patient-enrollment.spec.ts
git commit -m "feat: add Patient Information page object, data generator, and validation test"
```

---

### Task 4: Patient Consent, Success page, full happy-path enrollment

**Files:**
- Create: `src/pages/PatientConsentPage.ts`
- Create: `src/pages/SuccessPage.ts`
- Create: `src/modules/PatientEnrollmentModule.ts`
- Modify: `src/modules/index.ts`
- Modify: `src/fixtures/index.ts`
- Modify: `src/tests/patient-enrollment.spec.ts`

**Interfaces:**
- Consumes: `LandingPage`, `EligibilityPage`, `PatientInformationPage` (Tasks 2–3); `EligibilityAnswers`, `PatientInformationData` (Task 2).
- Produces: `PatientConsentPage` with `agreeAndSign(signatureName: string)`, `submit()`; `SuccessPage` with `expectVisible()`; `PatientEnrollmentModule` with `startEnrollment()`, `completeEligibility(answers)`, `completePatientInformation(data)`, `completeConsent(signatureName)`; `patientEnrollment`, `consentPage`, `successPage` fixtures.

- [ ] **Step 1: Write `src/pages/PatientConsentPage.ts`**

```typescript
import { Page, Locator } from '@playwright/test';

export class PatientConsentPage {
  readonly page: Page;
  readonly agreeLabel: Locator;
  readonly signatureInput: Locator;
  readonly enrollButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.agreeLabel = page.getByText('I have read and agree to the Terms and Conditions', {
      exact: false,
    });
    this.signatureInput = page.locator('input[name="signature"]');
    this.enrollButton = page.getByRole('button', { name: 'Enroll' });
  }

  async agreeAndSign(signatureName: string): Promise<void> {
    // Same Vuetify ripple-intercept issue as the eligibility radios: click
    // the label text, not the checkbox input.
    await this.agreeLabel.click();
    await this.signatureInput.fill(signatureName);
  }

  async submit(): Promise<void> {
    await this.enrollButton.click();
  }
}
```

- [ ] **Step 2: Write `src/pages/SuccessPage.ts`**

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class SuccessPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Congratulations!' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/success/);
    await expect(this.heading).toBeVisible();
  }
}
```

- [ ] **Step 3: Write `src/modules/PatientEnrollmentModule.ts`**

```typescript
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { PatientInformationPage } from '../pages/PatientInformationPage';
import { PatientConsentPage } from '../pages/PatientConsentPage';
import { EligibilityAnswers, PatientInformationData } from '../testdata/types';

export class PatientEnrollmentModule {
  constructor(
    private readonly landingPage: LandingPage,
    private readonly eligibilityPage: EligibilityPage,
    private readonly patientInfoPage: PatientInformationPage,
    private readonly consentPage: PatientConsentPage
  ) {}

  async startEnrollment(): Promise<void> {
    await this.landingPage.goto();
    await this.landingPage.selectRoleAction('patient', 'enroll');
    await this.landingPage.goNext();
  }

  async completeEligibility(answers: EligibilityAnswers): Promise<void> {
    await this.eligibilityPage.answer(answers);
    await this.eligibilityPage.goNext();
  }

  async completePatientInformation(data: PatientInformationData): Promise<void> {
    await this.patientInfoPage.fill(data);
    await this.patientInfoPage.submit();
  }

  async completeConsent(signatureName: string): Promise<void> {
    await this.consentPage.agreeAndSign(signatureName);
    await this.consentPage.submit();
  }
}
```

- [ ] **Step 4: Write `src/modules/index.ts`**

```typescript
export { PatientEnrollmentModule } from './PatientEnrollmentModule';
```

- [ ] **Step 5: Extend fixtures — modify `src/fixtures/index.ts`**

```typescript
import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { NotEligiblePage } from '../pages/NotEligiblePage';
import { PatientInformationPage } from '../pages/PatientInformationPage';
import { PatientConsentPage } from '../pages/PatientConsentPage';
import { SuccessPage } from '../pages/SuccessPage';
import { PatientEnrollmentModule } from '../modules/PatientEnrollmentModule';

interface PortalFixtures {
  landingPage: LandingPage;
  eligibilityPage: EligibilityPage;
  notEligiblePage: NotEligiblePage;
  patientInfoPage: PatientInformationPage;
  consentPage: PatientConsentPage;
  successPage: SuccessPage;
  patientEnrollment: PatientEnrollmentModule;
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
  consentPage: async ({ page }, use) => {
    await use(new PatientConsentPage(page));
  },
  successPage: async ({ page }, use) => {
    await use(new SuccessPage(page));
  },
  patientEnrollment: async ({ landingPage, eligibilityPage, patientInfoPage, consentPage }, use) => {
    await use(new PatientEnrollmentModule(landingPage, eligibilityPage, patientInfoPage, consentPage));
  },
});

export { expect } from '@playwright/test';
```

- [ ] **Step 6: Write the failing test — append to `src/tests/patient-enrollment.spec.ts`**

Add this test inside `test.describe('Patient enrollment', ...)`, and add `import { generatePatientInformation } from '../utils/DataGenerator';` to the top of the file:

```typescript
  test('completes enrollment successfully end to end with eligible answers', async ({
    patientEnrollment,
    successPage,
  }) => {
    const patientData = generatePatientInformation();

    await patientEnrollment.startEnrollment();
    await patientEnrollment.completeEligibility(eligibleAnswers);
    await patientEnrollment.completePatientInformation(patientData);
    await patientEnrollment.completeConsent(`${patientData.firstName} ${patientData.lastName}`);

    await successPage.expectVisible();
  });
```

- [ ] **Step 7: Run and verify all four tests pass**

Run: `npx playwright test patient-enrollment.spec.ts`
Expected: 4 passed.

- [ ] **Step 8: Commit**

```bash
git add src/pages/PatientConsentPage.ts src/pages/SuccessPage.ts src/modules/PatientEnrollmentModule.ts src/modules/index.ts src/fixtures/index.ts src/tests/patient-enrollment.spec.ts
git commit -m "feat: add consent/success pages and full patient enrollment happy path"
```

---

### Task 5: HCP enrollment module and spec

**Files:**
- Create: `src/modules/HcpEnrollmentModule.ts`
- Modify: `src/modules/index.ts`
- Modify: `src/fixtures/index.ts`
- Create: `src/tests/hcp-enrollment.spec.ts`

**Interfaces:**
- Consumes: `LandingPage`, `EligibilityPage`, `PatientInformationPage` (Tasks 2–3), `EligibilityAnswers`, `PatientInformationData` (Task 2), `generatePatientInformation` (Task 3), `SuccessPage`, `NotEligiblePage` (Tasks 2, 4).
- Produces: `HcpEnrollmentModule` with `startEnrollment()`, `completeEligibility(answers)`, `completePatientInformation(data)`; `hcpEnrollment` fixture.

- [ ] **Step 1: Write `src/modules/HcpEnrollmentModule.ts`**

```typescript
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { PatientInformationPage } from '../pages/PatientInformationPage';
import { EligibilityAnswers, PatientInformationData } from '../testdata/types';

export class HcpEnrollmentModule {
  constructor(
    private readonly landingPage: LandingPage,
    private readonly eligibilityPage: EligibilityPage,
    private readonly patientInfoPage: PatientInformationPage
  ) {}

  async startEnrollment(): Promise<void> {
    await this.landingPage.goto();
    await this.landingPage.selectRoleAction('hcp', 'enroll');
    await this.landingPage.goNext();
  }

  async completeEligibility(answers: EligibilityAnswers): Promise<void> {
    await this.eligibilityPage.answer(answers);
    await this.eligibilityPage.goNext();
  }

  async completePatientInformation(data: PatientInformationData): Promise<void> {
    await this.patientInfoPage.fill(data);
    await this.patientInfoPage.submit();
  }
}
```

- [ ] **Step 2: Update `src/modules/index.ts`**

```typescript
export { PatientEnrollmentModule } from './PatientEnrollmentModule';
export { HcpEnrollmentModule } from './HcpEnrollmentModule';
```

- [ ] **Step 3: Add the `hcpEnrollment` fixture — replace `src/fixtures/index.ts`**

```typescript
import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { NotEligiblePage } from '../pages/NotEligiblePage';
import { PatientInformationPage } from '../pages/PatientInformationPage';
import { PatientConsentPage } from '../pages/PatientConsentPage';
import { SuccessPage } from '../pages/SuccessPage';
import { PatientEnrollmentModule } from '../modules/PatientEnrollmentModule';
import { HcpEnrollmentModule } from '../modules/HcpEnrollmentModule';

interface PortalFixtures {
  landingPage: LandingPage;
  eligibilityPage: EligibilityPage;
  notEligiblePage: NotEligiblePage;
  patientInfoPage: PatientInformationPage;
  consentPage: PatientConsentPage;
  successPage: SuccessPage;
  patientEnrollment: PatientEnrollmentModule;
  hcpEnrollment: HcpEnrollmentModule;
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
  consentPage: async ({ page }, use) => {
    await use(new PatientConsentPage(page));
  },
  successPage: async ({ page }, use) => {
    await use(new SuccessPage(page));
  },
  patientEnrollment: async ({ landingPage, eligibilityPage, patientInfoPage, consentPage }, use) => {
    await use(new PatientEnrollmentModule(landingPage, eligibilityPage, patientInfoPage, consentPage));
  },
  hcpEnrollment: async ({ landingPage, eligibilityPage, patientInfoPage }, use) => {
    await use(new HcpEnrollmentModule(landingPage, eligibilityPage, patientInfoPage));
  },
});

export { expect } from '@playwright/test';
```

- [ ] **Step 4: Write the failing test — `src/tests/hcp-enrollment.spec.ts`**

```typescript
import { test, expect } from '../fixtures';
import { generatePatientInformation } from '../utils/DataGenerator';
import { EligibilityAnswers } from '../testdata/types';

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

test.describe('HCP enrollment', () => {
  test('routes to the not-eligible page when the cash/federal-program answer is Yes', async ({
    landingPage,
    eligibilityPage,
    notEligiblePage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('hcp', 'enroll');
    await landingPage.goNext();

    await eligibilityPage.answer(ineligibleAnswers);
    await eligibilityPage.goNext();

    await notEligiblePage.expectVisible();
  });

  test('shows a validation error per required field when submitted empty', async ({
    landingPage,
    eligibilityPage,
    patientInfoPage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('hcp', 'enroll');
    await landingPage.goNext();

    await eligibilityPage.answer(eligibleAnswers);
    await eligibilityPage.goNext();

    await patientInfoPage.submit();
    // The HCP Patient Information step has one fewer required field than
    // the Patient path (email is optional here) — verified live: 9 vs 10.
    await patientInfoPage.expectValidationErrorCount(9);
  });

  test('completes enrollment successfully end to end with eligible answers', async ({
    hcpEnrollment,
    successPage,
  }) => {
    const patientData = generatePatientInformation();

    await hcpEnrollment.startEnrollment();
    await hcpEnrollment.completeEligibility(eligibleAnswers);
    await hcpEnrollment.completePatientInformation(patientData);

    await successPage.expectVisible();
  });
});
```

- [ ] **Step 5: Run and verify all three tests pass**

Run: `npx playwright test hcp-enrollment.spec.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/modules/HcpEnrollmentModule.ts src/modules/index.ts src/fixtures/index.ts src/tests/hcp-enrollment.spec.ts
git commit -m "feat: add HCP enrollment module and regression spec"
```

---

### Task 6: Document upload page, module, and spec (both roles)

**Files:**
- Create: `src/pages/DocumentUploadPage.ts`
- Create: `src/modules/DocumentUploadModule.ts`
- Modify: `src/modules/index.ts`
- Modify: `src/fixtures/index.ts`
- Create: `src/testdata/files/valid-document.pdf`
- Create: `src/tests/document-upload.spec.ts`

**Interfaces:**
- Consumes: `LandingPage`, `PortalRole` (Task 2).
- Produces: `DocumentUploadPage` with `selectFile(filePath: string)`, `submit()`, `invalidTypeAlert`, `oversizedAlert` locators; `DocumentUploadModule` with `startUpload(role: PortalRole)`; `documentUpload`, `uploadPage` fixtures.

- [ ] **Step 1: Write `src/pages/DocumentUploadPage.ts`**

```typescript
import { Page, Locator } from '@playwright/test';

export class DocumentUploadPage {
  readonly page: Page;
  readonly clickHereTrigger: Locator;
  readonly uploadButton: Locator;
  readonly invalidTypeAlert: Locator;
  readonly oversizedAlert: Locator;
  readonly successHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.clickHereTrigger = page.getByText('Click Here');
    this.uploadButton = page.getByRole('button', { name: 'Upload' });
    this.invalidTypeAlert = page.getByText(
      'One or more files could not be uploaded due to an invalid file type. Please select files that match the valid type(s) listed above.'
    );
    this.oversizedAlert = page.getByText(
      'One or more files could not be uploaded due to size limitations. The total size of all uploads must be 10MB or less.'
    );
    this.successHeading = page.getByRole('heading', { name: 'Thank you for your submission!' });
  }

  async selectFile(filePath: string): Promise<void> {
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await this.clickHereTrigger.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
  }

  async submit(): Promise<void> {
    await this.uploadButton.click();
  }
}
```

- [ ] **Step 2: Write `src/modules/DocumentUploadModule.ts`**

```typescript
import { LandingPage } from '../pages/LandingPage';
import { PortalRole } from '../testdata/types';

export class DocumentUploadModule {
  constructor(private readonly landingPage: LandingPage) {}

  async startUpload(role: PortalRole): Promise<void> {
    await this.landingPage.goto();
    await this.landingPage.selectRoleAction(role, 'upload');
    await this.landingPage.goNext();
  }
}
```

- [ ] **Step 3: Update `src/modules/index.ts`**

```typescript
export { PatientEnrollmentModule } from './PatientEnrollmentModule';
export { HcpEnrollmentModule } from './HcpEnrollmentModule';
export { DocumentUploadModule } from './DocumentUploadModule';
```

- [ ] **Step 4: Add `uploadPage` and `documentUpload` fixtures — replace `src/fixtures/index.ts`**

```typescript
import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { NotEligiblePage } from '../pages/NotEligiblePage';
import { PatientInformationPage } from '../pages/PatientInformationPage';
import { PatientConsentPage } from '../pages/PatientConsentPage';
import { SuccessPage } from '../pages/SuccessPage';
import { DocumentUploadPage } from '../pages/DocumentUploadPage';
import { PatientEnrollmentModule } from '../modules/PatientEnrollmentModule';
import { HcpEnrollmentModule } from '../modules/HcpEnrollmentModule';
import { DocumentUploadModule } from '../modules/DocumentUploadModule';

interface PortalFixtures {
  landingPage: LandingPage;
  eligibilityPage: EligibilityPage;
  notEligiblePage: NotEligiblePage;
  patientInfoPage: PatientInformationPage;
  consentPage: PatientConsentPage;
  successPage: SuccessPage;
  uploadPage: DocumentUploadPage;
  patientEnrollment: PatientEnrollmentModule;
  hcpEnrollment: HcpEnrollmentModule;
  documentUpload: DocumentUploadModule;
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
  consentPage: async ({ page }, use) => {
    await use(new PatientConsentPage(page));
  },
  successPage: async ({ page }, use) => {
    await use(new SuccessPage(page));
  },
  uploadPage: async ({ page }, use) => {
    await use(new DocumentUploadPage(page));
  },
  patientEnrollment: async ({ landingPage, eligibilityPage, patientInfoPage, consentPage }, use) => {
    await use(new PatientEnrollmentModule(landingPage, eligibilityPage, patientInfoPage, consentPage));
  },
  hcpEnrollment: async ({ landingPage, eligibilityPage, patientInfoPage }, use) => {
    await use(new HcpEnrollmentModule(landingPage, eligibilityPage, patientInfoPage));
  },
  documentUpload: async ({ landingPage }, use) => {
    await use(new DocumentUploadModule(landingPage));
  },
});

export { expect } from '@playwright/test';
```

- [ ] **Step 5: Create the valid-file fixture — `src/testdata/files/valid-document.pdf`**

Create a minimal, valid single-page PDF (no external tooling required):

```bash
mkdir -p src/testdata/files
cat > src/testdata/files/valid-document.pdf << 'EOF'
%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f 
trailer<</Size 4/Root 1 0 R>>
%%EOF
EOF
```

- [ ] **Step 6: Write the failing test — `src/tests/document-upload.spec.ts`**

```typescript
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { test, expect } from '../fixtures';
import { PortalRole } from '../testdata/types';

const validDocumentPath = path.join(__dirname, '..', 'testdata', 'files', 'valid-document.pdf');
const roles: PortalRole[] = ['patient', 'hcp'];

for (const role of roles) {
  test.describe(`${role} document upload`, () => {
    test(`uploads a valid PDF successfully`, async ({ documentUpload, uploadPage }) => {
      await documentUpload.startUpload(role);
      await uploadPage.selectFile(validDocumentPath);
      await expect(uploadPage.invalidTypeAlert).not.toBeVisible();

      await uploadPage.submit();

      await expect(uploadPage.page).toHaveURL(/upload-documents-success/);
      await expect(uploadPage.successHeading).toBeVisible();
    });

    test(`rejects a file with a disallowed extension`, async ({ documentUpload, uploadPage }) => {
      const invalidFilePath = path.join(os.tmpdir(), `invalid-document-${role}.txt`);
      fs.writeFileSync(invalidFilePath, 'not a real document');

      await documentUpload.startUpload(role);
      await uploadPage.selectFile(invalidFilePath);

      await expect(uploadPage.invalidTypeAlert).toBeVisible();

      fs.unlinkSync(invalidFilePath);
    });

    test(`rejects an oversized file`, async ({ documentUpload, uploadPage }) => {
      const oversizedFilePath = path.join(os.tmpdir(), `oversized-document-${role}.pdf`);
      fs.writeFileSync(oversizedFilePath, Buffer.alloc(11 * 1024 * 1024)); // 11MB > 10MB limit

      await documentUpload.startUpload(role);
      await uploadPage.selectFile(oversizedFilePath);

      await expect(uploadPage.oversizedAlert).toBeVisible();

      fs.unlinkSync(oversizedFilePath);
    });
  });
}
```

- [ ] **Step 7: Run and verify all six tests pass**

Run: `npx playwright test document-upload.spec.ts`
Expected: 6 passed (3 cases × 2 roles).

- [ ] **Step 8: Commit**

```bash
git add src/pages/DocumentUploadPage.ts src/modules/DocumentUploadModule.ts src/modules/index.ts src/fixtures/index.ts src/testdata/files/valid-document.pdf src/tests/document-upload.spec.ts
git commit -m "feat: add document upload page/module and regression spec for both roles"
```

---

### Task 7: Full-suite verification

**Files:**
- No new files. Verification only.

**Interfaces:**
- Consumes: everything produced by Tasks 1–6.

- [ ] **Step 1: Run the entire suite**

Run: `npx playwright test`
Expected: 13 passed (4 patient-enrollment + 3 hcp-enrollment + 6 document-upload), 0 failed, Chromium project only.

- [ ] **Step 2: Run it a second time to check for flakiness**

Run: `npx playwright test`
Expected: 13 passed again. If any test is flaky, open the HTML report (`npx playwright show-report`) and root-cause it from the trace — do not add a `waitForTimeout` to mask it.

- [ ] **Step 3: Confirm no stray artifacts were committed**

```bash
git status
```

Expected: working tree clean (aside from the `playwright-report/` and `test-results/` directories, which should already be covered by `.gitignore` — if not, add them).

- [ ] **Step 4: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: verify full EVDI regression suite passes" --allow-empty
```
