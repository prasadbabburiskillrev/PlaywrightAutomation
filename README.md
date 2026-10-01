# Playwright Automation

A TypeScript + Playwright end-to-end test automation framework, scaffolded around the Page Object Model (POM) with a dedicated API layer, custom fixtures, and reusable business-flow modules.

> **Status:** this repo is currently a **scaffold** — the folders and files below are laid out, but most files (config files, page objects, tests, utils, docs, CI configs) are still empty placeholders waiting to be implemented. The structure and dependency list below reflect the intended design based on the file names/types already in place.

## Folder structure

```
Playwright_Automation/
├── src/
│   ├── api/            # API clients (one class per resource)
│   ├── config/         # Environment & runtime configuration
│   ├── fixtures/        # Custom Playwright test fixtures
│   ├── modules/         # Multi-page business-flow abstractions
│   ├── pages/           # Page Object Model classes
│   ├── testdata/        # Static test data + TS types
│   ├── tests/           # Playwright spec files
│   └── utils/           # Shared helper utilities
├── docs/                # Framework documentation
├── rules/               # Custom rule-engine config
├── scripts/             # Node scripts (e.g. the rule engine)
├── skills/              # Claude Code skill definitions for this repo
├── .github/
│   ├── workflows/       # GitHub Actions CI pipelines
│   └── instructions/    # Per-task Copilot instruction files
├── .husky/              # Git hooks (pre-commit, commit-msg)
├── .augment/rules/      # Augment AI assistant rules
├── playwright.config.ts
├── tsconfig.json
├── package.json
├── Dockerfile / docker-compose.yml
├── Jenkinsfile
└── .env
```

## Which file goes where

| If you're adding...                              | Put it in                          | Example                              |
|---------------------------------------------------|-------------------------------------|----------------------------------------|
| A wrapper around a REST endpoint                  | `src/api/`                          | `AuthApi.ts`, `OrderApi.ts`            |
| Base URLs, timeouts, env-driven settings          | `src/config/index.ts`               | reads from `.env`                      |
| A custom Playwright fixture (e.g. logged-in state)| `src/fixtures/`                     | `auth.fixture.ts`                      |
| A multi-step business flow spanning several pages | `src/modules/`                      | `CheckoutModule.ts`, `LoginModule.ts`  |
| Locators + actions for a single screen            | `src/pages/`                        | `HomePage.ts`, `LoginPage.ts`          |
| Static fixtures/mock data or its TS shape         | `src/testdata/`                     | `users.json`, `types.ts`               |
| An actual `*.spec.ts` test                        | `src/tests/`                        | `login.spec.ts`                        |
| A shared helper (logging, waits, reporters, faker)| `src/utils/`                        | `Logger.ts`, `WaitHelper.ts`           |
| A GitHub Actions workflow                         | `.github/workflows/`                | `playwright.yml`                       |
| A Copilot/Cursor/Windsurf/Augment rule file       | `.github/instructions/`, root `.cursorrules`/`.windsurfrules`, `.augment/rules/` | |
| Framework/architecture docs                        | `docs/`                             | `QUICK_REFERENCE.md`                   |

New index barrel exports (`src/*/index.ts`) should be updated whenever a file is added to that folder, since other modules import through them rather than deep-importing individual files.

## Required dependencies

`package.json` currently has none installed. Based on the config files already present (`playwright.config.ts`, `tsconfig.json`, `.eslintrc.json`, `.prettierrc`, `commitlint.config.js`, `.husky/`), install:

```bash
# Playwright test runner
npm install -D @playwright/test
npx playwright install --with-deps   # downloads browser binaries

# TypeScript
npm install -D typescript ts-node @types/node

# Env variables (used by src/config)
npm install dotenv

# Linting & formatting
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier eslint-plugin-prettier

# Git hooks / conventional commits (.husky + commitlint.config.js)
npm install -D husky @commitlint/cli @commitlint/config-conventional
npx husky init

# Optional, based on utils already scaffolded
npm install -D @faker-js/faker   # for src/utils/DataGenerator.ts
npm install axios                # if src/utils/ApiHelper.ts / src/api/* use HTTP calls instead of fetch
```

After installing, add scripts to `package.json`, e.g.:

```json
"scripts": {
  "test": "playwright test",
  "test:headed": "playwright test --headed",
  "lint": "eslint . --ext .ts",
  "format": "prettier --write ."
}
```

## CI/CD & tooling already scaffolded

- **`.github/workflows/playwright.yml`** / **`smoke-tests.yml`** — GitHub Actions pipelines (to be filled in).
- **`Jenkinsfile`** — Jenkins pipeline alternative.
- **`Dockerfile`** / **`docker-compose.yml`** — containerized test execution.
- **`.husky/pre-commit`**, **`.husky/commit-msg`**, **`commitlint.config.js`** — enforce linting and conventional commit messages before commits are accepted.
- **`skills/playwright-ai-mcp-tutor/SKILL.md`** — a Claude Code skill for this repo (currently empty, needs authoring).
- **`rules/framework-rule-engine.json`** + **`scripts/rule-engine.js`** — a custom rule engine referenced by the framework (purpose to be defined once implemented).

## Running the tests

All commands run from the repo root (`c:\Users\LENOVO\Documents\Playwright_Automation`).
The repo hosts two programs side by side, each in its own `src/programs/<key>/` folder:

| Program key | Site | Base URL env var (in that program's `.env`) |
| --- | --- | --- |
| `apotex-evdi` | Apotex eVDI enrollment portal | `APOTEX_EVDI_BASE_URL` (falls back to `https://portal-qa.trialcard.com/apotex/evdi/`) |
| `summit-ivonescimab` | Summit Ivonescimab enrollment portal | `SUMMIT_IVONESCIMAB_BASE_URL` (falls back to `https://portal-qa.trialcard.com/summit/ivonescimab/`) |

> **Live system:** both the e2e suites and the screenshot scripts run against the shared
> QA host (`portal-qa.trialcard.com`). They create real enrollment records and upload
> real documents. Nothing is mocked.

### One-time setup

```bash
npm ci                      # install dependencies
npx playwright install      # download the browsers Playwright drives
```

The `.env` files are optional; each program falls back to its QA URL above.

### E2E test suites (Playwright Test)

| Command | What it runs |
| --- | --- |
| `npm test` | Every program's suite, headless |
| `npm run test:apotex-evdi` | Only the `apotex-evdi` project |
| `npm run test:summit-ivonescimab` | Only the `summit-ivonescimab` project |
| `npm run test:headed` | Every suite with a visible browser |
| `npm run report` | Opens the HTML report from the last run (`playwright-report/`) |

**apotex-evdi:** 17 tests across three spec files in `src/programs/apotex-evdi/tests/`:

| Spec file | Tests | Covers |
| --- | --- | --- |
| `patient-enrollment.spec.ts` | 4 | Not-eligible route, eligible → Patient Information, 10-field validation, full enrollment to success |
| `hcp-enrollment.spec.ts` | 3 | Not-eligible route, 9-field validation, full enrollment to success |
| `document-upload.spec.ts` | 10 (5 per role) | Patient + HCP "Upload Documents": empty submit, invalid file type, over 10 MB, remove a file, real upload to success |

**summit-ivonescimab:** 3 tests in `src/programs/summit-ivonescimab/tests/`:

| Spec file | Tests | Covers |
| --- | --- | --- |
| `patient-enrollment.spec.ts` | 3 | Not-eligible route (federal/state program), eligible → Patient Information, 10-field validation |

Summit stops at Patient Information for now. The live site currently blocks the step
after it; see `docs/superpowers/specs/2026-09-23-summit-ivonescimab-onboarding-design.md`
for the follow-up list.

Run a subset:

```bash
# one program, one spec file
npx playwright test src/programs/apotex-evdi/tests/document-upload.spec.ts
npx playwright test src/programs/summit-ivonescimab/tests/patient-enrollment.spec.ts

# tests whose title matches a pattern (add --project=<key> to limit to one program)
npx playwright test -g "uploads documents successfully"
npx playwright test --project=summit-ivonescimab -g "validation error"

# one role's upload tests only (apotex-evdi)
npx playwright test -g "HCP document upload"

# watch it run in a real browser
npx playwright test src/programs/apotex-evdi/tests/document-upload.spec.ts --headed

# step through interactively with the Playwright Inspector
npx playwright test -g "removes one" --debug
```

Things to expect:

- **It's slow by design.** Tests run one at a time (`workers: 1`), and every landing-page
  "Next" click is preceded by an intentional 10s wait. The apotex-evdi suite takes about
  20 minutes; summit-ivonescimab about 3. The default per-test timeout is 90s;
  end-to-end tests raise their own.
- **apotex-evdi HCP end-to-end retries are expected.** The HCP "completes enrollment
  successfully" test has a known, escalated app bug on its final Submit (about a 1-in-3
  pass rate per attempt). Its describe block allows 5 retries, so a "flaky" result there
  is normal. See the comment in `hcp-enrollment.spec.ts`.
- apotex-evdi upload test files live in `src/programs/apotex-evdi/testdata/uploads/`
  (sample PDF and PNG). The invalid-type and oversize files are generated in memory.

### Screenshot framework (visual documentation)

A separate tool, not part of `npm test`. It walks a program's flow, saves a numbered PNG
of every state, and merges them into one PDF.

- **apotex-evdi** walks the Patient path (landing → eligibility → patient information →
  consent → success, then the document-upload path), then the HCP path (same, without
  consent). About 40 screenshots per run.
- **summit-ivonescimab** walks the Patient path only, landing → eligibility → patient
  information. 11 screenshots per run.

Scripts are named `screenshots:<program>:<resolution>`. One resolution per command
(Chrome, **headed** by default):

| apotex-evdi | summit-ivonescimab | Resolution | Viewport |
| --- | --- | --- | --- |
| `npm run screenshots:apotex-evdi:xlDesktop` | `npm run screenshots:summit-ivonescimab:xlDesktop` | xlDesktop | 1920×1080 |
| `npm run screenshots:apotex-evdi:lDesktop` | `npm run screenshots:summit-ivonescimab:lDesktop` | lDesktop | 1440×1080 |
| `npm run screenshots:apotex-evdi:desktop` | `npm run screenshots:summit-ivonescimab:desktop` | Desktop | 1024×1080 |
| `npm run screenshots:apotex-evdi:lTablet` | `npm run screenshots:summit-ivonescimab:lTablet` | lTablet | 1280×800 |
| `npm run screenshots:apotex-evdi:pTablet` | `npm run screenshots:summit-ivonescimab:pTablet` | pTablet | 768×1024 |
| `npm run screenshots:apotex-evdi:xsMobile` | `npm run screenshots:summit-ivonescimab:xsMobile` | xsMobile | 375×1080 |
| `npm run screenshots:apotex-evdi:all` | `npm run screenshots:summit-ivonescimab:all` | every resolution above, one after another | |

The `:all` scripts keep going if one resolution fails. Look for a
`Completed with failures for: ...` line at the end of the console output.

Ad hoc, without editing any files (call the runner directly):

```bash
# any resolution
npx tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=pTablet
npx tsx src/programs/summit-ivonescimab/screenshots/runner/run-all.ts --device=pTablet

# any resolution + browser
npx tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=xsMobile --browser=firefox
npx tsx src/programs/summit-ivonescimab/screenshots/runner/run-all.ts --device=xsMobile --browser=firefox

# apotex-evdi only: one role's path (still includes that role's document-upload captures)
npx tsx src/programs/apotex-evdi/screenshots/runner/run-patient-path.ts --device=xsMobile
npx tsx src/programs/apotex-evdi/screenshots/runner/run-hcp-path.ts --device=xsMobile
```

- `--device=`: `xlDesktop`, `lDesktop`, `Desktop`, `lTablet`, `pTablet`, `xsMobile`
  (case-sensitive; must match a name in `RESOLUTIONS`). Defaults to `xlDesktop` if omitted.
- `--browser=`: `chrome`, `edge`, `firefox`, `safari`. Defaults to `DEFAULT_BROWSER`.

**Where output goes** (`screenshots/` is gitignored):

```
screenshots/<PROGRAM_KEY>/<runTimestamp>/<resolution>_<browser>/
  PNG/all screenshots/NN_<role>_<page>_<state>.png     e.g. 19_patient_documentUpload_fileTooLarge.png
  PDF/<PROGRAM_NAME>_<resolution>_<browser>_<date>.pdf
```

`PROGRAM_KEY` (`apotex-evdi`, `summit-ivonescimab`) keeps each program's output
separate. `PROGRAM_NAME` (`PortalAutomation`, `BivtuoWithYou`) is only a label in the
PDF filename.

**Permanent settings** live in each program's own `utils/deviceBrowsers.ts`
(`src/programs/apotex-evdi/utils/deviceBrowsers.ts`,
`src/programs/summit-ivonescimab/utils/deviceBrowsers.ts`):

| To change... | Edit... |
| --- | --- |
| Which resolutions exist | the `RESOLUTIONS` array (`{ name, width, height }`) |
| Which browsers exist | the `BROWSERS` array (`{ name, engine, channel? }`) |
| Default browser for the npm scripts | `DEFAULT_BROWSER` |
| Headless vs headed | `EXECUTION_MODE` (`'headless'` or `'headed'`; currently `'headed'` in both) |
| Output folder (`screenshots/<PROGRAM_KEY>/`) | `PROGRAM_KEY`; must match the program's `src/programs/<key>` folder |
| PDF filename label | `PROGRAM_NAME` (cosmetic only) |

If you add a resolution, also add a matching `screenshots:<program>:<name>` script to
`package.json` (copy an existing line and change `--device=`).

Known limitation (apotex-evdi): the HCP path's final Submit hits the same app bug as the
e2e test. The screenshot run tries it once. If it fails, the run skips only the
`hcp_success_default` capture, logs a warning, and continues with the HCP upload path.
Re-run if you need that capture.

Each program's `screenshots/README.md`
(`src/programs/apotex-evdi/screenshots/README.md`,
`src/programs/summit-ivonescimab/screenshots/README.md`) covers naming conventions and
how to add new captures.
