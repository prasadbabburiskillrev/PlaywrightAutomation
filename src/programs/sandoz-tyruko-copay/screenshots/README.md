# Screenshot Framework

Standalone visual-documentation/regression screenshot tooling, separate from
`src/programs/sandoz-tyruko-copay/tests/e2e/`. It drives the existing
`src/programs/sandoz-tyruko-copay/pages` Page Object Model through the Patient enrollment
wizard at configurable resolutions, saving individually-named PNGs incrementally and
merging each run into a single ordered PDF.

Currently captures the Patient path only, up to and including Patient Information - it
does not proceed into Consent/Success (those pages don't exist in this program yet) or
capture an HCP path (no HCP role built yet). See `02_patientPath.screenshot.ts`'s closing
comment: the Patient Information -> Consent transition is blocked by a live QA bug, so
building Consent/Success captures against an unverified page is deliberately deferred.

## Folder layout

```
src/shared/screenshots-engine/    engine - no business logic, no program-specific knowledge
  screenshotHelper.ts              capture + naming + folder-path builder + sequence counter
  pdfMerger.ts                     merges an ordered list of PNGs into one PDF

src/programs/summit-ivonescimab/screenshots/
  core/                            program-specific interaction helpers
    dropdownExpander.ts            opens/expands Gender + State comboboxes for a screenshot
  pages/                           one file per shared page / path
    01_homePage.screenshot.ts      Landing page (Patient role's default + role-selected states)
    02_patientPath.screenshot.ts   Eligibility -> Not-Eligible detour -> Patient Information
  runner/
    run-patient-path.ts            Patient path only, one resolution
    run-all.ts                     Patient path (the only path today), one resolution
    run-all-resolutions.ts         run-all for every resolution in deviceBrowsers.ts, in order
```

Output is written to (not under `src/`):

```
screenshots/
  summit-ivonescimab/          PROGRAM_KEY - keeps this program's output isolated from
                                any other program's, regardless of PROGRAM_NAME below
    <runTimestamp>/            e.g. 2026-10-01_14-44-37
      <resolutionName>_<browserName>/
        PNG/all screenshots/*.png
        PDF/BivtuoWithYou_<resolutionName>_<browserName>_<date>.pdf   PROGRAM_NAME -
                                                                       cosmetic only
```

## Naming convention

Every capture is `<NN>_<path>_<page>_<state>.png`, e.g.
`09_patient_patientInformation_stateExpanded.png`. `NN` is a 2-digit, zero-padded
sequence number that increments continuously across `01_homePage` into `02_patientPath`
within one path run - it is tracked by a shared counter in `screenshotHelper.ts`, so
inserting or removing a capture never requires manually renumbering anything else.

## Adding a new page or state to capture

1. Add a line to the relevant file in `src/programs/summit-ivonescimab/screenshots/pages/`
   calling `capture(page, context, 'descriptiveName')` at the point in the flow you
   want to snapshot. Only call existing `pages` methods to get there - don't add new
   locators in these files (put reusable new interaction helpers in
   `src/programs/summit-ivonescimab/screenshots/core/` instead, as `dropdownExpander.ts`
   does).
2. Nothing else needs to change - the sequence number and file path are
   derived automatically.

## Adding a new resolution

Add an entry to the `RESOLUTIONS` array in
`src/programs/summit-ivonescimab/utils/deviceBrowsers.ts`, then add a matching
`screenshots:summit-ivonescimab:<name>` npm script in `package.json` pointing at
`run-all.ts --device=<name>`.

## Adding a new browser

Add an entry to the `BROWSERS` array in
`src/programs/summit-ivonescimab/utils/deviceBrowsers.ts` (`engine` must be
`'chromium' | 'firefox' | 'webkit'`, `channel` is optional and only meaningful for the
`chromium` engine, e.g. `'msedge'`). Pass `--browser=<name>` to any runner script, or
change `DEFAULT_BROWSER` in the same file to change what the npm scripts use by default.

## Headless vs headed

Set `EXECUTION_MODE` in `src/programs/summit-ivonescimab/utils/deviceBrowsers.ts` to
`'headless'` to run without a visible browser (it currently defaults to `'headed'`).
