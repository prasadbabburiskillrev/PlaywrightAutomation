# Screenshot Framework

Standalone visual-documentation/regression screenshot tooling, separate from
`src/programs/apotex-evdi/tests/`. It drives the existing
`src/programs/apotex-evdi/pages`/`modules` Page Object Model through the Patient and HCP
enrollment wizards and both roles' "Upload Documents" path at configurable resolutions,
saving individually-named PNGs incrementally and merging each run into a single ordered
PDF.

## Folder layout

```
src/shared/screenshots-engine/    engine - no business logic, no program-specific knowledge
  screenshotHelper.ts              capture + naming + folder-path builder + sequence counter
  pdfMerger.ts                     merges an ordered list of PNGs into one PDF

src/programs/apotex-evdi/screenshots/
  core/                            program-specific interaction helpers
    dropdownExpander.ts            opens/expands Gender + State comboboxes for a screenshot
  pages/                           4 files, one per shared page / path
    01_homePage.screenshot.ts      Landing page (both roles' default + role-selected states)
    02_patientPath.screenshot.ts   Eligibility -> Not-Eligible detour -> Patient Information -> Consent -> Success
    03_hcpPath.screenshot.ts       same shape, Not-Eligible detour first, no Consent step, 9-error validation instead of 10
    04_documentUploadPath.screenshot.ts  "Upload Documents" path, run once per role after its enrollment path:
                                   empty-submit error -> invalid type -> over 10 MB -> files selected -> success
  runner/
    run-patient-path.ts            Patient path only, one resolution
    run-hcp-path.ts                HCP path only, one resolution
    run-all.ts                     Patient path then HCP path, one resolution
    run-all-resolutions.ts         run-all for every resolution in deviceBrowsers.ts, in order
```

Output is written to (not under `src/`):

```
screenshots/
  apotex-evdi/                 PROGRAM_KEY - keeps this program's output isolated from
                                any other program's, regardless of PROGRAM_NAME below
    <runTimestamp>/            e.g. 2026-08-18_14-32-07
      <resolutionName>_<browserName>/
        PNG/all screenshots/*.png
        PDF/PortalAutomation_<resolutionName>_<browserName>_<date>.pdf   PROGRAM_NAME -
                                                                          cosmetic only
```

## Naming convention

Every capture is `<NN>_<path>_<page>_<state>.png`, e.g.
`08_patient_patientInformation_validationError_10errors.png`. `NN` is a
2-digit, zero-padded sequence number that increments continuously across `01_homePage`
into `02_patientPath`/`03_hcpPath` and then `04_documentUploadPath` within one path
run - it is tracked by a shared counter in `screenshotHelper.ts`, so inserting or
removing a capture never requires manually renumbering anything else.

## Adding a new page or state to capture

1. Add a line to the relevant file in `src/programs/apotex-evdi/screenshots/pages/`
   calling `capture(page, context, 'descriptiveName')` at the point in the flow you
   want to snapshot. Only call existing `pages`/`modules` methods to get there - don't
   add new locators in these 4 files (put reusable new interaction helpers in
   `src/programs/apotex-evdi/screenshots/core/` instead, as `dropdownExpander.ts` does).
2. Nothing else needs to change - the sequence number and file path are
   derived automatically.

## Adding a new resolution

Add an entry to the `RESOLUTIONS` array in
`src/programs/apotex-evdi/utils/deviceBrowsers.ts`, then add a matching
`screenshots:apotex-evdi:<name>` npm script in `package.json` pointing at `run-all.ts --device=<name>`.

## Adding a new browser

Add an entry to the `BROWSERS` array in
`src/programs/apotex-evdi/utils/deviceBrowsers.ts` (`engine` must be
`'chromium' | 'firefox' | 'webkit'`, `channel` is optional and only meaningful for the
`chromium` engine, e.g. `'msedge'`). Pass `--browser=<name>` to any runner script, or
change `DEFAULT_BROWSER` in the same file to change what the npm scripts use by default.

## Headless vs headed

Set `EXECUTION_MODE` in `src/programs/apotex-evdi/utils/deviceBrowsers.ts` to `'headed'`
to watch the browser while it runs.

## Known limitation

The HCP path's terminal `Submit` click is a documented, escalated, flaky
live-app bug (see `src/programs/apotex-evdi/tests/hcp-enrollment.spec.ts`'s
describe-block comment) with roughly a 1-in-3 to 1-in-4 live pass rate.
This framework attempts it once per run and skips the `hcp_success_default`
capture (logging a warning) rather than retrying - re-run `screenshots:*` if
you need that one capture and it was skipped.
