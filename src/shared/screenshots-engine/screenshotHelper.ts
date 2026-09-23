import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface RunContext {
  programName: string;
  // The program's src/programs/<programKey> folder name - partitions
  // screenshot output (screenshots/<programKey>/...) so two programs can
  // never collide, even if their cosmetic `programName` brand labels match.
  programKey: string;
  runTimestamp: string;
  deviceType: string;
  // Plain Resolution.name (e.g. 'xsMobile'), distinct from `deviceType` which
  // also carries the browser suffix (e.g. 'xsMobile_chrome'). This is the key
  // callers use to look themselves up in a `CaptureHeightOptions` map.
  resolutionName: string;
  baseDir: string;
  pngDir: string;
  pdfDir: string;
  manifest: string[];
  spinnerSelector?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildRunTimestamp(date: Date = new Date()): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

export function createRunContext(
  programName: string,
  programKey: string,
  deviceType: string,
  runTimestamp: string,
  spinnerSelector?: string,
  resolutionName?: string
): RunContext {
  const baseDir = path.join(process.cwd(), 'screenshots', programKey, runTimestamp, deviceType);
  const pngDir = path.join(baseDir, 'PNG', 'all screenshots');
  const pdfDir = path.join(baseDir, 'PDF');
  fs.mkdirSync(pngDir, { recursive: true });
  fs.mkdirSync(pdfDir, { recursive: true });
  return {
    programName,
    programKey,
    runTimestamp,
    deviceType,
    resolutionName: resolutionName ?? deviceType,
    baseDir,
    pngDir,
    pdfDir,
    manifest: [],
    spinnerSelector,
  };
}

let sequence = 0;

export function resetSequence(): void {
  sequence = 0;
}

function nextSequence(): string {
  sequence += 1;
  return pad(sequence);
}

// Some program apps show a global overlay/spinner during client-side route
// transitions (confirmed live for Apotex eVDI: its `.half-circle-spinner`
// overlay is fully removed from the DOM, not just hidden, once the
// transition settles). Capturing before it clears can catch the outgoing
// page still on screen underneath the spinner instead of the new state -
// this was the root cause of every "wrong content" screenshot
// (eligibility/patientInformation/consent "default" states on both paths)
// for that program. `waitForLoadState('networkidle')` is not a reliable
// proxy for this: the spinner's lifecycle isn't tied to network completion,
// so it can still be visible after networkidle resolves, and can also
// disappear well before a 5s networkidle timeout elapses.
//
// This file is shared engine code with zero program-specific knowledge, so
// the selector for that overlay (if any) must be passed in by the caller via
// `RunContext.spinnerSelector` rather than hardcoded here - a program with
// no such overlay simply omits it and this becomes a no-op.
async function waitForAppToSettle(page: Page, spinnerSelector?: string): Promise<void> {
  if (!spinnerSelector) {
    return;
  }
  const spinner = page.locator(spinnerSelector).first();
  // Tolerate it never appearing at all (some transitions are instant) -
  // this first wait just avoids racing a spinner that hasn't shown up yet.
  await spinner.waitFor({ state: 'visible', timeout: 1_000 }).catch(() => {});
  await spinner.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
}

// PNG's IHDR chunk (width/height, big-endian) always starts right after the
// fixed 8-byte signature + 4-byte chunk-length + 4-byte "IHDR" tag, i.e. at a
// fixed byte offset - no need for an image-parsing dependency just to read
// two numbers back out of a screenshot Playwright already took.
function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// Per-resolution height adjustments for a single `capture()` call, keyed by
// `RunContext.resolutionName` (e.g. 'xsMobile', 'Desktop') - only the
// resolution(s) actually affected need an entry; every other resolution
// falls through to the plain, unadjusted `fullPage` capture.
//
// The two fields exist because a fully-expanded, unclipped popup (e.g. a
// Vuetify autocomplete - see Apotex's dropdownExpander.ts) that's
// `position: absolute` can push a capture's `fullPage` height either way
// relative to what's actually needed:
//   - capHeightPx: the popup's own now-tall bounding box extends PAST the
//     rest of the page's normal-flow content, leaving blank dead space below
//     the footer (confirmed live at Desktop 1024x1080: every other capture
//     topped out at 2946px, but the fully-expanded State dropdown came out
//     at 3966px). This is a hard ceiling, not a fixed subtraction - it only
//     crops when the natural height exceeds it, so it's safe even if a
//     future run's natural height comes in lower than expected (Vuetify's
//     virtualized list has been observed to render a different number of
//     rows across runs - e.g. xsMobile's stateExpanded capture measured
//     2708px in one run and 3812px in another for the exact same capture).
//   - extendHeightPx: the opposite case - a popup that needs deliberate
//     extra bottom margin so it doesn't get clipped. Ported from the old
//     TestCafe suite's `IncrementalScreenshotTaker.takeFullpageScreenshot`
//     (@tools/takeBrowserScreenshot.ts in the legacy Sasquatch repo, used as
//     e.g. `taker.takeFullpageScreenshot('Create Account Page',
//     {extendHeight: 300})` in tests/Libtayo/legal_screenshots/
//     takeScreenshots.ts) - that suite resized its window because its
//     screenshots are raw, unstitched viewport captures; Playwright's
//     `fullPage: true` already auto-stitches the whole scrollable document,
//     so growing the viewport here is only needed to make sure the extra
//     margin is actually part of the captured document rather than trimmed.
//     A plain additive margin is safe here (unlike a fixed subtraction for
//     trimming) because overshooting it just adds a bit of harmless blank
//     space rather than clipping real content.
export interface CaptureHeightOptions {
  capHeightPx?: Record<string, number>;
  extendHeightPx?: Record<string, number>;
}

export async function capture(
  page: Page,
  context: RunContext,
  descriptiveName: string,
  heightOptions?: CaptureHeightOptions
): Promise<string> {
  await waitForAppToSettle(page, context.spinnerSelector);
  const fileName = `${nextSequence()}_${descriptiveName}.png`;
  const filePath = path.join(context.pngDir, fileName);

  const extendHeightPx = heightOptions?.extendHeightPx?.[context.resolutionName];
  if (extendHeightPx) {
    const originalViewport = page.viewportSize();
    // Probe with a real fullPage capture rather than `document.
    // documentElement.scrollHeight` - see the plain-capture path below for
    // why a self-computed scrollHeight is unreliable on this app.
    const probeBuffer = await page.screenshot({ fullPage: true });
    const { height: documentHeight } = readPngDimensions(probeBuffer);

    if (!originalViewport || documentHeight <= originalViewport.height) {
      fs.writeFileSync(filePath, probeBuffer);
      context.manifest.push(filePath);
      return filePath;
    }

    await page.setViewportSize({ width: originalViewport.width, height: documentHeight + extendHeightPx });
    await page.screenshot({ path: filePath, fullPage: true });
    await page.setViewportSize(originalViewport);
    context.manifest.push(filePath);
    return filePath;
  }

  // Always take the normal fullPage capture first - Playwright/CDP compute
  // the true rendered content height correctly (via layout metrics) even
  // when the app's own root element scrolls internally rather than
  // `<html>`/`<body>` (confirmed live: a `document.documentElement.
  // scrollHeight` reading here came back as just the viewport height, which
  // silently truncated every single capture in the run to 1024x1080 - this
  // buffer-then-inspect approach never substitutes a self-computed height
  // for Playwright's own).
  const buffer = await page.screenshot({ fullPage: true });

  const capHeightPx = heightOptions?.capHeightPx?.[context.resolutionName];
  if (capHeightPx !== undefined) {
    const { width, height } = readPngDimensions(buffer);
    if (height > capHeightPx) {
      // Only the rare over-cap case (e.g. a fully-expanded, unclipped
      // autocomplete popup) needs a second, clipped capture; every normal
      // capture is saved from the buffer above untouched, so this cannot
      // change behavior for anything under the cap. `clip` alone crops
      // within a viewport-only screenshot (confirmed live: omitting
      // `fullPage` here produced 1024x1080 - just the raw viewport, silently
      // "capping" everything down to it) - `fullPage` must stay true so
      // `clip` crops the full rendered page instead.
      await page.screenshot({ path: filePath, fullPage: true, clip: { x: 0, y: 0, width, height: capHeightPx } });
      context.manifest.push(filePath);
      return filePath;
    }
  }

  fs.writeFileSync(filePath, buffer);
  context.manifest.push(filePath);
  return filePath;
}

export function pdfOutputPath(context: RunContext, dateStamp: string): string {
  return path.join(context.pdfDir, `${context.programName}_${context.deviceType}_${dateStamp}.pdf`);
}
