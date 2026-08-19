# Shared Run Context for Patient+HCP Screenshot Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `runAll()` capture Patient and HCP screenshots for one device/browser into a single shared timestamp folder with continuous numbering and one combined PDF, while leaving standalone `run-patient-path.ts`/`run-hcp-path.ts` CLI usage unchanged.

**Architecture:** Give `runPatientPath()` and `runHcpPath()` an optional third parameter, an already-built `RunContext`. When present (called from `runAll()`), the function writes into that shared context instead of building its own timestamp/sequence/directory, and skips its own PDF merge. When absent (today's standalone CLI entry points), behavior is unchanged. `runAll()` becomes the context owner: it builds the shared `RunContext` once, passes it to both path functions in sequence, then performs a single combined PDF merge over the full `context.manifest` at the end.

**Tech Stack:** TypeScript (strict), `@playwright/test` raw launchers, `tsx` to run `.ts` files directly, `pdf-lib` (via existing `mergePngsToPdf`).

## Global Constraints

- Do not change `src/screenshots/core/screenshotHelper.ts`, `src/screenshots/core/pdfMerger.ts`, `src/screenshots/pages/*.screenshot.ts`, or `src/screenshots/core/dropdownExpander.ts` — this change is scoped to the three `runner/*.ts` files listed below.
- `run-all-resolutions.ts` is unmodified — it still calls `runAll()` once per resolution, so each resolution keeps its own timestamp folder.
- Standalone execution (`npx tsx src/screenshots/runner/run-patient-path.ts --device=...` or the HCP equivalent, run directly rather than through `run-all.ts`) must keep producing its own timestamp folder, own numbering from `01`, and own PDF — unchanged from today.
- No unit tests precede this change, consistent with how these same three files were originally built (thin orchestration over already-verified lower-level helpers — see `docs/superpowers/plans/2026-08-18-screenshot-framework.md` Task 8) — verified instead via a live integration run and a disk-output check.
- This repo has no git (`git status` reports "not a git repository") — skip any commit steps; edits are the deliverable.

---

## File Structure

No new files. Three existing files modified:

- `src/screenshots/runner/run-patient-path.ts` — `runPatientPath()` gains an optional `sharedContext` parameter; context creation and PDF merge become conditional on its absence.
- `src/screenshots/runner/run-hcp-path.ts` — mirrors the same change for `runHcpPath()`.
- `src/screenshots/runner/run-all.ts` — becomes the context owner: builds one `RunContext`, passes it into both path functions, performs the single combined PDF merge.

---

### Task 1: Optional shared context in `run-patient-path.ts`

**Files:**
- Modify: `src/screenshots/runner/run-patient-path.ts:28-81`

**Interfaces:**
- Consumes: `RunContext`, `buildRunTimestamp`, `createRunContext`, `pdfOutputPath`, `resetSequence`, `mergePngsToPdf` (all already imported, unchanged), `PROGRAM_NAME`, `getResolution`, `getBrowser`, `DEFAULT_BROWSER`, `BrowserName` (unchanged).
- Produces: `runPatientPath(resolutionName: string, browserName?: BrowserName, sharedContext?: RunContext): Promise<RunContext>` — new optional 3rd parameter. Consumed by `run-all.ts` (Task 3).

- [ ] **Step 1: Change the function signature and make context creation conditional**

Replace lines 28-37 of `src/screenshots/runner/run-patient-path.ts`:

```ts
export async function runPatientPath(resolutionName: string, browserName: BrowserName = DEFAULT_BROWSER): Promise<RunContext> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName);
  const deviceType = `${resolution.name}_${browserDef.name}`;
  const runTimestamp = buildRunTimestamp();

  console.log(`Running screenshots against: ${config.baseURL} (resolution: ${resolutionName}, browser: ${browserDef.name})`);

  resetSequence();
  const context = createRunContext(PROGRAM_NAME, deviceType, runTimestamp);
```

with:

```ts
export async function runPatientPath(
  resolutionName: string,
  browserName: BrowserName = DEFAULT_BROWSER,
  sharedContext?: RunContext
): Promise<RunContext> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName);
  const deviceType = `${resolution.name}_${browserDef.name}`;

  console.log(`Running screenshots against: ${config.baseURL} (resolution: ${resolutionName}, browser: ${browserDef.name})`);

  let context: RunContext;
  if (sharedContext) {
    context = sharedContext;
  } else {
    const runTimestamp = buildRunTimestamp();
    resetSequence();
    context = createRunContext(PROGRAM_NAME, deviceType, runTimestamp);
  }
```

- [ ] **Step 2: Make the PDF merge conditional on standalone mode**

Replace lines 69-72 (the dateStamp/merge block, now shifted slightly by Step 1's edit — locate by content, not line number):

```ts
  const dateStamp = runTimestamp.split('_')[0];
  if (context.manifest.length > 0) {
    await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));
  }
```

with:

```ts
  if (!sharedContext) {
    const dateStamp = context.runTimestamp.split('_')[0];
    if (context.manifest.length > 0) {
      await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));
    }
  }
```

This drops the now-undefined local `runTimestamp` reference (it no longer exists outside the `else` branch from Step 1) in favor of `context.runTimestamp`, which is populated identically in both branches.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Standalone smoke-check (unchanged behavior)**

Run: `npx tsx src/screenshots/runner/run-patient-path.ts --device=xsMobile`
Expected: completes without throwing; creates its own new timestamp folder under `screenshots/PortalAutomation/` containing `xsMobile_chrome/PNG/all screenshots/` (14 PNGs, `01`..`14`) and its own PDF under `PDF/` — exactly like before this change, confirming the no-`sharedContext` path is untouched.

---

### Task 2: Optional shared context in `run-hcp-path.ts`

**Files:**
- Modify: `src/screenshots/runner/run-hcp-path.ts:28-81`

**Interfaces:**
- Consumes: same as Task 1.
- Produces: `runHcpPath(resolutionName: string, browserName?: BrowserName, sharedContext?: RunContext): Promise<RunContext>` — mirrors Task 1's signature change. Consumed by `run-all.ts` (Task 3).

- [ ] **Step 1: Change the function signature and make context creation conditional**

Replace lines 28-37 of `src/screenshots/runner/run-hcp-path.ts`:

```ts
export async function runHcpPath(resolutionName: string, browserName: BrowserName = DEFAULT_BROWSER): Promise<RunContext> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName);
  const deviceType = `${resolution.name}_${browserDef.name}`;
  const runTimestamp = buildRunTimestamp();

  console.log(`Running screenshots against: ${config.baseURL} (resolution: ${resolutionName}, browser: ${browserDef.name})`);

  resetSequence();
  const context = createRunContext(PROGRAM_NAME, deviceType, runTimestamp);
```

with:

```ts
export async function runHcpPath(
  resolutionName: string,
  browserName: BrowserName = DEFAULT_BROWSER,
  sharedContext?: RunContext
): Promise<RunContext> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName);
  const deviceType = `${resolution.name}_${browserDef.name}`;

  console.log(`Running screenshots against: ${config.baseURL} (resolution: ${resolutionName}, browser: ${browserDef.name})`);

  let context: RunContext;
  if (sharedContext) {
    context = sharedContext;
  } else {
    const runTimestamp = buildRunTimestamp();
    resetSequence();
    context = createRunContext(PROGRAM_NAME, deviceType, runTimestamp);
  }
```

- [ ] **Step 2: Make the PDF merge conditional on standalone mode**

Replace lines 69-72 (the dateStamp/merge block, shifted slightly by Step 1's edit — locate by content):

```ts
  const dateStamp = runTimestamp.split('_')[0];
  if (context.manifest.length > 0) {
    await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));
  }
```

with:

```ts
  if (!sharedContext) {
    const dateStamp = context.runTimestamp.split('_')[0];
    if (context.manifest.length > 0) {
      await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));
    }
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Standalone smoke-check (unchanged behavior)**

Run: `npx tsx src/screenshots/runner/run-hcp-path.ts --device=xsMobile`
Expected: completes (or logs the known-flaky HCP terminal-submit warning and still completes — see `03_hcpPath.screenshot.ts`); creates its own new timestamp folder with `xsMobile_chrome/PNG/all screenshots/` (11-12 PNGs, `01`..) and its own PDF — confirming standalone mode is unaffected.

---

### Task 3: `run-all.ts` builds and owns the shared context

**Files:**
- Modify: `src/screenshots/runner/run-all.ts` (entire file)

**Interfaces:**
- Consumes: `runPatientPath(resolutionName, browserName?, sharedContext?)` (Task 1), `runHcpPath(resolutionName, browserName?, sharedContext?)` (Task 2), `getResolution`, `getBrowser`, `DEFAULT_BROWSER`, `PROGRAM_NAME`, `BrowserName` (from `../../utils/deviceBrowsers`), `RunContext`, `buildRunTimestamp`, `createRunContext`, `resetSequence`, `pdfOutputPath` (from `../core/screenshotHelper`), `mergePngsToPdf` (from `../core/pdfMerger`).
- Produces: `runAll(resolutionName: string, browserName?: BrowserName): Promise<void>` — same public signature as before (no caller elsewhere needs to change, including `run-all-resolutions.ts` and the `package.json` `screenshots:*` scripts).

- [ ] **Step 1: Replace the full contents of `run-all.ts`**

```ts
import {
  BrowserName,
  DEFAULT_BROWSER,
  PROGRAM_NAME,
  getBrowser,
  getResolution,
} from '../../utils/deviceBrowsers';
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../core/screenshotHelper';
import { mergePngsToPdf } from '../core/pdfMerger';
import { runPatientPath } from './run-patient-path';
import { runHcpPath } from './run-hcp-path';

export async function runAll(resolutionName: string, browserName?: BrowserName): Promise<void> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName ?? DEFAULT_BROWSER);
  const deviceType = `${resolution.name}_${browserDef.name}`;
  const runTimestamp = buildRunTimestamp();

  resetSequence();
  const context: RunContext = createRunContext(PROGRAM_NAME, deviceType, runTimestamp);

  let runError: unknown;
  try {
    // Patient path fully, then HCP path fully - never interleaved. Both
    // write into the same shared context, so numbering continues across
    // paths instead of resetting, and they land in one timestamp folder.
    await runPatientPath(resolutionName, browserName, context);
    await runHcpPath(resolutionName, browserName, context);
  } catch (error) {
    runError = error;
  }

  const dateStamp = runTimestamp.split('_')[0];
  if (context.manifest.length > 0) {
    await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));
  }

  if (runError) {
    throw runError;
  }
}

if (require.main === module) {
  const deviceArg = process.argv.find((a) => a.startsWith('--device='));
  const browserArg = process.argv.find((a) => a.startsWith('--browser='));
  const resolutionName = deviceArg ? deviceArg.split('=')[1] : 'xlDesktop';
  const browserName = browserArg ? (browserArg.split('=')[1] as BrowserName) : undefined;

  runAll(resolutionName, browserName).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Live smoke run through `runAll` (the actual bug scenario)**

Run: `npm run screenshots:xsMobile`
Expected: completes without throwing (allowing for the pre-existing known-flaky HCP terminal-submit warning, which is not a failure).

- [ ] **Step 4: Verify the combined-folder, continuous-numbering, single-PDF output on disk**

```bash
ls "screenshots/PortalAutomation"
```

Expected: exactly **one** new timestamp folder from this run (compare against the folder list from before Step 3, since old runs may already exist from prior testing).

```bash
ls "screenshots/PortalAutomation/<the new timestamp>/xsMobile_chrome/PNG/all screenshots"
```

Expected: PNGs numbered continuously `01` through `25` or `26` (Patient's 14 files `01_patient_...`..`14_patient_...`, immediately followed by HCP's files starting at `15_hcp_...` and going through `25` or `26` depending on whether the flaky HCP terminal-submit warning was hit on this run) — no reset to `01` partway through.

```bash
ls "screenshots/PortalAutomation/<the new timestamp>/xsMobile_chrome/PDF"
```

Expected: exactly **one** PDF file (`PortalAutomation_xsMobile_chrome_<date>.pdf`), not two.

- [ ] **Step 5: Confirm `run-all-resolutions.ts` and the npm scripts still type-check and need no changes**

Run: `npx tsc --noEmit` (already covers this — `run-all-resolutions.ts` imports `runAll` with the same public signature, unchanged).
Expected: no errors (already confirmed in Step 2, this step is a sanity note, not a new command).

---

## Self-Review Notes

- **Spec coverage:** one shared timestamp folder per device (Task 3, Step 1 builds one context) ✓; continuous numbering across paths (shared `context` means `resetSequence()` is called exactly once, in `runAll`, not per-path) ✓; one combined PDF (Task 3, single `mergePngsToPdf` call at the end over the full manifest) ✓; standalone CLI unaffected (Tasks 1-2, Step 4 in each explicitly re-verifies today's behavior) ✓; `run-all-resolutions.ts` unaffected (Task 3, Step 5) ✓.
- **Placeholder scan:** none — every step has literal before/after code or an exact runnable command.
- **Type consistency:** `RunContext`, `sharedContext?: RunContext`, `runPatientPath`/`runHcpPath`'s 3rd parameter name and type match exactly between Task 1, Task 2, and their call sites in Task 3.
