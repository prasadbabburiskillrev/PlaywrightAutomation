# Shared Run Context for Patient+HCP Screenshot Runs — Design

**Date:** 2026-08-19
**Status:** Approved

## Problem

`runAll()` in `src/screenshots/runner/run-all.ts` drives both the Patient and HCP
paths for one device/browser, but calls `runPatientPath()` and `runHcpPath()` as
two fully independent runs. Each of those functions internally calls
`buildRunTimestamp()`, `resetSequence()`, and `createRunContext()` on its own.

Result, confirmed from a real run's output on disk:

```
screenshots/PortalAutomation/2026-08-19_09-10-49/xlDesktop_chrome/PNG/all screenshots/  (Patient: 01..14)
screenshots/PortalAutomation/2026-08-19_09-14-38/xlDesktop_chrome/PNG/all screenshots/  (HCP: 01..12)
```

Two separate timestamp folders, and the HCP numbering restarts at `01` instead of
continuing from Patient's `14`.

## Desired Behavior

For one device/browser execution (i.e. one `runAll()` call, which is what every
`npm run screenshots:<device>` script invokes):

- Patient and HCP screenshots land in **one** timestamp folder, one
  `<deviceType>/PNG/all screenshots/` directory.
- Numbering is **continuous** across both paths (Patient `01`..`14`, HCP
  continues `15`..`26`), never resetting in between.
- A **single merged PDF** is produced containing all captures from both paths,
  in capture order, replacing today's two separate per-path PDFs.

`run-all-resolutions.ts` (which loops `runAll()` once per resolution) is
unaffected in scope: each resolution still gets its own timestamp folder, since
each is a separate `runAll()` call for a different device.

Standalone CLI usage of `run-patient-path.ts` or `run-hcp-path.ts` directly
(without going through `run-all.ts`) is unaffected: each still creates its own
timestamp folder, own sequence, own PDF, exactly as today.

## Design

Add an optional third parameter to both path-runner functions: an
already-constructed `RunContext`.

```ts
export async function runPatientPath(
  resolutionName: string,
  browserName: BrowserName = DEFAULT_BROWSER,
  sharedContext?: RunContext
): Promise<RunContext>
```

Behavior:
- If `sharedContext` is provided: skip `buildRunTimestamp()`, `resetSequence()`,
  and `createRunContext()` — write captures directly into the given context.
  Skip the per-path PDF merge (the caller owns that).
- If `sharedContext` is omitted (today's standalone CLI entry point path):
  behave exactly as today — build a fresh timestamp, reset the sequence, create
  a new context, and merge its own PDF at the end.

Each path function keeps launching its own `Browser`/`Page` instance
regardless of which mode it's in — no change to browser lifecycle, only to
where captures are filed and numbered.

`runAll()` becomes the orchestrator that builds the shared context once:

```ts
export async function runAll(resolutionName: string, browserName?: BrowserName): Promise<void> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName ?? DEFAULT_BROWSER);
  const deviceType = `${resolution.name}_${browserDef.name}`;
  const runTimestamp = buildRunTimestamp();

  resetSequence();
  const context = createRunContext(PROGRAM_NAME, deviceType, runTimestamp);

  await runPatientPath(resolutionName, browserName, context);
  await runHcpPath(resolutionName, browserName, context);

  const dateStamp = runTimestamp.split('_')[0];
  await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));
}
```

## Files Touched

- `src/screenshots/runner/run-patient-path.ts` — add optional `sharedContext`
  param; branch context-creation and PDF-merge on its presence.
- `src/screenshots/runner/run-hcp-path.ts` — same change, mirrored.
- `src/screenshots/runner/run-all.ts` — becomes the context owner; builds the
  shared context once and passes it to both path runners; does the single
  combined PDF merge.
- `src/screenshots/core/screenshotHelper.ts` — no change; existing
  `resetSequence`/`createRunContext`/`capture` already support a shared,
  externally-owned `RunContext`.

## Testing

No unit tests precede this change — consistent with how the original
screenshot-framework plan treated these same files (thin orchestration over
already-verified lower-level helpers, verified via a live integration run
rather than unit tests).

Verification: run `npm run screenshots:xsMobile` (fastest device) and inspect
disk output:
- Exactly one timestamp folder is created.
- `xsMobile_chrome/PNG/all screenshots/` contains 26 PNGs numbered `01`
  through `26` continuously (Patient's 14, then HCP's up to 12 — 11 if the
  known-flaky HCP terminal submit doesn't reach `/success` on that attempt).
- Exactly one PDF exists under `PDF/`, containing all pages in the same order.
- Separately, run `npx tsx src/screenshots/runner/run-patient-path.ts --device=xsMobile` directly and confirm it still produces its own standalone timestamp folder + PDF (standalone mode unaffected).
