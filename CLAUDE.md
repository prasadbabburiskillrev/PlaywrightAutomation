# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TypeScript + Playwright end-to-end test suite for the Apotex eVDI enrollment portal
(`https://portal-qa.trialcard.com/apotex/evdi/`, a Vuetify SPA), plus a separate
screenshot/visual-documentation tool that drives the same page objects. There is no
application source in this repo — this is a test/automation framework only.

## Commands

```bash
npm test                    # run the Playwright suite (src/tests/**/*.spec.ts)
npm run test:headed         # same, with a visible browser
npm run report              # open the last HTML report (playwright-report/)
npx playwright test src/tests/patient-enrollment.spec.ts   # run a single spec file
npx playwright test -g "routes to the not-eligible page"   # run tests by title
```

There is no lint/build/typecheck script wired up in `package.json` yet, even though
`.eslintrc.json`/`tsconfig.json` exist — don't assume `npm run lint` or `npm run build`
work without checking `package.json` first.

### Screenshot framework (separate from the test suite)

```bash
npm run screenshots:xlDesktop   # 1920x1080
npm run screenshots:lDesktop    # 1440x1080
npm run screenshots:desktop     # 1024x1080
npm run screenshots:lTablet     # 1280x800
npm run screenshots:pTablet     # 768x1024
npm run screenshots:xsMobile    # 375x1080
npm run screenshots:all         # every resolution above, sequentially

# ad hoc, without editing files:
npx tsx src/screenshots/runner/run-all.ts --device=pTablet --browser=firefox
```

Each run drives the Patient path fully, then the HCP path fully, using Chrome by
default. Output goes to `screenshots/PortalAutomation/<timestamp>/<resolution>_<browser>/`
(PNG + a merged PDF), and `screenshots/` is gitignored. All resolution/browser/headless
config lives in one file: [src/utils/deviceBrowsers.ts](src/utils/deviceBrowsers.ts)
(`RESOLUTIONS`, `BROWSERS`, `DEFAULT_BROWSER`, `EXECUTION_MODE`, `PROGRAM_NAME`). Adding a
resolution also requires a matching `screenshots:<name>` script in `package.json`. See
[src/screenshots/README.md](src/screenshots/README.md) for the full convention (naming,
sequence numbering, where to add new captures).

## Architecture

**Page Object Model with a business-flow layer on top:**

- `src/pages/` — one class per screen, locators + low-level actions only
  (`LandingPage`, `EligibilityPage`, `PatientInformationPage`, `PatientConsentPage`,
  `NotEligiblePage`, `SuccessPage`).
- `src/modules/` — multi-page flows composed from page objects:
  `PatientEnrollmentModule` (landing → eligibility → patient info → consent) and
  `HcpEnrollmentModule` (landing → eligibility → patient info, no consent step — HCP's
  final "Submit" click on Patient Information *is* the terminal enrollment action).
- `src/fixtures/index.ts` — the custom Playwright `test`, extending base `test` with one
  fixture per page object plus `patientEnrollment`/`hcpEnrollment` module fixtures. All
  specs import `test`/`expect` from `../fixtures`, never from `@playwright/test` directly.
- `src/testdata/types.ts` — shared domain types (`PortalRole`, `PortalAction`,
  `EligibilityAnswers`, `PatientInformationData`).
- `src/utils/DataGenerator.ts` — faker-based generation of patient data (NANP-valid phone
  numbers, valid birthdates, etc.) — never hardcode test data that this can generate.
- `src/config/index.ts` — reads `BASE_URL` from `.env` (falls back to the QA host).
- `src/api/` is scaffolded but currently empty (no API layer implemented yet).

Index barrel files (`src/*/index.ts`) re-export everything in that folder and are the
intended import path for consumers outside that folder — update them when adding a file.

### The screenshot framework is a second consumer of the same POM

`src/screenshots/` never adds its own locators — it only calls existing
`src/pages`/`src/modules` methods and adds reusable interaction helpers (e.g. dropdown
expansion) under `src/screenshots/core/`. `src/screenshots/core/screenshotHelper.ts` owns
the shared `RunContext` (output dirs, PNG manifest, auto-incrementing sequence number
across pages within one run); `pdfMerger.ts` merges the manifest into one ordered PDF at
the end of a run.

## Non-obvious behavior to know before editing tests/pages

- `LandingPage.goto()` deliberately calls `page.goto('')`, not `page.goto('/')`. Because
  `baseURL` already includes a subpath (`/apotex/evdi/`), `'/'` resolves to the shared QA
  host's root and serves a different tenant entirely.
- Vuetify radios must be clicked via their visible label text (`getByText`), not the
  underlying `<input role="radio">` — a ripple overlay intercepts pointer events on the
  input itself.
- `PatientInformationPage`'s `field()` locator excludes `[type="hidden"]` because
  Vuetify's `v-select`/combobox fields render a hidden proxy input sharing the same
  `name` — omitting the exclusion breaks Playwright strict mode.
- The eligibility → patient-information transition is a client-side route change with a
  brief loading overlay; `PatientInformationPage` waits for its own heading before
  interacting so actions don't land on the previous page's identically-named button.
- The State dropdown is virtualized (`v-virtual-scroll`) and not filterable by typing;
  `selectStateOption` scrolls the listbox in a loop until the target option mounts.
- Several pages/modules contain explicit `waitForTimeout` calls (10s per navigation step,
  +30s before the HCP terminal Submit). These are intentional, previously-requested
  diagnostic waits, not leftover debugging code — don't remove them without checking with
  whoever owns the suite, and note the inflated per-test timeouts (`testInfo.setTimeout`)
  in the enrollment specs exist specifically to absorb them.
- The HCP enrollment "completes successfully end to end" flow has a known, escalated,
  flaky live-app defect on its terminal Submit click (~1-in-3 to 1-in-4 live pass rate,
  independent of test data freshness) — see the long comment in
  [src/tests/hcp-enrollment.spec.ts](src/tests/hcp-enrollment.spec.ts) before touching
  retries/timeouts on that describe block. It's a real app bug, not a test flake to
  engineer around; the suite uses `test.describe.configure({ retries: 5 })` to absorb it
  as a hard pass/fail gate. The screenshot framework instead attempts it once and skips
  that one capture with a warning if it fails.
- Running the test suite or screenshot scripts performs real submissions against the
  shared QA host, including actual enrollment records — this is a live external system,
  not a mock.

## Config/rule files that exist but are currently empty placeholders

`.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`,
`.github/instructions/{generator,healer,planner}.md`, `.augment/rules/*.md`,
`rules/framework-rule-engine.json` + `scripts/rule-engine.js`, and
`skills/playwright-ai-mcp-tutor/SKILL.md` are all present but empty/unauthored. Don't
assume they encode conventions — check before relying on them, and don't be surprised if
they get filled in later.
