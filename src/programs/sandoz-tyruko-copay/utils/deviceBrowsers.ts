// Single source of truth for device/browser/execution settings used by the
// screenshot framework under src/programs/sandoz-tyruko-copay/screenshots/.
//
// To change what gets captured, edit only this file:
// - Resolutions: edit the RESOLUTIONS array below (name/width/height).
// - Browsers: edit the BROWSERS array below (maps a friendly name to a
//   Playwright engine + optional channel — 'chrome' uses the bundled
//   Chromium binary with no channel; 'edge' uses the chromium engine with
//   the 'msedge' channel; 'firefox'/'safari' map to Playwright's firefox
//   and webkit engines respectively).
// - Headless vs headed: change EXECUTION_MODE below.
// - Default browser used by the per-resolution npm scripts: change
//   DEFAULT_BROWSER below.
// - Output folder (screenshots/<PROGRAM_KEY>/...): change PROGRAM_KEY below;
//   PROGRAM_NAME below only relabels the PDF filename.
// - Onboarding a new program (copying this whole folder): PROGRAM_KEY MUST
//   be changed to that program's own src/programs/<key> folder name. It's
//   what actually keeps two programs' screenshot output directories from
//   colliding - PROGRAM_NAME alone is just a cosmetic label used in PDF
//   filenames and does not guarantee uniqueness.

export interface Resolution {
  name: string;
  width: number;
  height: number;
}

export const RESOLUTIONS: Resolution[] = [
  { name: 'xlDesktop', width: 1920, height: 1080 },
  { name: 'lDesktop', width: 1440, height: 1080 },
  { name: 'Desktop', width: 1024, height: 1080 },
  { name: 'lTablet', width: 1280, height: 800 },
  { name: 'pTablet', width: 768, height: 1024 },
  { name: 'xsMobile', width: 375, height: 1080 },
];

export type BrowserName = 'chrome' | 'edge' | 'firefox' | 'safari';

export interface BrowserDefinition {
  name: BrowserName;
  engine: 'chromium' | 'firefox' | 'webkit';
  channel?: string;
}

export const BROWSERS: BrowserDefinition[] = [
  { name: 'chrome', engine: 'chromium' },
  { name: 'edge', engine: 'chromium', channel: 'msedge' },
  { name: 'firefox', engine: 'firefox' },
  { name: 'safari', engine: 'webkit' },
];

// Valid values: chrome, edge, firefox, safari.
export const DEFAULT_BROWSER: BrowserName = 'chrome';

export type ExecutionMode = 'headless' | 'headed';
export const EXECUTION_MODE: ExecutionMode = 'headed';

export const PROGRAM_NAME = 'TyrukoCopay';

// Matches this program's own src/programs/<PROGRAM_KEY> folder name. Used
// only to partition screenshot output (screenshots/<PROGRAM_KEY>/...) so a
// second program's captures can never land in this one's folder even if its
// PROGRAM_NAME brand label was copy-pasted without changing.
export const PROGRAM_KEY = 'sandoz-tyruko-copay';

// Confirmed live, 2026-09-23: Summit's loaded stylesheet contains the exact
// same `.half-circle-spinner` CSS rules (including `circle-1`/`circle-2`
// sub-selectors and keyframe animation name) as Apotex's — same platform,
// same overlay component. Passed into the shared screenshot engine's
// `createRunContext(...)` so it can wait for it without the shared engine
// hardcoding any program-specific selector.
export const SPINNER_SELECTOR = '.half-circle-spinner';

export function getResolution(name: string): Resolution {
  const found = RESOLUTIONS.find((r) => r.name === name);
  if (!found) {
    throw new Error(`Unknown resolution "${name}". Valid names: ${RESOLUTIONS.map((r) => r.name).join(', ')}`);
  }
  return found;
}

export function getBrowser(name: BrowserName): BrowserDefinition {
  const found = BROWSERS.find((b) => b.name === name);
  if (!found) {
    throw new Error(`Unknown browser "${name}". Valid names: ${BROWSERS.map((b) => b.name).join(', ')}`);
  }
  return found;
}
