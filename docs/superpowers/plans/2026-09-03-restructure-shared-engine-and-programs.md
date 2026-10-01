# Restructure to Shared Engine + Per-Program Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current flat, single-program `src/` layout into `src/shared/`
(reusable engine code with zero program-specific knowledge) and
`src/programs/apotex-evdi/` (everything specific to this one site), with zero
behavior change, so a second similar program can later be onboarded by copying
the `apotex-evdi` folder.

**Architecture:** Two tasks, each a self-contained, independently-verifiable
move. Task 1 extracts the two truly generic screenshot-engine files
(`screenshotHelper.ts`, `pdfMerger.ts`) into `src/shared/screenshots-engine/`
and fixes their six consumers in place. Task 2 moves everything else —
`pages/modules/fixtures/testdata/utils/tests/config/screenshots` — as one
atomic batch into `src/programs/apotex-evdi/`, then updates
`playwright.config.ts` (single `testDir`+`baseURL` → a `projects[]` array),
`package.json` scripts, the program's own `.env` var name, and
documentation. This corresponds to Design sections A and B of
[docs/superpowers/specs/2026-09-03-multi-program-figma-design-validation-design.md](../specs/2026-09-03-multi-program-figma-design-validation-design.md).

**Tech Stack:** TypeScript, Playwright Test, tsx, dotenv, Git.

## Global Constraints

- No CI pipeline is currently wired up — `.github/workflows/playwright.yml`
  and `.github/workflows/smoke-tests.yml` are empty placeholder files. This
  restructure does not need to touch CI.
- `tsconfig.json` defines no path aliases (`compilerOptions.paths` is unset).
  Do not introduce path-alias tooling for this move — use explicit relative
  import paths, even where they end up several `../` deep. This keeps the
  move mechanical and low-risk, per the approved design.
- `.env` files are gitignored (unanchored `.env` pattern in `.gitignore`
  already covers any depth, e.g. `src/programs/apotex-evdi/.env` — no
  `.gitignore` change needed). Never write real secret values into any file
  that gets committed.
- Only one program (`apotex-evdi`) exists today. Do not invent per-program
  prefixes for the `screenshots:*` npm scripts — leave those script *names*
  as-is (only their target *paths* change). Only add the new
  `test:apotex-evdi` script and the new `projects[]` entry — per the
  approved design, that's the one accepted exception to pure copy-paste,
  and it isn't worth doing more than that until a second program actually
  exists.
- Every program's base URL env var must be namespaced (e.g.
  `APOTEX_EVDI_BASE_URL`, not a bare `BASE_URL`) so that loading a second
  program's `.env` into the same process later can never silently collide
  with this one's.
- This is a pure relocation: no test assertions, no locators, no runtime
  logic change anywhere. Every verification step must reproduce the exact
  same behavior as before the move.

---

### Task 1: Extract the shared screenshot engine

**Files:**
- Create: `src/shared/screenshots-engine/screenshotHelper.ts` (moved, no content change)
- Create: `src/shared/screenshots-engine/pdfMerger.ts` (moved, no content change)
- Create: `src/shared/screenshots-engine/index.ts`
- Modify: `src/screenshots/core/index.ts`
- Modify: `src/screenshots/runner/run-patient-path.ts:12` (import line only)
- Modify: `src/screenshots/runner/run-hcp-path.ts:12` (import line only)
- Modify: `src/screenshots/runner/run-all.ts:8` (import line only)
- Modify: `src/screenshots/pages/01_homePage.screenshot.ts:4` (import line only)
- Modify: `src/screenshots/pages/02_patientPath.screenshot.ts:10` (import line only)
- Modify: `src/screenshots/pages/03_hcpPath.screenshot.ts:9` (import line only)

**Interfaces:**
- Produces: `src/shared/screenshots-engine/index.ts` re-exports everything
  from `screenshotHelper.ts` (`RunContext`, `capture`, `buildRunTimestamp`,
  `createRunContext`, `pdfOutputPath`, `resetSequence`, and any other named
  exports already in that file) and `pdfMerger.ts` (`mergePngsToPdf`).
  Consumers import directly from the two files (matching the existing style
  of importing from `'../core/screenshotHelper'` rather than the barrel),
  not from the new `index.ts` — the barrel exists for future external
  consumers only, mirroring how `src/screenshots/core/index.ts` already
  worked.

- [ ] **Step 1: Create the destination folder and move the two engine files with `git mv`**

Run:
```bash
mkdir -p src/shared/screenshots-engine
git mv src/screenshots/core/screenshotHelper.ts src/shared/screenshots-engine/screenshotHelper.ts
git mv src/screenshots/core/pdfMerger.ts src/shared/screenshots-engine/pdfMerger.ts
```
Expected: both files now exist at their new paths, `git status` shows them
as renames.

- [ ] **Step 2: Create the shared engine's barrel file**

Create `src/shared/screenshots-engine/index.ts`:
```ts
export * from './screenshotHelper';
export * from './pdfMerger';
```

- [ ] **Step 3: Fix `src/screenshots/core/index.ts` to only re-export what's left there**

The file currently reads:
```ts
export * from './screenshotHelper';
export * from './dropdownExpander';
export * from './pdfMerger';
```
Replace its full contents with:
```ts
export * from './dropdownExpander';
```

- [ ] **Step 4: Fix the import in `src/screenshots/runner/run-patient-path.ts`**

Current line 12:
```ts
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../core/screenshotHelper';
```
And current line 13:
```ts
import { mergePngsToPdf } from '../core/pdfMerger';
```
Replace both with:
```ts
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../../shared/screenshots-engine/screenshotHelper';
import { mergePngsToPdf } from '../../shared/screenshots-engine/pdfMerger';
```
(From `src/screenshots/runner/run-patient-path.ts`: `../` reaches
`src/screenshots/`, `../../` reaches `src/`, then down into
`shared/screenshots-engine/` — two levels up, same depth as the `pages/`
files below, since `runner/` and `pages/` are both direct children of
`screenshots/`. This is shallower than Task 2's final depth, since
`screenshots/` hasn't moved into `programs/apotex-evdi/` yet.)

- [ ] **Step 5: Fix the same two import lines in `src/screenshots/runner/run-hcp-path.ts`**

Same replacement as Step 4, applied to that file's identical lines 12-13.

- [ ] **Step 6: Fix the same two import lines in `src/screenshots/runner/run-all.ts`**

Current lines 8-9:
```ts
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../core/screenshotHelper';
import { mergePngsToPdf } from '../core/pdfMerger';
```
Replace with:
```ts
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../../shared/screenshots-engine/screenshotHelper';
import { mergePngsToPdf } from '../../shared/screenshots-engine/pdfMerger';
```

- [ ] **Step 7: Fix the import in `src/screenshots/pages/01_homePage.screenshot.ts`**

Current line 4:
```ts
import { RunContext, capture } from '../core/screenshotHelper';
```
Replace with:
```ts
import { RunContext, capture } from '../../shared/screenshots-engine/screenshotHelper';
```
(Same two-level-up depth as the runner files in Steps 4-6 — `pages/` and
`runner/` are both direct children of `src/screenshots/`. This file only
imports `screenshotHelper`, not `pdfMerger`, so there's no second import
line to fix here.)

- [ ] **Step 8: Fix the import in `src/screenshots/pages/02_patientPath.screenshot.ts`**

Current line 10:
```ts
import { RunContext, capture } from '../core/screenshotHelper';
```
Replace with:
```ts
import { RunContext, capture } from '../../shared/screenshots-engine/screenshotHelper';
```
Leave line 11 (`import { expandGenderDropdown, ... } from '../core/dropdownExpander';`)
unchanged — `dropdownExpander.ts` is not moving in this task.

- [ ] **Step 9: Fix the import in `src/screenshots/pages/03_hcpPath.screenshot.ts`**

Current line 9:
```ts
import { RunContext, capture } from '../core/screenshotHelper';
```
Replace with:
```ts
import { RunContext, capture } from '../../shared/screenshots-engine/screenshotHelper';
```
Leave line 10 (`dropdownExpander` import) unchanged.

- [ ] **Step 10: Update the CLAUDE.md paragraph describing the engine split**

Find this paragraph in `CLAUDE.md` (under "### The screenshot framework is a
second consumer of the same POM"):
```markdown
`src/screenshots/` never adds its own locators — it only calls existing
`src/pages`/`src/modules` methods and adds reusable interaction helpers (e.g. dropdown
expansion) under `src/screenshots/core/`. `src/screenshots/core/screenshotHelper.ts` owns
the shared `RunContext` (output dirs, PNG manifest, auto-incrementing sequence number
across pages within one run); `pdfMerger.ts` merges the manifest into one ordered PDF at
the end of a run.
```
Replace it with:
```markdown
`src/screenshots/` never adds its own locators — it only calls existing
`src/pages`/`src/modules` methods and adds reusable interaction helpers (e.g. dropdown
expansion) under `src/screenshots/core/`. The actual capture engine —
`screenshotHelper.ts` (owns the shared `RunContext`: output dirs, PNG manifest,
auto-incrementing sequence number across pages within one run) and `pdfMerger.ts`
(merges the manifest into one ordered PDF) — lives in `src/shared/screenshots-engine/`,
not `src/screenshots/core/`, since neither file has any Apotex-specific knowledge.
`src/screenshots/core/` now holds only program-specific interaction helpers (e.g.
`dropdownExpander.ts`).
```
(Note: paths in this paragraph will change again, to `src/programs/apotex-evdi/...`,
in Task 2 — this edit only fixes the engine-location claim for now.)

- [ ] **Step 11: Type-check and run the fastest screenshot capture to verify no behavior change**

Run:
```bash
npx tsc --noEmit
npm run screenshots:xsMobile
```
Expected: `tsc` reports no errors. The screenshot run completes exactly as
it did before this task (same PNG count under
`screenshots/PortalAutomation/<new-timestamp>/xsMobile_chrome/PNG/all screenshots/`,
same single merged PDF under `.../PDF/`) — this is a live run against the
real QA host, so a small chance of the pre-existing HCP flaky-submit defect
skipping one capture is expected and not a regression.

- [ ] **Step 12: Commit**

```bash
git add src/shared src/screenshots CLAUDE.md
git commit -m "Extract shared screenshot engine (screenshotHelper, pdfMerger) out of src/screenshots/core"
```

---

### Task 2: Move everything else into `src/programs/apotex-evdi/` and rewire config

**Files:**
- Move (git mv, whole directories, no internal changes needed — see rationale below):
  `src/pages` → `src/programs/apotex-evdi/pages`
  `src/modules` → `src/programs/apotex-evdi/modules`
  `src/fixtures` → `src/programs/apotex-evdi/fixtures`
  `src/testdata` → `src/programs/apotex-evdi/testdata`
  `src/utils` → `src/programs/apotex-evdi/utils`
  `src/tests` → `src/programs/apotex-evdi/tests`
  `src/config` → `src/programs/apotex-evdi/config`
  `src/screenshots` → `src/programs/apotex-evdi/screenshots`
- Modify: `playwright.config.ts` (full rewrite)
- Modify: `package.json` (scripts block)
- Modify: `src/programs/apotex-evdi/config/index.ts` (dotenv path + env var name)
- Modify: `CLAUDE.md` (full rewrite)
- Modify: `src/programs/apotex-evdi/screenshots/README.md` (path-prefix fixes)
- Manual (not git-tracked): local `.env` file

**Rationale for why the 8 moved directories need zero import-line edits:**
every relative import inside `pages/`, `modules/`, `fixtures/`, `testdata/`,
`utils/`, `tests/` points to a sibling under the *old* `src/` root (e.g.
`modules/HcpEnrollmentModule.ts` imports `'../pages/LandingPage'` and
`'../testdata/types'`). Because all of these directories move together, as
a single batch, into the same new parent (`src/programs/apotex-evdi/`),
every one of those relative paths still resolves correctly — the depth
from any moved file to any other moved file is unchanged. The same is true
inside `screenshots/`: its imports to `pages/`, `testdata/`, `utils/` stay
the same depth, and its imports to the shared engine were already fixed to
their Task-2 depth... **wait, they weren't** — Task 1 fixed them assuming
`screenshots/` stayed directly under `src/`. Moving `screenshots/` two path
segments deeper (into `programs/apotex-evdi/`, which adds both a `programs/`
and an `apotex-evdi/` segment) makes those same six import lines two `../`
too shallow. This task corrects that as part of Step 2 below.

**Interfaces:**
- Produces: `playwright.config.ts` defines a `projects` array with one entry
  named `apotex-evdi`, `testDir: './src/programs/apotex-evdi/tests'`, and
  `use.baseURL` sourced from `process.env.APOTEX_EVDI_BASE_URL`.
- Produces: `src/programs/apotex-evdi/config/index.ts` exports `config:
  PortalConfig` with `config.baseURL` sourced from the same
  `APOTEX_EVDI_BASE_URL` env var (used by the screenshot runner scripts,
  which run outside the `playwright test` runner and so don't see
  `playwright.config.ts`'s `use.baseURL`).

- [ ] **Step 1: Move all eight directories with `git mv`**

Run:
```bash
mkdir -p src/programs/apotex-evdi
git mv src/pages src/programs/apotex-evdi/pages
git mv src/modules src/programs/apotex-evdi/modules
git mv src/fixtures src/programs/apotex-evdi/fixtures
git mv src/testdata src/programs/apotex-evdi/testdata
git mv src/utils src/programs/apotex-evdi/utils
git mv src/tests src/programs/apotex-evdi/tests
git mv src/config src/programs/apotex-evdi/config
git mv src/screenshots src/programs/apotex-evdi/screenshots
```
Expected: `git status` shows all eight as renames into
`src/programs/apotex-evdi/`.

- [ ] **Step 2: Re-fix the six screenshot-engine import lines Task 1 already touched, two levels deeper**

`src/programs/apotex-evdi/screenshots/` is now two path segments deeper than
it was in Task 1 (the extra `programs/` and `apotex-evdi/` segments), so
every import that reaches `src/shared/screenshots-engine/` needs two more
`../`.

In `src/programs/apotex-evdi/screenshots/runner/run-patient-path.ts`,
`run-hcp-path.ts`, and `run-all.ts`, find:
```ts
from '../../shared/screenshots-engine/screenshotHelper';
```
and
```ts
from '../../shared/screenshots-engine/pdfMerger';
```
Replace with (two more `../` each):
```ts
from '../../../../shared/screenshots-engine/screenshotHelper';
```
and
```ts
from '../../../../shared/screenshots-engine/pdfMerger';
```

In `src/programs/apotex-evdi/screenshots/pages/01_homePage.screenshot.ts`,
`02_patientPath.screenshot.ts`, and `03_hcpPath.screenshot.ts`, find:
```ts
from '../../shared/screenshots-engine/screenshotHelper';
```
Replace with:
```ts
from '../../../../shared/screenshots-engine/screenshotHelper';
```

All other imports in these six files (to `pages/`, `testdata/`, `utils/`,
`dropdownExpander`, sibling runner files) are unchanged — they stay the
same relative depth because `screenshots/`'s internal structure and its
siblings (`pages/`, `testdata/`, `utils/`) moved together.

- [ ] **Step 3: Rewrite `src/programs/apotex-evdi/config/index.ts`**

Current content:
```ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface PortalConfig {
  baseURL: string;
}

export const config: PortalConfig = {
  baseURL: process.env.BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/',
};
```
Replace with:
```ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export interface PortalConfig {
  baseURL: string;
}

export const config: PortalConfig = {
  baseURL: process.env.APOTEX_EVDI_BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/',
};
```
(`__dirname` is now `src/programs/apotex-evdi/config/`, so `../.env` correctly
resolves to `src/programs/apotex-evdi/.env` — one level up, not two.)

- [ ] **Step 4: Rewrite the root `playwright.config.ts`**

Current content:
```ts
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  use: {
    baseURL: process.env.BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```
Replace with:
```ts
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, 'src/programs/apotex-evdi/.env') });

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'apotex-evdi',
      testDir: './src/programs/apotex-evdi/tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.APOTEX_EVDI_BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/',
      },
    },
    // Onboarding a new program: add one entry here, e.g.
    // {
    //   name: '<new-program>',
    //   testDir: './src/programs/<new-program>/tests',
    //   use: {
    //     ...devices['Desktop Chrome'],
    //     baseURL: process.env.<NEW_PROGRAM>_BASE_URL ?? '<new-program-default-url>',
    //   },
    // },
  ],
});
```
Also add, immediately after the existing `dotenv.config(...)` call, a
one-line comment so the next program's onboarding step is obvious:
```ts
// Onboarding a new program: add another dotenv.config({ path: ... }) call
// here pointing at that program's own .env file. Because every program's
// base-URL var is namespaced (e.g. APOTEX_EVDI_BASE_URL), loading multiple
// programs' .env files into this one process is safe — dotenv won't
// override a key that's already set, and there's no shared key to collide.
```

- [ ] **Step 5: Update `package.json` scripts**

Current `scripts` block:
```json
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "report": "playwright show-report",
    "screenshots:xlDesktop": "tsx src/screenshots/runner/run-all.ts --device=xlDesktop",
    "screenshots:lDesktop": "tsx src/screenshots/runner/run-all.ts --device=lDesktop",
    "screenshots:desktop": "tsx src/screenshots/runner/run-all.ts --device=Desktop",
    "screenshots:lTablet": "tsx src/screenshots/runner/run-all.ts --device=lTablet",
    "screenshots:pTablet": "tsx src/screenshots/runner/run-all.ts --device=pTablet",
    "screenshots:xsMobile": "tsx src/screenshots/runner/run-all.ts --device=xsMobile",
    "screenshots:all": "tsx src/screenshots/runner/run-all-resolutions.ts"
  },
```
Replace with:
```json
  "scripts": {
    "test": "playwright test",
    "test:apotex-evdi": "playwright test --project=apotex-evdi",
    "test:headed": "playwright test --headed",
    "report": "playwright show-report",
    "screenshots:xlDesktop": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=xlDesktop",
    "screenshots:lDesktop": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=lDesktop",
    "screenshots:desktop": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=Desktop",
    "screenshots:lTablet": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=lTablet",
    "screenshots:pTablet": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=pTablet",
    "screenshots:xsMobile": "tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=xsMobile",
    "screenshots:all": "tsx src/programs/apotex-evdi/screenshots/runner/run-all-resolutions.ts"
  },
```

- [ ] **Step 6: Update the local `.env` file (manual, not committed)**

Check whether the value matters: `config/index.ts` and `playwright.config.ts`
both fall back to `'https://portal-qa.trialcard.com/apotex/evdi/'` when the
env var is unset, so this step is only needed if the local `.env` currently
overrides `BASE_URL` to something other than that default.

Open the repo-root `.env` file. If it contains a `BASE_URL=...` line, create
`src/programs/apotex-evdi/.env` containing `APOTEX_EVDI_BASE_URL=<same value>`,
then delete the `BASE_URL=...` line (or the whole old root `.env`, if it had
nothing else in it). If the root `.env` doesn't set `BASE_URL` (or doesn't
exist), no action is needed — the fallback default is already correct.

- [ ] **Step 7: Rewrite `CLAUDE.md`**

Replace the entire file contents with:
```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TypeScript + Playwright end-to-end test suite for the Apotex eVDI enrollment portal
(`https://portal-qa.trialcard.com/apotex/evdi/`, a Vuetify SPA), plus a separate
screenshot/visual-documentation tool that drives the same page objects. There is no
application source in this repo — this is a test/automation framework only.

The repo is structured to support more than one similar program (site) side by side —
see "Multi-program layout" below. Today there is exactly one program, `apotex-evdi`.

## Commands

\`\`\`bash
npm test                              # run every program's Playwright suite
npm run test:apotex-evdi              # run only the apotex-evdi program's suite
npm run test:headed                   # same, with a visible browser
npm run report                        # open the last HTML report (playwright-report/)
npx playwright test src/programs/apotex-evdi/tests/patient-enrollment.spec.ts   # run a single spec file
npx playwright test -g "routes to the not-eligible page"                        # run tests by title
\`\`\`

There is no lint/build/typecheck script wired up in `package.json` yet, even though
`.eslintrc.json`/`tsconfig.json` exist — don't assume `npm run lint` or `npm run build`
work without checking `package.json` first.

### Screenshot framework (separate from the test suite)

\`\`\`bash
npm run screenshots:xlDesktop   # 1920x1080
npm run screenshots:lDesktop    # 1440x1080
npm run screenshots:desktop     # 1024x1080
npm run screenshots:lTablet     # 1280x800
npm run screenshots:pTablet     # 768x1024
npm run screenshots:xsMobile    # 375x1080
npm run screenshots:all         # every resolution above, sequentially

# ad hoc, without editing files:
npx tsx src/programs/apotex-evdi/screenshots/runner/run-all.ts --device=pTablet --browser=firefox
\`\`\`

Each run drives the Patient path fully, then the HCP path fully, using Chrome by
default. Output goes to `screenshots/PortalAutomation/<timestamp>/<resolution>_<browser>/`
(PNG + a merged PDF), and `screenshots/` is gitignored. All resolution/browser/headless
config lives in one file: [src/programs/apotex-evdi/utils/deviceBrowsers.ts](src/programs/apotex-evdi/utils/deviceBrowsers.ts)
(`RESOLUTIONS`, `BROWSERS`, `DEFAULT_BROWSER`, `EXECUTION_MODE`, `PROGRAM_NAME`). Adding a
resolution also requires a matching `screenshots:<name>` script in `package.json`. See
[src/programs/apotex-evdi/screenshots/README.md](src/programs/apotex-evdi/screenshots/README.md)
for the full convention (naming, sequence numbering, where to add new captures).

## Multi-program layout

\`\`\`
src/
  shared/                        engine code with no program-specific knowledge —
                                  reused by every program, never duplicated per program
    screenshots-engine/          screenshotHelper.ts (capture/naming/manifest/sequence),
                                  pdfMerger.ts (manifest -> ordered PDF)
  programs/
    apotex-evdi/                 everything specific to this one site
      pages/  modules/  fixtures/  testdata/  utils/  config/  tests/  screenshots/
      .env                       APOTEX_EVDI_BASE_URL (program-specific secret/config)
\`\`\`

Onboarding a new, similar program: copy `src/programs/apotex-evdi/`, rename the folder
and its `.env` var prefix, edit locators/testdata to match the new site, and add one
entry to `playwright.config.ts`'s `projects[]` array plus matching `package.json`
script lines — the one accepted exception to pure copy-paste, consistent with the
existing per-resolution `screenshots:<name>` script convention. Never re-implement
`src/shared/` per program — if a program needs a fix there, it's fixed once, for every
program.

`src/shared/screenshots-engine/` only ever holds code with **zero** domain knowledge of
any one program (no locators, no field names, no site-specific quirks) — if you're
about to add something there that mentions Apotex, "Patient"/"HCP", or a specific field
name, it belongs in the program's own folder instead (e.g.
`src/programs/apotex-evdi/screenshots/core/dropdownExpander.ts`, which despite living
next to the engine is fully Apotex-specific — it hardcodes `input[name="gender"]`/
`input[name="state"]` and documents an Apotex-only combobox race condition).

Full rationale: [docs/superpowers/specs/2026-09-03-multi-program-figma-design-validation-design.md](docs/superpowers/specs/2026-09-03-multi-program-figma-design-validation-design.md).

## Architecture

**Page Object Model with a business-flow layer on top**, all under `src/programs/apotex-evdi/`:

- `pages/` — one class per screen, locators + low-level actions only
  (`LandingPage`, `EligibilityPage`, `PatientInformationPage`, `PatientConsentPage`,
  `NotEligiblePage`, `SuccessPage`).
- `modules/` — multi-page flows composed from page objects:
  `PatientEnrollmentModule` (landing → eligibility → patient info → consent) and
  `HcpEnrollmentModule` (landing → eligibility → patient info, no consent step — HCP's
  final "Submit" click on Patient Information *is* the terminal enrollment action).
- `fixtures/index.ts` — the custom Playwright `test`, extending base `test` with one
  fixture per page object plus `patientEnrollment`/`hcpEnrollment` module fixtures. All
  specs import `test`/`expect` from `../fixtures`, never from `@playwright/test` directly
  — this is the standard Playwright fixture pattern (recommended in Playwright's own
  docs), giving a single place to add/change fixtures instead of touching every spec, and
  keeping page-object construction centralized rather than `new`'d inline per test. Page
  objects, screenshot helpers, and runner scripts are exempt from this rule — they may
  import types/`expect` from `@playwright/test` directly since they aren't spec files.
  (This fixture-wiring code lives per-program, not in `src/shared/` — it wires this
  program's own pages/modules, so there's nothing generic to extract yet.)
- `testdata/types.ts` — domain types (`PortalRole`, `PortalAction`, `EligibilityAnswers`,
  `PatientInformationData`) specific to this program's form fields.
- `utils/DataGenerator.ts` — faker-based generation of patient data (NANP-valid phone
  numbers, valid birthdates, etc.) — never hardcode test data that this can generate.
  Lives per-program (not `src/shared/`) because it generates this program's own
  `PatientInformationData` shape.
- `config/index.ts` — reads `APOTEX_EVDI_BASE_URL` from this program's own `.env`
  (falls back to the QA host).
- `src/api/` (repo root, outside any program) is scaffolded but currently empty (no API
  layer implemented yet).

Index barrel files (`<folder>/index.ts`) re-export everything in that folder and are the
intended import path for consumers outside that folder — update them when adding a file.

### The screenshot framework is a second consumer of the same POM

`src/programs/apotex-evdi/screenshots/` never adds its own locators — it only calls
existing `pages`/`modules` methods and adds reusable interaction helpers (e.g. dropdown
expansion) under its own `screenshots/core/`. The actual capture engine —
`screenshotHelper.ts` (owns the shared `RunContext`: output dirs, PNG manifest,
auto-incrementing sequence number across pages within one run) and `pdfMerger.ts`
(merges the manifest into one ordered PDF) — lives in `src/shared/screenshots-engine/`,
since neither file has any Apotex-specific knowledge.

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
  [src/programs/apotex-evdi/tests/hcp-enrollment.spec.ts](src/programs/apotex-evdi/tests/hcp-enrollment.spec.ts)
  before touching retries/timeouts on that describe block. It's a real app bug, not a
  test flake to engineer around; the suite uses `test.describe.configure({ retries: 5 })`
  to absorb it as a hard pass/fail gate. The screenshot framework instead attempts it
  once and skips that one capture with a warning if it fails.
- Running the test suite or screenshot scripts performs real submissions against the
  shared QA host, including actual enrollment records — this is a live external system,
  not a mock.
- Each program's `BASE_URL` is namespaced per program (e.g. `APOTEX_EVDI_BASE_URL`, not a
  bare `BASE_URL`) in its own `.env` file, and `playwright.config.ts` loads every
  program's `.env` at startup. A bare, unnamespaced `BASE_URL` would silently collide the
  moment a second program's `.env` was loaded into the same process — namespacing avoids
  that without needing any extra tooling.

## Config/rule files that exist but are currently empty placeholders

`.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`,
`.github/instructions/{generator,healer,planner}.md`, `.augment/rules/*.md`,
`.github/workflows/{playwright,smoke-tests}.yml`, `docker-compose.yml`,
`rules/framework-rule-engine.json` + `scripts/rule-engine.js`, and
`skills/playwright-ai-mcp-tutor/SKILL.md` are all present but empty/unauthored. Don't
assume they encode conventions — check before relying on them, and don't be surprised if
they get filled in later.
```

- [ ] **Step 8: Rewrite `src/programs/apotex-evdi/screenshots/README.md`**

Replace the entire file contents with:
```markdown
# Screenshot Framework

Standalone visual-documentation/regression screenshot tooling, separate from
`src/programs/apotex-evdi/tests/`. It drives the existing
`src/programs/apotex-evdi/pages`/`modules` Page Object Model through the Patient and HCP
enrollment wizards at configurable resolutions, saving individually-named PNGs
incrementally and merging each run into a single ordered PDF.

## Folder layout

\`\`\`
src/shared/screenshots-engine/    engine - no business logic, no program-specific knowledge
  screenshotHelper.ts              capture + naming + folder-path builder + sequence counter
  pdfMerger.ts                     merges an ordered list of PNGs into one PDF

src/programs/apotex-evdi/screenshots/
  core/                            program-specific interaction helpers
    dropdownExpander.ts            opens/expands Gender + State comboboxes for a screenshot
  pages/                           3 files, one per shared page / path
    01_homePage.screenshot.ts      Landing page (both roles' default + role-selected states)
    02_patientPath.screenshot.ts   Eligibility -> Not-Eligible detour -> Patient Information -> Consent -> Success
    03_hcpPath.screenshot.ts       same shape, Not-Eligible detour first, no Consent step, 9-error validation instead of 10
  runner/
    run-patient-path.ts            Patient path only, one resolution
    run-hcp-path.ts                HCP path only, one resolution
    run-all.ts                     Patient path then HCP path, one resolution
    run-all-resolutions.ts         run-all for every resolution in deviceBrowsers.ts, in order
\`\`\`

Output is written to (not under `src/`):

\`\`\`
screenshots/
  PortalAutomation/
    <runTimestamp>/            e.g. 2026-08-18_14-32-07
      <resolutionName>_<browserName>/
        PNG/all screenshots/*.png
        PDF/PortalAutomation_<resolutionName>_<browserName>_<date>.pdf
\`\`\`

## Naming convention

Every capture is `<NN>_<path>_<page>_<state>.png`, e.g.
`08_patient_patientInformation_validationError_10errors.png`. `NN` is a
2-digit, zero-padded sequence number that increments continuously across
`01_homePage` into `02_patientPath`/`03_hcpPath` within one path run - it is
tracked by a shared counter in `screenshotHelper.ts`, so inserting or
removing a capture never requires manually renumbering anything else.

## Adding a new page or state to capture

1. Add a line to the relevant file in `src/programs/apotex-evdi/screenshots/pages/`
   calling `capture(page, context, 'descriptiveName')` at the point in the flow you
   want to snapshot. Only call existing `pages`/`modules` methods to get there - don't
   add new locators in these 3 files (put reusable new interaction helpers in
   `src/programs/apotex-evdi/screenshots/core/` instead, as `dropdownExpander.ts` does).
2. Nothing else needs to change - the sequence number and file path are
   derived automatically.

## Adding a new resolution

Add an entry to the `RESOLUTIONS` array in
`src/programs/apotex-evdi/utils/deviceBrowsers.ts`, then add a matching
`screenshots:<name>` npm script in `package.json` pointing at `run-all.ts --device=<name>`.

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
```

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If any appear, they'll point at a missed import-path
fix from Task 1/Step 2 above — fix and re-run before continuing.

- [ ] **Step 10: Run the full regression suite against the new project name**

Run: `npm run test:apotex-evdi`
Expected: same pass/fail outcome as a pre-restructure `npm test` run on this
branch (both spec files execute; the HCP spec's known flaky terminal-submit
defect, per `CLAUDE.md`, may still fail independent of this change — that is
not a regression to chase).

- [ ] **Step 11: Run the fastest screenshot capture again, end-to-end from the new paths**

Run: `npm run screenshots:xsMobile`
Expected: same output shape as Task 1's Step 11 run — a new timestamped
folder under `screenshots/PortalAutomation/`, same PNG count, one merged PDF.

- [ ] **Step 12: Commit**

```bash
git add -A src package.json playwright.config.ts CLAUDE.md
git commit -m "Move program-specific code into src/programs/apotex-evdi/; split playwright.config.ts into a projects[] array"
```
