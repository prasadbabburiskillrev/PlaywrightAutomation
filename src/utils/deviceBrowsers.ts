// Single source of truth for device/browser/execution settings used by the
// screenshot framework under src/screenshots/.
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
// - Output folder program name (screenshots/<PROGRAM_NAME>/...): change
//   PROGRAM_NAME below.

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

export const PROGRAM_NAME = 'PortalAutomation';

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
