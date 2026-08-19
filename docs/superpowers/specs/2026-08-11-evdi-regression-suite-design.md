# EVDI Portal Regression Suite — Design Spec

**Date:** 2026-08-11
**Target site:** https://portal-qa.trialcard.com/apotex/evdi/
**Status:** Approved for planning
**Supersedes:** `2026-08-10-evdi-portal-automation-design.md` (scope revised after live site exploration; see "Changes from prior spec" below)

## Context

The repo (`Playwright_Automation`) has a directory scaffold (`pages/`, `modules/`, `fixtures/`, `testdata/`, `utils/`, `tests/`) generated from an e-commerce-flavored template. Every file in it is still empty (0 bytes) — there is no existing implementation to preserve. Yesterday's spec proposed replacing this scaffold based on assumptions made without live access to the site. This round performs that live exploration and narrows scope to a functional regression suite only.

Not a git repository — this spec is saved to disk only; no commit step.

## Changes from prior spec

Live exploration (via browser automation against the QA portal) corrected several assumptions:

- **No Pharmacy enrollment path exists.** The landing page offers exactly two roles — **Patient** and **Healthcare Provider (HCP)** — each with two actions: **Enroll** and **Upload Documents** (4 flows total, not 3 enrollment paths + upload).
- **No login is required for any flow.** All four flows are public/unauthenticated.
- **The visual UI acceptance capture tool (screenshot → PDF for client sign-off) is out of scope for this round**, per explicit scope decision — this spec covers functional regression only. It can be re-approved as a separate spec later.
- **A real, verified accessibility gap exists in the app**: none of the ~16 free-text inputs across the enrollment forms (First Name, Last Name, Date of Birth, Address, Zip, City, phone numbers, email, signature, etc.) have an associated `<label>`, `aria-label`, or `placeholder`. Each only has a `name` attribute (e.g. `name="firstName"`) and a visually adjacent but programmatically unlinked text label. `getByRole`, `getByLabel`, and `getByPlaceholder` cannot reach these fields — this was confirmed by inspecting the live DOM, not assumed.
- **The app is built with Vuetify.** Radio buttons and checkboxes have a ripple overlay `<div>` that intercepts pointer events on the underlying `<input>` — clicking the input directly times out. The visible label text must be clicked instead. This is a real runtime behavior, verified against the live site.
- **Wizard state is client-side only.** Deep-linking directly to a mid-wizard URL (e.g. `/patient/patient-information/`) does not reliably reproduce the correct step or role context — it was observed rendering stale state left over from a previous flow in the same session. Tests must always drive the wizard from the landing page, never jump to an internal step via `page.goto()`.

## Scope

Four flows, all confirmed live:

1. **Patient — Enroll in Copay Assistance**: 4-step wizard — Eligibility → Patient Information → Patient Consent → Success (`/patient/patient-success`).
2. **Healthcare Provider — Enroll Patient in Copay Assistance**: 3-step wizard — Eligibility → Patient Information → Success (no separate consent step).
3. **Patient — Upload Documents**: single-step file upload.
4. **Healthcare Provider — Upload Documents**: same shared page/URL (`/upload-documents/`) as flow 3 — role selection on the landing page does not change the upload page itself.

**Depth:** happy path + key negative/branching cases per flow (not exhaustive field-by-field validation):

- **Eligibility branching**: answering "Yes" to the cash-pay/federal-program question routes to `/not-eligible` (verified) instead of continuing the wizard. Both Patient and HCP eligibility forms ask the same 4 yes/no questions (reworded for audience) and share this branching rule.
- **Required-field validation**: submitting the Patient Information step with empty required fields surfaces a `"There are N errors"` summary banner plus a `"Required"` message per invalid field (verified: 10 errors for 10 required fields left blank).
- **Upload validation**: selecting a file with a disallowed extension surfaces the alert `"One or more files could not be uploaded due to an invalid file type. Please select files that match the valid type(s) listed above."` (verified). An oversized-file (>10MB) case is included; its exact message will be confirmed during implementation (TDD) rather than guessed here.
- Full happy-path completion is verified for the Patient enrollment flow end-to-end (landing → eligibility → info → consent → `Congratulations!` success page). HCP happy-path completion and the upload-success confirmation state follow the same pattern and will be finalized during implementation.

**Out of scope for this round:** Pharmacy path (doesn't exist), visual/PDF acceptance capture, cross-browser execution, API-level testing, exhaustive per-field validation matrix, login/auth (none exists).

## Locator Strategy — including a flagged, explicit exception

CLAUDE.md's locator order (`getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId`) is followed everywhere it's reachable: buttons, links, checkboxes/radios (by accessible name), and dropdown options all expose real accessible roles/names and are targeted that way.

Two documented exceptions, both driven by genuine gaps in the target application rather than convenience:

1. **Unlabeled text inputs** (First Name, Last Name, DOB, Address Line 1/2, Zip, City, Mobile/Home Phone, Email, Signature, Patient Representative fields, etc.): targeted via `page.locator('input[name="firstName"]')` etc. This is scoped to only the fields that need it. The `name` attribute is tied to the app's own form-submission semantics (changing it would break the app's own code), not a styling hook — it is not equivalent to the `.btn-primary` / `#submit-id` examples CLAUDE.md's rule warns against. **User-approved exception.**
2. **Radio/checkbox interaction**: click the visible label text (e.g. `page.getByText('Yes')` scoped to the right `radiogroup`, or the checkbox's label paragraph) rather than the `radio`/`checkbox` role element itself, because Vuetify's ripple effect `<div>` intercepts pointer events on the real input. Assertions still use `getByRole('radio', { name })` / `getByRole('checkbox', { name })` to check `checked` state — only the *click* is redirected to the label.

Comboboxes (Gender, State) use real `role="combobox"` and `role="option"` elements and are targeted normally via `getByRole`. The State list is long and virtualized (Vuetify `v-virtual-scroll`) — options outside the visible window aren't in the DOM until scrolled into view, so `StatePicker`-style selection scrolls the listbox (`page.mouse.wheel` over the open listbox) before asserting the target option is available, rather than assuming `.fill()` will filter it (typing does not filter this particular dropdown).

## Test Isolation & Data Strategy

CLAUDE.md rule 4 asks for API-seeded state via the `request` fixture where possible. There is no authenticated backend state to seed here — every flow is a public, stateless form, and enrollment/upload *is* the state-creating action under test, not a precondition for it. Isolation instead comes from:

- Each test starts fresh from the landing page (`test.beforeEach` navigates and resets), never reusing another test's in-progress wizard state.
- Patient/HCP information payloads are generated fresh per test run via `@faker-js/faker` (new dependency) rather than static fixtures, avoiding any risk of duplicate-submission rejection and keeping tests independent of each other's data.
- Playwright's default test isolation (fresh browser context per test) is relied on as-is; no custom global state.

## Architecture

Reuses the existing scaffold's layering (page objects → business-flow modules → specs), stripped of the e-commerce/pharmacy leftovers that don't apply:

**Removed** (unused, e-commerce-template artifacts): `ProductPage.ts`, `CheckoutPage.ts`, `ProductModule.ts`, `CheckoutModule.ts`, `AuthApi.ts`, `ProductApi.ts`, `OrderApi.ts`, `product.spec.ts`, `checkout.spec.ts`, `login.spec.ts`, `testbrowser.spec.ts`, `landingpage-visula.spec.ts`, `products.json`, `users.json`, `auth.fixture.ts`. The `api/` folder is left empty (no API in scope). `CustomTTAReporter.ts`, `Logger.ts`, `WaitHelper.ts`, `ApiHelper.ts` are dropped — Playwright's built-in `list`/`html` reporters and web-first assertions already cover these needs; adding custom wrappers now would be unused abstraction (YAGNI).

**Config:**
- `playwright.config.ts`: fix `testDir` to `./src/tests` (currently mismatched against `./tests`); add `baseURL: process.env.BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/'`; Chromium-only project; enable `dotenv` loading; `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`.
- `tsconfig.json`: real `strict: true` compiler options targeting Node + Playwright.
- `src/config/index.ts`: typed env loader (`baseURL`, default timeouts).

**Pages** (`src/pages/`):
- `BasePage.ts` — shared footer/nav assertions common to every screen.
- `LandingPage.ts` — role (Patient/HCP) × action (Enroll/Upload) selection, `Next` button.
- `EligibilityPage.ts` — shared by Patient and HCP (same 4-question structure, reworded per audience); answers all 4 yes/no questions, submits, exposes whether the result was continuation or `/not-eligible`.
- `PatientInformationPage.ts` — shared by Patient and HCP; fills demographic fields (including the `name=`-attribute exception fields and the scrolling State combobox) and asserts required-field validation errors.
- `PatientConsentPage.ts` — Patient-only; checkbox + signature + submit.
- `DocumentUploadPage.ts` — shared by both roles' Upload flows; drives the file chooser, asserts accepted/rejected outcomes.
- `NotEligiblePage.ts`, `SuccessPage.ts` — terminal-state assertions.

**Modules** (`src/modules/`) — orchestrate multi-page flows so specs stay declarative:
- `PatientEnrollmentModule.ts` — landing → eligibility → info → consent → success (or not-eligible).
- `HcpEnrollmentModule.ts` — landing → eligibility → info → success (or not-eligible).
- `DocumentUploadModule.ts` — role-parameterized (`'patient' | 'hcp'`) landing → upload.

**Fixtures** (`src/fixtures/index.ts`): a single custom fixture merging typed page-object instances (`landingPage`, `eligibilityPage`, `patientInfoPage`, `consentPage`, `uploadPage`) into `test`, so specs don't repeat `new XPage(page)` boilerplate — this satisfies CLAUDE.md's "use fixtures for standard setup" without introducing an auth fixture that has nothing to authenticate.

**Test data** (`src/testdata/`):
- `types.ts` — `EligibilityAnswers`, `PatientInformationData` (typed interfaces, no `any`).
- `files/valid-document.pdf` — small real PDF fixture checked into the repo for upload happy-path tests. An oversized file and a wrong-extension file are generated at test-time into the OS temp directory rather than committed as large binaries.
- `src/utils/DataGenerator.ts` — faker-based generator for `PatientInformationData`.

**Tests** (`src/tests/`): one spec per flow —
- `patient-enrollment.spec.ts` — happy path, not-eligible branch, required-field validation.
- `hcp-enrollment.spec.ts` — same three cases for the HCP path.
- `document-upload.spec.ts` — parameterized over `role: 'patient' | 'hcp'` (both reach the same upload page) — happy path, invalid file type, oversized file.

## New Dependencies

- `@faker-js/faker` — dynamic, collision-free test data generation (dev dependency).

## Verification

Per CLAUDE.md rule 5, every spec is run via `npx playwright test <file>` after being written, with failures root-caused from Playwright's error output/trace rather than patched with waits or suppressed.
