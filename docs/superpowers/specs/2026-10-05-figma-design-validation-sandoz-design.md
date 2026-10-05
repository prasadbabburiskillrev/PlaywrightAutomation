# Figma Design Validation (Sandoz TYRUKO first) — Design

**Date:** 2026-10-05
**Status:** Approved in brainstorming; pending written-spec review
**Refines:** [2026-09-03-multi-program-figma-design-validation-design.md](2026-09-03-multi-program-figma-design-validation-design.md)
(same REST-API/committed-baseline decision, same shared-engine boundary; this
spec adds per-state baselines, out-of-order page support, and runs the check
as a Playwright project instead of standalone scripts).

## Problem

Developers and QA need to know whether the live portal matches the Figma
mockups the design team maintains. We have **view-only** access to Figma, so
the data must come from something a viewer can read. New programs arrive as
Azure DevOps stories per page, built **out of flow order**, so checks cannot
depend on a working end-to-end journey.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Fetch method | Figma **REST API + read-only personal access token**. Exact colours, typography, auto-layout values and node IDs. MCP rejected (seat-gated, rate-limited on Viewer seats). Images (PNG/JPG) give only approximate values and no node identity, so they are not a source of truth. |
| Images | Exported PNG/PDF per frame kept only as a **secondary** aid for human/AI visual review, never for pass/fail. |
| First scope | **Sandoz TYRUKO, Patient enrollment path**: Landing, Eligibility, Patient Information, Patient Authorization. Other paths follow the same pattern later. |
| Breakpoints | **Desktop and mobile** (frame sizes as in Figma; live viewports set to match each frame's width). |
| Gating | **Report-only** at launch. Switch to hard-fail is an explicit, documented later decision. |
| Architecture | Manual **sync script** writes committed baseline JSON; comparison runs as a **Playwright project** reusing existing fixtures/page objects. |
| Access status | No token or file link yet. Everything except the live sync is buildable and testable offline. |

## Non-goals

- Pixel-diff / image-comparison visual regression.
- Fetching Figma at test-run time, or needing the token in CI.
- Gating CI on design mismatches (until explicitly promoted).
- Covering HCP, Pharmacy, Transition, Upload paths in the first version.
- Submitting any form: design checks only read pages (no enrollment records
  are created on the shared QA host).

## Design

### A. Layout

```
src/shared/design-validation-engine/        program-agnostic; no Sandoz/Patient/field knowledge
  types.ts                  FigmaComponentBaseline, MappingEntry, CompareResult, ...
  figmaClient.ts            REST wrapper: fetch nodes, export images, retry/rate-limit
  extractFigmaMetadata.ts   Figma node tree -> baseline records
  extractSiteMetadata.ts    Playwright locator -> computed style/box/text
  compare.ts                exact + tolerance rules, hex normalisation
  report.ts                 report.json + index.html writer
src/programs/sandoz-tyruko-copay/design-validation/
  manifest.ts               page -> states -> Figma node IDs, entry strategy, status
  mapping/<page>.<state>.ts Figma node -> locator + check list + tolerance
  baseline/<page>/<state>.<breakpoint>.json     committed snapshots
  baseline/images/...       optional exported frame PNGs
  tests/design-check.spec.ts                    generated-per-state tests
```

Rule carried over from CLAUDE.md: `src/shared/` holds nothing that mentions a
program, role or field name; those live in the program folder.

### B. Storage: one baseline file per page state per breakpoint

- Not one big file (a sync of one page must not touch others; diffs stay
  reviewable; a failed fetch can only damage the file it was writing).
- A **state** is a named variant of a page: `default`, `requiredErrors`,
  `ageValidationError`, `stateDropdownOpen`, etc. Each state has its own Figma
  frames and its own element mapping, because an error-state frame contains
  elements (error banner, red borders) the default frame does not.
- A state that needs interaction declares `reach(fixtures)` using existing page
  objects (e.g. submit empty, wait for the error banner).

### C. Manifest

```ts
{
  page: 'eligibility',
  storyId: 'AB#12345',                    // optional Azure DevOps story
  status: 'ready',                        // 'pending' | 'ready'
  entry: { kind: 'url', path: 'patient/eligibility/' },   // or { kind: 'flow', reach }
  states: {
    default:        { figma: { desktop: '123:456', mobile: '123:789' } },
    requiredErrors: { figma: { desktop: '123:900', mobile: '123:901' },
                      reach: async (fx) => { /* submit empty, await banner */ } },
  },
}
```

### D. Pages developed out of order

Each page is checked independently of the journey.

- **Entry strategy per page:** `url` (go straight to the path; no dependency on
  earlier pages) or `flow` (reach via page objects) when the app guards routes.
  **Observed on the shared QA host:** opening
  `/86064/pharmacy/patient-information/` directly redirected to the landing
  page, so deep links must be verified per page, not assumed.
- **Status and skipping:** a page that is `pending`, has no baseline yet, or is
  not reachable is reported **skipped with a reason**; it never fails the run
  or blocks other pages.
- **Incremental sync:** `figma:sync:sandoz-tyruko-copay -- --page eligibility`
  fetches only that page's frames, run when the story's mockup is final.
- **Mapping without page objects:** a mapping may use a plain Playwright
  locator, so a page built before its page object exists can still be checked.
- **Traceability:** optional `storyId` ties report rows back to the Azure story.

### E. Sync script (`figma:sync:sandoz-tyruko-copay`, manual only)

1. Reads `FIGMA_TOKEN` (root `.env`) and `FIGMA_FILE_KEY` (program `.env`);
   node IDs come from the manifest.
2. `GET /v1/files/:key/nodes?ids=...`; for each mapped node extracts text
   (`characters`), fill colour (hex), typography (family, size, weight, line
   height), auto-layout padding/`itemSpacing`, and bounding box.
3. Verifies every mapped node still exists; otherwise exits non-zero naming
   page, state and node.
4. Writes to a temp file, then atomically replaces the committed baseline only
   on full success for that file. Pages sync independently; failures are listed
   at the end.
5. Optionally exports each frame as PNG into `baseline/images/`.
6. Baseline JSON validated against `FigmaComponentBaseline` on write and read.

### F. Comparison (`design-check-sandoz-tyruko-copay` Playwright project)

Per page, state and breakpoint: set viewport to the frame width, enter the page
(`entry`), run the state's `reach`, then for each mapped element read
`getComputedStyle`, `boundingBox` and `textContent` and compare.

| Property | Rule |
|---|---|
| Text | Exact after trimming whitespace |
| Text and fill colour | Exact (hex-normalised: `#FFF` = `#ffffff`, `rgb()` -> hex) |
| Font family (first in stack), size, weight, line height | Exact |
| Width, height | ±3px default |
| Position relative to the page container (not the browser window) | ±3px default |
| Padding, gap | ±3px default |

Tolerance and the list of checked properties are overridable per element.

### G. Gating and report

- Every check records `pass`, `fail` or `skipped` (with reason). The Playwright
  test passes; mismatches are attached to the report, not raised as assertions.
- `DESIGN_CHECK_STRICT=1` turns mismatches into real failures. Making that the
  default is a separate, documented decision (as in the 2026-09-03 spec).
- Output in its own `design-report/` folder (never the screenshot framework's):
  `report.json` (one entry per element: state, breakpoint, expected, actual,
  delta, result) and `index.html` (fails first; live screenshot beside the
  exported Figma PNG when present).

### H. Error handling

- Sync: missing token/file key -> non-zero exit naming the variable; 403/404
  distinguished (no access vs. wrong key); 429 -> honour `Retry-After`, retry a
  few times, then stop without touching baselines.
- Check: locator matches nothing -> that element recorded "not found on live
  page", rest of the page still runs; page unreachable or `reach()` throws ->
  state skipped with reason; mapped node missing from baseline -> reported as
  "run figma:sync", not as a design mismatch.

### I. Security

- Token scope **File content: Read-only** only; stored in gitignored root
  `.env`; `.env.example` holds placeholders. Set a 30/60/90-day expiry.
- Used only by the manual sync script; `npm test` and CI never need it.
- Baselines contain design text/colours: confirm the repo is private before
  committing real Sandoz mockup data.

### J. Testing the framework

- Offline unit tests: compare rules (exact, tolerance edges, hex/rgb
  normalisation); extraction against a saved sample Figma REST response; client
  against a mocked `fetch` (403, 404, 429, missing node).
- One live end-to-end run on a single Sandoz page once the token and file link
  exist.

### K. Known limits

- Figma frames are design-time layouts; responsive behaviour can differ from a
  frame by more than 3px without being a defect, hence per-element tolerance
  and report-only launch.
- Text split across several inline elements needs the locator to target the
  right element.
- Text that is placeholder copy in Figma should be excluded from the `text`
  check for that element.

## Delivery order (each step usable on its own)

1. Shared engine: types, client, Figma extractor, compare (offline-tested).
2. Sync script and atomic baseline writing.
3. Site metadata extractor and report.
4. Sandoz scaffold: Patient enrollment path, `default` states first, then error
   states.
5. Docs: CLAUDE.md and `docs/onboarding-new-program.md` (include the new
   program onboarding steps for design-validation).

## Open items (need input, not blockers for steps 1-3)

- Figma personal access token (Read-only) and the Sandoz Figma file link/key.
- Node IDs of the desktop and mobile frames per page and state.
- Confirmation that the repo is private before committing baselines.
