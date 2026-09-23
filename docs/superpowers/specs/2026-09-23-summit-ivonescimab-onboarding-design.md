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
- **Patient Information fields match Apotex almost field-for-field** (confirmed
  live): First Name*, Last Name*, Date of Birth* (MM/DD/YYYY), Gender*
  (combobox), Address Line 1*, Address Line 2, Zip Code*, City*, State*
  (combobox), Mobile Phone* (000-000-0000), Home Phone, Email Address*. This
  maps directly onto Apotex's existing `PatientInformationData` shape with no
  data-model changes needed.
- **Not yet inspected live:** the Patient Consent and Success pages (research
  was stopped after Patient Information to keep scope contained). The 3-step
  wizard list (`Patient Eligibility` / `Patient Information` / `Patient
  Consent`) confirms a consent step exists; a Success/confirmation page is
  assumed by analogy to Apotex and must be verified live during
  implementation before `PatientConsentPage`/`SuccessPage` are built.
- **Branding:** page title "BIVTUO With You", footer text "BIVTUO WITH YOU
  provides patients and their providers access and reimbursement support for
  BIVTUO... a registered trademark of Summit Therapeutics Inc."
- **Spinner class unverified.** Apotex's shared-engine `spinnerSelector`
  mechanism (added specifically so `src/shared/screenshots-engine/` never
  hardcodes a program's overlay class) assumes each program supplies its own
  selector. Whether Summit uses the same `.half-circle-spinner` class or a
  different one is unconfirmed and must be checked live during
  implementation — if it differs, that's exactly the case the mechanism was
  built for; if screenshots turn out fine without a spinner wait at all,
  `SPINNER_SELECTOR` can simply be omitted for this program.

## Goals

- Scaffold `src/programs/summit-ivonescimab/` end to end for exactly one
  flow: **Patient → Enroll in Co-pay Assistance**, mirroring Apotex's Patient
  path in structure and test depth (not-eligible branch, validation-error
  branch, happy path).
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
    PatientInformationPage.ts    adapted: same field shape as Apotex, selectors re-verified live
    PatientConsentPage.ts        built after live verification of the Consent page
    NotEligiblePage.ts           adapted once the not-eligible branch is confirmed live
    SuccessPage.ts               built after live verification of the Success page
  modules/
    PatientEnrollmentModule.ts   landing -> eligibility -> patient info -> consent
  fixtures/index.ts              same fixture-wiring pattern as Apotex, wired to this program's pages/modules
  testdata/types.ts              this program's own EligibilityAnswers (5 fields) + PatientInformationData
                                  (identical shape to Apotex's - reuse the same field names for consistency)
  utils/
    DataGenerator.ts             copied/adjusted only if Summit's field validation differs from Apotex's
                                  (e.g. phone format, zip format) - confirm live, otherwise reuse as-is
    deviceBrowsers.ts            RESOLUTIONS/BROWSERS copied as-is; PROGRAM_NAME='BivtuoWithYou',
                                  PROGRAM_KEY='summit-ivonescimab', SPINNER_SELECTOR verified live (see Goals)
  config/index.ts                reads SUMMIT_IVONESCIMAB_BASE_URL, same pattern as apotex-evdi/config
  tests/patient-enrollment.spec.ts   same 3-test depth as Apotex's Patient describe block
  screenshots/
    core/dropdownExpander.ts     only if Summit's State/Gender fields are virtualized comboboxes like
                                  Apotex's - confirm live; may not be needed if it's a plain <select>-like combobox
    pages/01_homePage.screenshot.ts, 02_patientPath.screenshot.ts
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

Reuses Apotex's exact `PatientInformationData` field names (confirmed
field-for-field match live) — no new type needed, just re-verify each
field's actual selector on the Summit DOM during implementation (labels
match; underlying `name`/`id` attributes are unconfirmed and may differ).

### E. Consent + Success pages

Built after a live implementation-time check of both pages (not yet
inspected during this design's research) — expected to mirror Apotex's
shape (an agree-and-sign step, then a confirmation page) based on the
3-step wizard list already confirmed, but the plan must include an explicit
verification step before assuming the exact interaction pattern (e.g.
Apotex's "type your name to sign" vs. a checkbox-only consent).

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
`SUMMIT_IVONESCIMAB_BASE_URL`-style namespaced env var. `CLAUDE.md`'s
existing short onboarding paragraph is trimmed to a pointer at this doc
rather than duplicating the procedure inline.

### I. Testing scope

One spec file, `src/programs/summit-ivonescimab/tests/patient-enrollment.spec.ts`,
matching Apotex's Patient describe block depth: routes to not-eligible on a
disqualifying answer, shows a validation error per required field when
submitted empty, completes enrollment successfully end to end with eligible
answers. Live submissions on this real QA host are expected and accepted,
consistent with the existing repo-wide convention (`CLAUDE.md`'s "Running the
test suite... performs real submissions" note applies identically here).

## Verification

- `tsc --noEmit` clean.
- `npx playwright test --project=summit-ivonescimab` — all 3 tests passing
  live.
- `npm run screenshots:summit-ivonescimab:xsMobile` — Patient path captures
  complete, PDF produced.
- `npx playwright test --project=apotex-evdi` still passing (zero regression
  from the screenshot-script rename or shared-engine reuse).
- `docs/onboarding-new-program.md` exists and is internally consistent with
  what was actually built (no placeholder steps).
