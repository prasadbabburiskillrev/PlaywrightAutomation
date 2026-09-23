# Onboard Summit Ivonescimab (BIVTUO With You) as a Second Program — Design

**Date:** 2026-09-23
**Status:** Approved

## Problem

The repo currently supports exactly one program, `apotex-evdi`, under
`src/programs/apotex-evdi/`, with a shared engine (`src/shared/`) designed to
support more. It has never actually been exercised by a second program, so
several things are still unverified in practice: whether the copy-the-folder
onboarding instructions in `CLAUDE.md` are actually sufficient, whether the
shared engine really has zero program-specific knowledge, and what naming
scheme the per-resolution `screenshots:*` npm scripts should use once more
than one program exists (explicitly deferred in the original restructuring
plan's Global Constraints until this moment).

We're onboarding a real second program — Summit Therapeutics' Ivonescimab
("BIVTUO With You") portal at `https://portal-qa.trialcard.com/summit/ivonescimab/`
— both to get real Playwright coverage for that site and to validate/harden
the onboarding process itself, producing a reusable, documented procedure for
every future program after this one.

## Site Research Findings (live, confirmed 2026-09-23)

Summit Ivonescimab is a different pharma program on what appears to be the
same underlying enrollment-portal platform TrialCard already builds Apotex
eVDI on — confirmed by matching Vuetify tells (ripple-intercepted radio
inputs, identical `/​<role>/eligibility/`, `/<role>/patient-information/`
route-naming pattern) and a near-identical `PatientInformationData` field set.
Key differences from Apotex:

- **Role/action model is richer.** Apotex: 2 roles (`patient`, `hcp`), each
  with exactly one action (`enroll`). Summit: 3 roles, each with multiple
  distinct actions — Healthcare Provider (Enroll Patient in Support Services /
  Enroll Patient in Co-pay Assistance / Upload Documents), Patient (Enroll in
  Co-pay Assistance / Patient Consent), Pharmacy (Enroll Patient in Co-pay
  Assistance). The landing page UI is 3 separate role-cards, each with its own
  action radiogroup, and selecting one role's action disables the other two
  cards (confirmed live) — a materially different structure from Apotex's
  single combined role+action selector.
- **Eligibility: 5 questions, not 4.** Same Yes/No Vuetify-radiogroup pattern,
  but with an extra "Are you 18 years of age or older?" question and
  different wording throughout. Confirmed live for the Patient / Enroll in
  Co-pay Assistance path:
  1. Enrolled in a federal/state-subsidized healthcare program? (No = eligible)
  2. 18 years of age or older? (Yes = eligible)
  3. Currently live in the United States or its territories? (Yes = eligible)
  4. Currently have commercial insurance that covers BIVTUO? (Yes = eligible)
  5. Agree to terms and conditions? (Yes = eligible)
- **Patient Information fields are a 100% field-for-field match with Apotex**
  (confirmed live via `document.querySelectorAll('input, [role="combobox"]')`)
  — identical underlying `name` attributes, not just similar visible labels:

  | Visible label | `name` attribute | Notes |
  |---|---|---|
  | First Name* | `firstName` | plain text |
  | Last Name* | `lastName` | plain text |
  | Date of Birth* | `dateOfBirth` | MM/DD/YYYY |
  | Gender* | `gender` | combobox + hidden proxy `input[type=hidden][name=gender]`, same Apotex quirk |
  | Address Line 1* | `addressOne` | plain text |
  | Address Line 2 | `addressTwo` | plain text, optional |
  | Zip Code* | `zip` | plain text; triggers a `GET .../location/v1/City?zipCode=...` city-lookup call, doesn't override manual City entry |
  | City* | `city` | plain text |
  | State* | `state` | combobox + hidden proxy, **same virtualized dropdown**: confirmed live, 20 options initially rendered, `max-height: 304px`, `overflow-y: auto` — identical numbers to Apotex's documented quirk |
  | Mobile Phone* | `patientPhone` | auto-formats to `(512) 555-0148` from a plain digits-and-dashes input |
  | Home Phone | `patientHomePhone` | plain text, optional |
  | Email Address* | `email` | plain text |

  Gender combobox options confirmed live: `Male` / `Female` / `Prefer not to
  answer` — identical to Apotex's `Gender` union type. This is strong
  evidence both programs render the exact same underlying form component,
  just restyled. **`PatientInformationPage.ts` and `dropdownExpander.ts` can
  be copied from Apotex essentially verbatim** (import paths and class name
  only) rather than rewritten.
- **Spinner class confirmed identical.** `.half-circle-spinner` CSS rules
  (including the `circle-1`/`circle-2` sub-selectors and keyframe animation
  name) are present in Summit's loaded stylesheet, confirmed via
  `document.styleSheets` inspection. `SPINNER_SELECTOR = '.half-circle-spinner'`
  is reused as-is; no shared-engine change needed.
- **Branding:** page title "BIVTUO With You", footer text "BIVTUO WITH YOU
  provides patients and their providers access and reimbursement support for
  BIVTUO... a registered trademark of Summit Therapeutics Inc."
- **Live QA blocker found: Patient Information → Consent transition is
  currently broken.** Filling every field with valid data (confirmed via
  screenshot: no visible validation errors, all fields populated) and
  clicking "Next" does not navigate — reproduced twice. Browser console
  shows `Error on properties: FHERequestConsiderationQuestion` each time, and
  `browser_network_requests` shows no request fired at all (the click fails
  before any submission attempt), meaning this is a client-side JS error, not
  a data-validation rejection or a server error. This looks like a real bug
  in this QA build — possibly a required field/consideration-question that
  isn't rendering — not something caused by the test data used. Per your
  decision, this round stops at Patient Information; the Patient Consent and
  Success pages have not been inspected live and are not built this round
  (see Non-Goals).

## Goals

- Scaffold `src/programs/summit-ivonescimab/` for the **Patient → Enroll in
  Co-pay Assistance** flow, as far as the flow can currently go live: landing
  role/action selection → Eligibility → Patient Information. The not-eligible
  branch and the empty-submission validation-error branch are both fully
  reachable and tested this round; the happy-path completion (Consent →
  Success) is blocked by the live QA bug above and is explicit follow-up work
  (see Non-Goals), not attempted with unverified guesses.
- Wire it into `playwright.config.ts` (new `projects[]` entry),
  `package.json` (`test:summit-ivonescimab` + renamed/added screenshot
  scripts), and its own namespaced `.env` var.
- Decide and apply the multi-program screenshot-script naming scheme
  (program-prefixed: `screenshots:<program>:<resolution>`), including
  renaming Apotex's existing scripts for consistency.
- Produce `docs/onboarding-new-program.md`: a generalized, reusable
  onboarding procedure, written using this Summit Ivonescimab onboarding as
  the worked example, so the *next* program after this one has a validated
  checklist instead of a one-paragraph CLAUDE.md summary.
- Zero behavior change to the existing `apotex-evdi` program or `src/shared/`
  engine, except the deliberate, called-out screenshot-script rename.

## Non-Goals (this round)

- HCP and Pharmacy roles, and Patient's standalone "Patient Consent" action,
  for Summit Ivonescimab. These are real, well-scoped follow-up work using
  the same onboarding doc — not built now, to avoid taking on a
  second-full-test-suite-sized effort in one pass.
- `PatientConsentPage`, `SuccessPage`, and the full happy-path "completes
  enrollment successfully end to end" test — blocked by the live QA bug
  described above (Patient Information → Consent transition does not work
  with any data tried). Explicit follow-up once the bug is fixed or a
  workaround is found; not built on unverified guesses about the real DOM.
- Any change to Apotex eVDI's own page objects, tests, or testdata beyond the
  screenshot-script rename.
- A parameterized single screenshot script (`--program=` flag) — rejected in
  favor of program-prefixed script names (explicit, greppable, consistent
  with the existing per-resolution script convention); revisit only if the
  number of programs makes the flat script list unwieldy.

## Design

### A. Folder scaffold

```
src/programs/summit-ivonescimab/
  pages/
    LandingPage.ts              rewritten: 3 role-cards, per-role action radiogroups
    EligibilityPage.ts           adapted: 5 questions, Summit's wording
    PatientInformationPage.ts    copied from Apotex near-verbatim - identical field names confirmed live
    NotEligiblePage.ts           adapted once the not-eligible branch is confirmed live
    # PatientConsentPage.ts and SuccessPage.ts are NOT built this round - see Non-Goals
  modules/
    PatientEnrollmentModule.ts   landing -> eligibility -> patient info (stops there - see Non-Goals)
  fixtures/index.ts              same fixture-wiring pattern as Apotex, wired to this program's pages/modules
  testdata/types.ts              this program's own EligibilityAnswers (5 fields) + PatientInformationData
                                  (identical shape to Apotex's - reuse the same field names for consistency)
  utils/
    DataGenerator.ts             copied from Apotex as-is unless a specific field rejects its generated
                                  format during test-writing (confirmed live: phone auto-formats from a
                                  plain "512-555-0148"-style input, same shape Apotex's generator produces)
    deviceBrowsers.ts            RESOLUTIONS/BROWSERS copied as-is; PROGRAM_NAME='BivtuoWithYou',
                                  PROGRAM_KEY='summit-ivonescimab', SPINNER_SELECTOR='.half-circle-spinner'
                                  (confirmed identical live - see Site Research Findings)
  config/index.ts                reads SUMMIT_IVONESCIMAB_BASE_URL, same pattern as apotex-evdi/config
  tests/patient-enrollment.spec.ts   2 tests this round (not-eligible branch, validation-error branch) -
                                      see Testing scope
  screenshots/
    core/dropdownExpander.ts     copied from Apotex near-verbatim - confirmed live: same virtualized
                                  State dropdown (20 options, 304px max-height)
    pages/01_homePage.screenshot.ts, 02_patientPath.screenshot.ts (stops at Patient Information)
    runner/run-all.ts, run-patient-path.ts   (no run-hcp-path.ts this round - no HCP flow built)
  .env                            SUMMIT_IVONESCIMAB_BASE_URL=https://portal-qa.trialcard.com/summit/ivonescimab/
                                  (gitignored, not committed - matches existing convention)
```

`src/shared/screenshots-engine/` is not touched except by consuming its
existing `spinnerSelector`/`capHeightPx`/`extendHeightPx` options — if this
onboarding needs a capability the shared engine doesn't have, that's a
signal to extend the engine (fixed once, for every program), not to
special-case it in the program folder.

### B. Role/action model

Apotex's `PortalRole = 'patient' | 'hcp'` / `PortalAction = 'enroll' |
'upload'` types don't fit Summit's richer model and aren't reused. Summit's
`testdata/types.ts` defines only what this round needs:

```ts
export type PortalRole = 'patient';
export type PortalAction = 'enrollCopay';
```

`LandingPage.selectRoleAction()` is rewritten (not locator-tweaked) to select
the Patient role-card's "Enroll in Co-pay Assistance" radio specifically,
since the underlying UI (3 independent role-cards, sibling-disabling
behavior) differs structurally from Apotex's single selector. Widening these
types to cover HCP/Pharmacy is explicit follow-up work, done when those roles
are actually built.

### C. Eligibility page

New `EligibilityAnswers` shape matching Summit's actual 5 questions (named
for what they ask, not reusing Apotex's field names verbatim where the
question differs in meaning):

```ts
export interface EligibilityAnswers {
  enrolledInFederalOrStateProgram: boolean;
  isAdult: boolean;
  livesInUsOrTerritories: boolean;
  hasCommercialInsurance: boolean;
  agreesToTerms: boolean;
}
```

Same "click via visible label text, not the underlying radio input"
Vuetify-ripple workaround as Apotex (confirmed live: same ripple-overlay
behavior intercepts pointer events here too).

### D. Patient Information page

Reuses Apotex's exact `PatientInformationData` field names and `field()`
locator helper (`input[name="${name}"]:not([type="hidden"])`) — confirmed
field-for-field match live, down to the exact `name` attributes (see table
above), so this page object is a near-verbatim port rather than a rewrite.

### E. Consent + Success pages — not built this round

Blocked by the live QA bug described in Site Research Findings: the
Patient Information → Consent transition does not work with any data tried,
reproduced twice, with no network request even firing (a client-side error,
not a validation rejection). Building `PatientConsentPage`/`SuccessPage`
against an unseen, unverified DOM would risk exactly the kind of guessed,
untested page object this repo's existing pages avoid elsewhere. Follow-up
work, once the bug is fixed or a workaround is found: re-run the live
research from this design's Site Research Findings section, then build both
pages the same way `PatientInformationPage` was built here — from confirmed
live selectors, not assumptions.

### F. Screenshot script naming (applies to both programs)

`package.json` scripts move from flat per-resolution names to
program-prefixed ones:

```
screenshots:apotex-evdi:xlDesktop / lDesktop / desktop / lTablet / pTablet / xsMobile / all
screenshots:summit-ivonescimab:xlDesktop / lDesktop / desktop / lTablet / pTablet / xsMobile / all
```

This is a breaking rename of Apotex's existing script names (called out
explicitly, not silent) — done now specifically because CLAUDE.md's Global
Constraints deferred this exact decision until a second program existed.
`run-all-resolutions.ts` (the `screenshots:<program>:all` target) gains a way
to resolve which program's `run-all.ts` to invoke; since each program's
runner already lives at a fixed, predictable path
(`src/programs/<key>/screenshots/runner/run-all.ts`), the resolutions runner
can take the program key as an argument rather than needing per-program
duplication.

### G. Config wiring

- `playwright.config.ts`: add a second `projects[]` entry (`name:
  'summit-ivonescimab'`, `testDir: './src/programs/summit-ivonescimab/tests'`,
  `use.baseURL` from `SUMMIT_IVONESCIMAB_BASE_URL`), following the exact
  pattern the restructuring already built for this purpose. Add a second
  `dotenv.config(...)` call for this program's `.env`, per the comment
  already left in `playwright.config.ts` anticipating this.
- `package.json`: add `test:summit-ivonescimab`, following the
  `test:apotex-evdi` pattern.

### H. The onboarding guide (`docs/onboarding-new-program.md`)

A generalized, numbered procedure (scaffold → config wiring → page-object
adaptation → testdata → tests → screenshots → docs), written so it reads as
"do these steps for your new program," with this Summit Ivonescimab
onboarding cited inline as the worked example at each step (what was found,
what was decided, what to verify live). Explicitly calls out the two
easy-to-forget, collision-prone spots this round's research and prior review
surfaced: `PROGRAM_KEY` (output-folder isolation — a cosmetic-vs-structural
distinction from `PROGRAM_NAME` that's easy to miss) and the
`SUMMIT_IVONESCIMAB_BASE_URL`-style namespaced env var. It also includes a
section on what to do when the live site itself blocks progress (as happened
here with the Patient Information → Consent transition): verify the blocker
is reproducible and data-independent, scope the round's build down to what's
actually reachable, and document the blocked pages/tests as explicit
follow-up rather than guessing at unseen DOM. `CLAUDE.md`'s existing short
onboarding paragraph is trimmed to a pointer at this doc rather than
duplicating the procedure inline.

### I. Testing scope

One spec file, `src/programs/summit-ivonescimab/tests/patient-enrollment.spec.ts`,
with 2 tests this round (the 3rd, full-happy-path test is Non-Goals — see
above):
1. Routes to the not-eligible page when a disqualifying eligibility answer
   is given (doesn't touch Patient Information at all, so it's unaffected by
   the live QA bug).
2. Shows a validation error per required field when Patient Information is
   submitted empty (only needs the client-side validation to fire, which it
   does immediately on submit attempt — doesn't require the transition past
   Patient Information to actually succeed).

Live submissions on this real QA host are expected and accepted, consistent
with the existing repo-wide convention (`CLAUDE.md`'s "Running the test
suite... performs real submissions" note applies identically here).

## Verification

- `tsc --noEmit` clean.
- `npx playwright test --project=summit-ivonescimab` — both tests passing
  live.
- `npm run screenshots:summit-ivonescimab:xsMobile` — Patient path captures
  complete (landing → eligibility → Patient Information states), PDF
  produced.
- `npx playwright test --project=apotex-evdi` still passing (zero regression
  from the screenshot-script rename or shared-engine reuse).
- `docs/onboarding-new-program.md` exists, is internally consistent with what
  was actually built (no placeholder steps), and documents the live-QA-bug
  encounter as a worked example of "what to do when the live site itself
  blocks you," not just the happy-path steps.
