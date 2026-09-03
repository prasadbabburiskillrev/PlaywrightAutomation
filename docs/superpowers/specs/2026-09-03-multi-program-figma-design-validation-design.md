# Multi-Program Architecture + Figma Design-Validation Pillar — Design

**Date:** 2026-09-03
**Status:** Approved

## Problem

The repo currently assumes exactly one program (Apotex eVDI). `pages/modules/
fixtures/testdata/tests/screenshots` all live in shared top-level `src/`
folders with no program boundary, one `playwright.config.ts`, one `.env`/
`BASE_URL`. Onboarding a second, similar site isn't a simple copy-paste-rename
today, because a "program" isn't one folder — its pieces are scattered across
six top-level directories. There is also currently no way to validate the
live site's structure/style against the Figma mockups the design team
maintains.

## Goals

- Support N programs (similar sites) side by side, onboarded by copying one
  folder, renaming it, and editing locators/testdata/config — without
  touching shared engine code.
- Add a third pillar, `design-validation`, alongside the existing `tests`
  (regression) and `screenshots` pillars: compares the live site's
  structure/style against Figma-derived baselines, for the breakpoints that
  have real Figma mockups (1 desktop, 1 mobile). Kept fully separate from
  regression and screenshots.
- Keep reusable engine code (`DataGenerator`, the fixture-wiring pattern, the
  screenshot core helpers, the new design-validation engine) in one shared
  location, not duplicated per program — so it's viewed/fixed once, not once
  per program.

## Non-Goals

- Not building pixel-level visual regression (Percy/Chromatic-style image
  diffing) — the existing screenshot framework's PNG capture already covers
  human visual review informally.
- Not gating CI on design-validation results initially — report-only until an
  explicit promotion decision is made (see Gating below).
- Not fetching Figma data live at test-run time — the baseline is a periodic
  snapshot committed to the repo (Method 1, decided over the MCP-server
  alternative, which is seat-gated and rate-limited to a few calls/month on a
  Viewer seat).

## Design

### A. Folder layout

Everything stays under the existing `src/` root — this repo is a single
npm package with no workspace tooling set up, so a top-level `packages/`
directory would imply monorepo infrastructure that doesn't exist here.
`src/shared/` keeps the same single-package convention already in place.

```
src/
  shared/                            (shared engine, new — reused by every program)
    screenshots-engine/              (moved from src/screenshots/core: screenshotHelper.ts,
                                       pdfMerger.ts only — see note below)
    design-validation-engine/
      figmaClient.ts                 Figma REST API wrapper
      extractSiteMetadata.ts         Playwright getComputedStyle/boundingBox/textContent helper
      compare.ts                     comparator (exact match text/color/font;
                                       tolerant spacing/padding/position)
      report.ts                      JSON + generated markdown/HTML summary
      types.ts                       FigmaComponentBaseline, ComparisonResult, etc.

  programs/
    apotex-evdi/
      pages/  modules/  fixtures/  testdata/  utils/  config/
                                    (moved, unchanged — program-specific locators/domain
                                     types/fixture-wiring/data-generation/config)
      tests/                        (moved from src/tests — regression specs; name kept as-is,
                                       no value in renaming to "regression/")
      screenshots/                  (moved from src/screenshots/pages + runner + the
                                       program-specific part of core/ — see note below)
      design-validation/
        baseline/<page>.desktop.json
        baseline/<page>.mobile.json
        mapping/<page>.ts           Figma node id/name -> page-object locator,
                                       + optional per-component tolerance override
      .env                          APOTEX_EVDI_BASE_URL, FIGMA_FILE_KEY,
                                       FIGMA_DESKTOP_NODE_ID, FIGMA_MOBILE_NODE_ID
    <new-program>/                  ← onboarding a program = copy this whole subtree,
                                       rename (including the `.env` var prefix), edit
                                       locators/testdata/.env
```

**Note on `fixtures/`, `DataGenerator.ts`, and `dropdownExpander.ts` — not shared.**
Verified at the file level: `fixtures/index.ts` wires only this program's own pages/
modules (there's no generic fixture base to extract yet — `base.extend` is called
directly, once, per program); `DataGenerator.ts` imports `PatientInformationData`, a
domain type specific to this program's form fields; and
`screenshots/core/dropdownExpander.ts` hardcodes this program's own field names
(`input[name="gender"]`, `input[name="state"]`) and documents an Apotex-only combobox
race condition. None of the three has any logic a second program could reuse as-is, so
per YAGNI they stay in `programs/apotex-evdi/`, not `src/shared/`, until a second
program actually reveals a genuine duplication to extract. Only `screenshotHelper.ts`
and `pdfMerger.ts` (pure file I/O, sequence counting, PDF merging — zero domain
knowledge) qualify as shared engine code today.

Only program-specific *data* (locators, testdata, mapping, baseline, config)
lives under `src/programs/<name>/`. Engine code lives once, under
`src/shared/`, and every program imports it rather than owning its own copy —
this is the "view/fix it once" split.

Root `.env` holds the one cross-program secret: `FIGMA_TOKEN` (read-only
PAT). `.env.example` documents both root- and program-level keys with
placeholder values only.

### B. Test runner wiring

One root `playwright.config.ts` with a `projects[]` entry per program
(Playwright's own idiomatic multi-site pattern — one unified HTML report with
a tab per project, one place to keep timeout/reporter settings in sync):

```ts
projects: [
  { name: 'apotex-evdi', testDir: 'src/programs/apotex-evdi/tests',
    use: { baseURL: process.env.APOTEX_EVDI_BASE_URL } },
  // { name: '<new-program>', testDir: 'src/programs/<new-program>/tests', use: { ... } },
]
```

`package.json` scripts: `test:apotex-evdi` (`playwright test --project=apotex-evdi`)
is added; `screenshots:<res>` scripts keep their existing unprefixed names (only their
target paths change) since only one program exists today — prefixing them
(`screenshots:apotex-evdi:<res>`, `figma:sync:apotex-evdi`, `design-check:apotex-evdi`)
is deferred until a second program actually needs the disambiguation, per YAGNI.
Onboarding a program = copy `src/programs/apotex-evdi/`, rename (including the `.env`
var prefix), edit locators/testdata/`.env`, add one `projects[]` entry + matching
script lines — the one accepted exception to pure copy-paste, consistent with the
existing `screenshots:<resolution>` convention already in this repo.

### C. Figma baseline sync (`figma:sync:<program>` — manual/periodic only, never part of `npm test` or CI)

1. Reads `FIGMA_TOKEN` (root `.env`) + `FIGMA_FILE_KEY`/node IDs (program
   `.env`).
2. Calls the Figma REST API (`GET /v1/files/:key/nodes?ids=...`) for the
   desktop + mobile mockup frames. (Not the seat-gated MCP connector — the
   REST API only requires the token owner to have view access to the file.)
3. Walks the node tree; for each node referenced in `design-validation/
   mapping/<page>.ts`, extracts: fill color (hex), typography (family/size/
   weight/line-height), autolayout `itemSpacing`/`padding`, `absoluteBoundingBox`
   (position/size), `characters` (text content).
4. **Validates every mapped node id still exists in the fetched tree** — fails
   loudly (non-zero exit, error naming the missing node) rather than silently
   skipping or comparing against stale data.
5. Writes to a temp file first, then atomically replaces the committed
   `baseline/<page>.<breakpoint>.json` only on full success — a partial or
   rate-limited fetch never corrupts a good baseline.
6. Baseline JSON is typed/validated against `FigmaComponentBaseline` (in
   `design-validation-engine/types.ts`) at both write and read time.

### D. Comparison (`design-check:<program>`)

For each mapped component, at each of the 2 covered breakpoints:

- Text, color, font family/size/weight: **exact match**.
- Spacing/padding/position: **±1-5px tolerance**, default 3px, overridable
  per-component in the mapping file (a large hero region and a small button
  don't need the same tolerance).
- Navigates the site by reusing the same page-object/module navigation as
  regression, rather than re-driving the full enrollment flow separately —
  avoids doubling up real submissions against the shared QA host.
- Output: `report.json` (machine-readable, one entry per component with
  pass/fail + actual vs. expected) plus a generated markdown/HTML summary for
  human review. Reuses the screenshot framework's `RunContext`/manifest
  *pattern*, but its own independent instance — so a design-validation bug
  can't corrupt the screenshot pipeline.

### E. Gating

Report-only at launch — mismatches are visible in the report but don't fail
the run, since mapping/tolerances are still being tuned. Promotion to a hard
gate (mirroring regression's pass/fail behavior) requires an explicit,
documented decision later (e.g. after N consecutive clean runs, or manual
sign-off) — not an implicit "we'll get to it," following the same
explicit-intent precedent CLAUDE.md already sets for the HCP flaky-defect
handling.

## Security

- Figma PAT scoped to **File content: Read-only** only — cannot write or
  delete anything even if leaked.
- Stored in root `.env` (gitignored, same convention as the existing
  `BASE_URL` secret handling); `.env.example` ships placeholders only.
- Used exclusively by the manual/periodic sync script — never invoked
  automatically by `npm test` or CI, so it's never on a hot path and never
  needs to be a CI secret.
- Recommend setting a token expiration in Figma's token UI (30/60/90 day) so
  a leaked token has a bounded lifetime.

## Files/Folders Touched

- New: `src/shared/` — engine code moved out of the flat `src/` layout
  (shared across all programs).
- New: `src/programs/apotex-evdi/` — all existing program-specific code moved
  in, unchanged logic.
- New: `src/programs/apotex-evdi/design-validation/` — entirely new pillar.
- Modified: `playwright.config.ts` (root, `projects[]`), `package.json`
  (per-program scripts), `.env`/`.env.example`, `CLAUDE.md` (document the new
  layout, the report-only/promotion rule, and the read-only-PAT security
  note, following its existing "non-obvious behavior" convention).
- Removed: old flat `src/pages`, `src/modules`, `src/fixtures`, `src/testdata`,
  `src/tests`, `src/screenshots` (relocated, not duplicated).

## Effort & Risk

Relative sizing, not fabricated hours — no velocity data exists for this
repo/team, and Phase C's size still depends on the real Figma file's
layer-naming quality, which hasn't been inspected yet (blocked earlier by
seat-gated MCP access; resolved via the REST API + PAT approach once a token
is generated).

- **Restructure (A/B):** small-medium, mechanical, low risk — single pass,
  verified by re-running the existing suite + one screenshot capture.
- **Figma sync (C):** medium — largest open unknown is the real file's
  layer-naming quality.
- **Site extractor + mapping (D):** medium to build once; mapping authoring
  scales per component/page going forward, not a one-time cost.
- **Comparator + report (D/E):** small-medium, plus 1-2 tolerance-tuning
  passes once real data flows through.

## Testing / Verification

- After restructuring: `npm run test:apotex-evdi` and one `npm run
  screenshots:xsMobile` run must produce identical results to today's
  `npm test`/`npm run screenshots:xsMobile` (same pass/fail, same output
  shape) — proves the move didn't change behavior. (`screenshots:xsMobile`
  keeps its existing unprefixed name — see Section B.)
- After the Figma pillar lands: `npm run figma:sync` followed by `npm run
  design-check` against an unmodified live site should produce a clean (or
  near-clean, pending tolerance tuning) report — a first real run is
  expected to surface mapping/tolerance issues to fix, not a bug in the
  harness. (These stay unprefixed too, for the same reason as
  `screenshots:xsMobile`, until a second program exists.)
