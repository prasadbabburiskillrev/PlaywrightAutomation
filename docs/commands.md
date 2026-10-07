# Command reference

Every command for the three kinds of checks. Run all of them from the repo root. Program keys:
`apotex-evdi`, `summit-ivonescimab`, `sandoz-tyruko-copay`.

| Kind | What it does | Section |
| --- | --- | --- |
| e2e | Business-flow regression tests | [E2E tests](#e2e-tests) |
| design | Figma-vs-live UI checks | [Design checks](#design-checks) |
| screenshots | Numbered PNGs + one PDF per run | [Screenshot capture](#screenshot-capture) |

> All three run against the **live shared QA/PR hosts**. e2e specs and screenshot runs make
> **real submissions** (enrollment records, uploaded documents). Design specs only open pages
> and read styles; they click Submit only on an empty form to trigger validation.

## One-time setup

```bash
npm install
npx playwright install        # download the browsers Playwright drives
```

Each program's `.env` is optional (it falls back to the QA URL):
`APOTEX_EVDI_BASE_URL`, `SUMMIT_IVONESCIMAB_BASE_URL`, `SANDOZ_TYRUKO_COPAY_BASE_URL`.

## E2E tests

Specs live in `src/programs/<key>/tests/e2e/*.e2e.spec.ts`; Playwright projects are
`<key>-e2e`.

| Command | What it runs |
| --- | --- |
| `npm test` | Every program's e2e suite, headless |
| `npm run test:apotex-evdi` | Only `apotex-evdi-e2e` (17 tests, ~20 min) |
| `npm run test:summit-ivonescimab` | Only `summit-ivonescimab-e2e` (3 tests, ~3 min) |
| `npm run test:sandoz-tyruko-copay` | Only `sandoz-tyruko-copay-e2e` |
| `npm run test:headed` | Every e2e suite with a visible browser |
| `npm run report` | Open the HTML report from the last run (`playwright-report/`) |

Spec files:

| Program | Spec files (in `tests/e2e/`) |
| --- | --- |
| `apotex-evdi` | `patient-enrollment.e2e.spec.ts`, `hcp-enrollment.e2e.spec.ts`, `document-upload.e2e.spec.ts` |
| `summit-ivonescimab` | `patient-enrollment.e2e.spec.ts` |
| `sandoz-tyruko-copay` | `patient-enrollment.e2e.spec.ts` |

Run a subset (anything after `--` or after `npx playwright test` goes to Playwright):

```bash
# one spec file
npx playwright test src/programs/apotex-evdi/tests/e2e/patient-enrollment.e2e.spec.ts
npx playwright test src/programs/apotex-evdi/tests/e2e/hcp-enrollment.e2e.spec.ts
npx playwright test src/programs/apotex-evdi/tests/e2e/document-upload.e2e.spec.ts
npx playwright test src/programs/summit-ivonescimab/tests/e2e/patient-enrollment.e2e.spec.ts
npx playwright test src/programs/sandoz-tyruko-copay/tests/e2e/patient-enrollment.e2e.spec.ts

# tests whose title matches (limit to one program with --project=<key>-e2e)
npx playwright test -g "routes to the not-eligible page"
npx playwright test --project=summit-ivonescimab-e2e -g "validation error"
npx playwright test -g "HCP document upload"

# several projects at once, or by wildcard
npx playwright test --project=apotex-evdi-e2e --project=sandoz-tyruko-copay-e2e
npx playwright test --project="*-e2e"

# watch / debug
npx playwright test <spec file> --headed
npx playwright test -g "removes one" --debug       # Playwright Inspector
npx playwright test <spec file> --ui               # Playwright UI mode

# list what would run, without running it
npx playwright test --list --project="*-e2e"
```

Things to expect: tests run one at a time (`workers: 1`) and every landing-page "Next" is
preceded by an intentional 10 s wait. The Apotex HCP "completes enrollment successfully"
test retries up to 5 times because of a known live-app bug; see the comment in
`hcp-enrollment.e2e.spec.ts`.

## Design checks

Specs live in `src/programs/<key>/tests/design/*.design.spec.ts`; Playwright projects are
`<key>-design`. They are **not** part of `npm test`. Rules and workflow:
[design-validation.md](design-validation.md).

| Command | What it runs |
| --- | --- |
| `npm run test:design` | Every program's design specs |
| `npm run test:apotex-evdi:design` | Only `apotex-evdi-design` (no specs yet) |
| `npm run test:summit-ivonescimab:design` | Only `summit-ivonescimab-design` |
| `npm run test:sandoz-tyruko-copay:design` | Only `sandoz-tyruko-copay-design` |

Spec files:

| Program | Spec files (in `tests/design/`) |
| --- | --- |
| `sandoz-tyruko-copay` | `transition-success.design.spec.ts` (Patient Transition Success) |
| `summit-ivonescimab` | `patient-info-visual-styling.design.spec.ts` |

```bash
# one design spec
npm run test:sandoz-tyruko-copay:design -- tests/design/transition-success
npx playwright test src/programs/sandoz-tyruko-copay/tests/design/transition-success.design.spec.ts

# one program, visible browser / list only
npm run test:summit-ivonescimab:design -- --headed
npm run test:design -- --list
```

Prepare the stored Figma data a design spec is compared with (output is gitignored, see
[design-validation.md](design-validation.md#stored-figma-data)):

| Command | What it does |
| --- | --- |
| `npm run design:split -- <program> <raw-file-name>` | Split a raw Figma dump in `design-validation/baseline/raw/` into one file per page, grouped by flow |
| `npm run design:convert -- <program>` | Turn the split pages into resolved, body-only JSON (header and footer removed) |
| `... -- --dir=testmeta/<name>` | Add to `design:split` / `design:convert` to read and write a folder outside `src/programs/` (used for `testmeta/`, programs with no folder yet). Gitignored |
| `npm run design:report -- <program> --story=<id>` | Run only the design specs whose title starts with `US-<id>` and tag the report with that user story id (file: `<program>-US-<id>-design-report.docx`) |
| `npm run design:report -- <program>` | Run the program's design specs and write `design-report/<program>-design-report.docx` (add `-- --no-run` to rebuild from the last run) |

```bash
npm run design:split -- summit-ivonescimab section-1001-5183.2026-10-05.txt
npm run design:convert -- summit-ivonescimab
```

## Screenshot capture

A separate tool, not part of `npm test`. It walks a program's flow, saves a numbered PNG of
every state and merges them into one PDF. Output goes to
`screenshots/<PROGRAM_KEY>/<timestamp>/<resolution>_<browser>/` (gitignored). Apotex drives
the Patient path then the HCP path (enrollment and document upload); Summit and Tyruko drive
the Patient path.

Scripts are `screenshots:<program>:<resolution>`:

| Resolution | Size | Script suffix |
| --- | --- | --- |
| xlDesktop | 1920 × 1080 | `:xlDesktop` |
| lDesktop | 1440 × 1080 | `:lDesktop` |
| Desktop | 1024 × 1080 | `:desktop` |
| lTablet | 1280 × 800 | `:lTablet` |
| pTablet | 768 × 1024 | `:pTablet` |
| xsMobile | 375 × 1080 | `:xsMobile` |
| every resolution above, one after another | | `:all` |

```bash
# apotex-evdi
npm run screenshots:apotex-evdi:xlDesktop
npm run screenshots:apotex-evdi:lDesktop
npm run screenshots:apotex-evdi:desktop
npm run screenshots:apotex-evdi:lTablet
npm run screenshots:apotex-evdi:pTablet
npm run screenshots:apotex-evdi:xsMobile
npm run screenshots:apotex-evdi:all

# summit-ivonescimab
npm run screenshots:summit-ivonescimab:xlDesktop
npm run screenshots:summit-ivonescimab:lDesktop
npm run screenshots:summit-ivonescimab:desktop
npm run screenshots:summit-ivonescimab:lTablet
npm run screenshots:summit-ivonescimab:pTablet
npm run screenshots:summit-ivonescimab:xsMobile
npm run screenshots:summit-ivonescimab:all

# sandoz-tyruko-copay
npm run screenshots:sandoz-tyruko-copay:xlDesktop
npm run screenshots:sandoz-tyruko-copay:lDesktop
npm run screenshots:sandoz-tyruko-copay:desktop
npm run screenshots:sandoz-tyruko-copay:lTablet
npm run screenshots:sandoz-tyruko-copay:pTablet
npm run screenshots:sandoz-tyruko-copay:xsMobile
npm run screenshots:sandoz-tyruko-copay:all
```

Ad hoc runs, without editing files (`--device` is a resolution name from the table, with
`Desktop` capitalised; `--browser` is `chrome`, `edge`, `firefox` or `safari`):

```bash
npx tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=pTablet --browser=firefox
npx tsx src/programs/summit-ivonescimab/screenshots/runner/run-all.ts --device=pTablet --browser=firefox
npx tsx src/programs/sandoz-tyruko-copay/screenshots/runner/run-all.ts --device=pTablet --browser=firefox

# every resolution in one browser
npx tsx src/programs/<program>/screenshots/runner/run-all-resolutions.ts --browser=edge

# one path only (each program has run-patient-path.ts; apotex-evdi also has run-hcp-path.ts)
npx tsx src/programs/apotex-evdi/screenshots/runner/run-patient-path.ts --device=xlDesktop
npx tsx src/programs/apotex-evdi/screenshots/runner/run-hcp-path.ts --device=xlDesktop
npx tsx src/programs/summit-ivonescimab/screenshots/runner/run-patient-path.ts --device=xlDesktop
npx tsx src/programs/sandoz-tyruko-copay/screenshots/runner/run-patient-path.ts --device=xlDesktop
```

Defaults (browser, headed/headless, resolutions) are in each program's
`utils/deviceBrowsers.ts`; screenshot runs are headed by default. Adding a resolution also
needs a matching `screenshots:<program>:<name>` script in `package.json`. Details: each
program's `screenshots/README.md`.

## Other useful commands

```bash
npx tsc --noEmit -p .                        # type-check (there is no npm lint/build script)
npx playwright show-report                   # same as npm run report
npx playwright test --list                   # every test in every project
```
