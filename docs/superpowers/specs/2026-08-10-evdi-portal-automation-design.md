# EVDI Portal Automation — Design Spec

**Date:** 2026-08-10
**Target site:** https://portal-qa.trialcard.com/apotex/evdi/
**Status:** Approved for planning

## Context

The repo (`Playwright_Automation`) currently has a directory scaffold (`pages/`, `modules/`, `api/`, `fixtures/`, `testdata/`, `utils/`, `tests/`) generated from an e-commerce-flavored template, but every file in it is empty (0 bytes). There is no existing implementation to preserve. This spec defines what replaces that scaffold to automate the Apotex EVDI portal.

No test credentials or a formal manual test plan exist yet for the QA portal. Live exploration of the site was explicitly deferred (not part of this round). Because of this, the design below defines structure, conventions, and typed contracts; concrete selectors, exact login mechanics, and per-page UI "states" are left as flagged unknowns to fill in once access/exploration happens.

Not a git repository — this spec is saved to disk only; no commit step.

## Scope

1. **Enrollment**, across three distinct paths: **Patient**, **Health Care Provider (HCP)**, **Pharmacy**.
2. **Document Upload** — a standalone flow, independent of enrollment.
3. **Visual UI acceptance capture** — not pixel-diff regression testing. The real need: capture multiple UI states of each page (default, validation errors shown, dropdowns expanded, etc.) across a set of responsive breakpoints, and produce a per-breakpoint PDF of those screenshots for client visual sign-off.

Out of scope for now: API-level testing (UI-only automation), Firefox/WebKit coverage (Chromium only, headed and headless), pixel-diff baseline comparison.

## Architecture & Config

- Remove all e-commerce-flavored scaffold files: `ProductPage.ts`, `CheckoutPage.ts`, `ProductModule.ts`, `CheckoutModule.ts`, `AuthApi.ts`, `ProductApi.ts`, `OrderApi.ts`, `product.spec.ts`, `checkout.spec.ts`, `products.json`. The `api/` folder is left empty/unused (API testing is out of scope; add back if/when needed).
- `playwright.config.ts`:
  - Fix `testDir` from `'./tests'` to `'./src/tests'` (currently mismatched — no tests would run today).
  - Add `baseURL: process.env.BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/'`.
  - Chromium-only project (drop `firefox`/`webkit`); headed via CLI flag / `use.headless: false`, headless by default.
  - Enable the currently-commented-out `dotenv` loading so `.env` is actually read.
  - Reporters: `[['html', { outputFolder: \`playwright-report/${timestamp}\` }], ['./src/utils/CustomTTAReporter.ts']]` — each execution gets its own timestamped HTML report folder (e.g. `playwright-report/2026-08-10_14-30-00/`) so history isn't overwritten, plus a custom pass/fail summary reporter. Timestamp computed once at config load.
- `tsconfig.json` gets real `compilerOptions` (strict mode, appropriate `target`/`module` for Node + Playwright) instead of `{}`.
- `src/config/index.ts` becomes a small typed env-config loader (baseURL, timeouts, program name — see below) instead of being empty.

## Enrollment & Document Upload

- `src/pages/BasePage.ts` — shared nav/wait helpers (header, footer, common elements) that all page objects extend.
- Enrollment paths modeled **separately** (not one generic parameterized class) since their forms/fields genuinely differ by role:
  - `src/pages/PatientEnrollmentPage.ts`, `HcpEnrollmentPage.ts`, `PharmacyEnrollmentPage.ts` — extend `BasePage`; locators/actions specific to that path only.
  - `src/modules/PatientEnrollmentModule.ts`, `HcpEnrollmentModule.ts`, `PharmacyEnrollmentModule.ts` — business-flow logic (fill form → submit → assert confirmation) built on the page objects.
  - `src/tests/enrollment-patient.spec.ts`, `enrollment-hcp.spec.ts`, `enrollment-pharmacy.spec.ts` — one spec file per path.
- Document Upload (standalone): `src/pages/DocumentUploadPage.ts`, `src/modules/DocumentUploadModule.ts`, `src/tests/document-upload.spec.ts`.
- Test data:
  - `src/testdata/types.ts` — typed interfaces: `PatientEnrollmentData`, `HcpEnrollmentData`, `PharmacyEnrollmentData`, `DocumentUploadData`.
  - Form payloads generated fresh per run via `src/utils/DataGenerator.ts` using `@faker-js/faker` (new dependency) rather than static JSON, since forms likely reject duplicate submissions.
  - `src/testdata/users.json` holds only **env-var name references** for any login credentials — never plaintext secrets committed. Actual values live in `.env`.
- Fixtures: `src/fixtures/auth.fixture.ts` provides role-based fixtures (e.g. `hcpPage`, `pharmacyPage`) for paths that need portal login, plus a plain `page` for unauthenticated Patient self-enrollment. Login requirement/mechanism for HCP/Pharmacy is unconfirmed — built generically with a clearly marked TODO, to be completed once access is available.
- Utils:
  - `Logger.ts` — simple structured console logger.
  - `WaitHelper.ts` — explicit waits for spinners/dynamic content beyond Playwright auto-wait (useful before screenshots).
  - `CustomTTAReporter.ts` — minimal custom Playwright reporter for pass/fail summary output.
  - `ApiHelper.ts` left unimplemented (API testing out of scope).

## Visual UI Acceptance Capture

Purpose: produce a client-reviewable PDF per device/breakpoint showing every page in multiple UI states (default, validation errors, dropdowns expanded, etc.), navigating mostly via direct page URLs. This is a standalone capture tool, separate from the functional enrollment/document-upload specs — its output is a deliverable for human review, not a pass/fail test result.

- `src/utils/deviceBrowsers.ts` — typed breakpoint config:
  | Name | Width | Height |
  |---|---|---|
  | xlDesktop | 1920 | 1080 |
  | lDesktop | 1440 | 1080 |
  | Desktop | 1024 | 1080 |
  | lTablet | 1280 | 800 |
  | pTablet | 768 | 1024 |
  | xsMobile | 375 | 1080 |

  Each breakpoint runnable in Chrome headed or headless.
- `src/visual/pages.config.ts` — per page: its URL + a list of named states, each with the interaction needed to reach it (e.g. `{ name: 'validation-error', setup: (page) => ... }`, `{ name: 'dropdown-expanded', setup: (page) => ... }`). Applies to all pages visited across the enrollment and document-upload flows.
- `src/utils/ScreenshotCapture.ts` — given a page/state/breakpoint, opens a Chrome context at that viewport (headed or headless), runs the state setup, saves the screenshot to `screenshots/<date-time>/<device-name>/Images/<page>-<state>.png`.
- `src/utils/PdfBuilder.ts` — merges a breakpoint's images (in page order) into `screenshots/<date-time>/<device-name>/pdf<programname>-<device-name>-<date-time>.pdf`, using `pdf-lib` (new dependency; no native deps, embeds images directly into PDF pages). `<programname>` is a configurable value (via `src/config/index.ts` / env var), not hardcoded.
- Runs as its own spec/script: `src/visual/capture.spec.ts`.
- Error handling: best-effort per state — a failed state/page logs and continues rather than aborting the whole capture run, so the client PDF still gets as much coverage as possible.

## Final Folder Layout (under `src/`)

```
config/index.ts
pages/ BasePage, PatientEnrollmentPage, HcpEnrollmentPage, PharmacyEnrollmentPage, DocumentUploadPage
modules/ PatientEnrollmentModule, HcpEnrollmentModule, PharmacyEnrollmentModule, DocumentUploadModule
fixtures/ auth.fixture.ts
testdata/ types.ts, users.json (env-var refs only)
utils/ Logger, WaitHelper, DataGenerator, CustomTTAReporter, deviceBrowsers, ScreenshotCapture, PdfBuilder
visual/ pages.config.ts, capture.spec.ts
tests/ enrollment-patient.spec.ts, enrollment-hcp.spec.ts, enrollment-pharmacy.spec.ts, document-upload.spec.ts
```

## New Dependencies

- `@faker-js/faker` — test data generation.
- `pdf-lib` — image-to-PDF merging for the visual acceptance capture tool.

## Known Unknowns (flagged, not blocking this spec)

- Actual login requirement and mechanism for HCP and Pharmacy paths (Patient path assumed unauthenticated self-enrollment, unconfirmed).
- Real form field selectors for all three enrollment paths and the document upload flow (no live exploration performed yet).
- The specific UI "states" (which error messages, which dropdowns) needed per page for the visual capture tool.

These should be resolved via live site exploration or a manual test plan before/during implementation of the affected pieces.
