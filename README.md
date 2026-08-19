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


Commands to run — one per resolution:
Run from the repo root (c:\Users\LENOVO\Documents\Playwright_Automation):


npm run screenshots:xlDesktop
npm run screenshots:lDesktop
npm run screenshots:desktop
npm run screenshots:lTablet
npm run screenshots:pTablet
npm run screenshots:xsMobile
Each runs the Patient path fully, then the HCP path fully, for that one resolution, using Chrome (the default browser) and headless mode. Output lands in screenshots/PortalAutomation/<timestamp>/<resolution>_chrome/ (PNG + PDF folders).




All resolutions in one go:

npm run screenshots:all
Runs every resolution above sequentially (now continues past a failed resolution instead of aborting, per the review fix — check the console for a "Completed with failures for: ..." line at the end if any resolution had trouble).



Changing resolution ad hoc (without editing files):
Bypass the npm scripts and call the runner directly with --device=:

npx tsx src/screenshots/runner/run-all.ts --device=pTablet
Valid values: xlDesktop, lDesktop, Desktop, lTablet, pTablet, xsMobile (must match a name in RESOLUTIONS, see below).



Changing browser ad hoc:
Add --browser=:

npx tsx src/screenshots/runner/run-all.ts --device=xsMobile --browser=firefox
Valid values: chrome, edge, firefox, safari.



Permanently changing resolution / browser / headless-vs-headed:

Everything is controlled from one file: src/utils/deviceBrowsers.ts.

To change...	Edit...
Which resolutions exist	The RESOLUTIONS array (add/remove { name, width, height } entries)
Which browsers exist	The BROWSERS array (add/remove { name, engine, channel? } entries)
Default browser used by the npm scripts	DEFAULT_BROWSER constant
Headless vs headed	EXECUTION_MODE constant ('headless' or 'headed')
Output folder program name	PROGRAM_NAME constant
If you add a new resolution name, also add a matching screenshots:<name> line to package.json's scripts block (copy an existing one and swap the --device= value).





Where output goes

screenshots/PortalAutomation/<runTimestamp>/<resolution>_<browser>/
  PNG/all screenshots/*.png
  PDF/PortalAutomation_<resolution>_<browser>_<date>.pdf
One heads-up carried over from the final review: these scripts perform real submissions against the shared QA host (portal-qa.trialcard.com), including actual enrollment records — same as the existing test suite already does, not something new introduced here.