import { chromium, firefox, webkit, Browser, Page } from '@playwright/test';
import {
  BrowserDefinition,
  BrowserName,
  DEFAULT_BROWSER,
  EXECUTION_MODE,
  PROGRAM_NAME,
  SPINNER_SELECTOR,
  getBrowser,
  getResolution,
} from '../../utils/deviceBrowsers';
import { config } from '../../config';
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../../../../shared/screenshots-engine/screenshotHelper';
import { mergePngsToPdf } from '../../../../shared/screenshots-engine/pdfMerger';
import { captureHomePage } from '../pages/01_homePage.screenshot';
import { captureHcpPath } from '../pages/03_hcpPath.screenshot';

function launch(browserDef: BrowserDefinition): Promise<Browser> {
  const headless = EXECUTION_MODE === 'headless';
  if (browserDef.engine === 'chromium') {
    return chromium.launch({ headless, channel: browserDef.channel });
  }
  if (browserDef.engine === 'firefox') {
    return firefox.launch({ headless });
  }
  return webkit.launch({ headless });
}

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
    context = createRunContext(PROGRAM_NAME, deviceType, runTimestamp, SPINNER_SELECTOR);
  }

  const browser = await launch(browserDef);
  const browserContext = await browser.newContext({
    baseURL: config.baseURL,
    viewport: { width: resolution.width, height: resolution.height },
  });
  // This standalone runner does not go through the `playwright test` runner,
  // so playwright.config.ts's settings (including its 90s test timeout) do
  // not apply here - a bare browserContext otherwise falls back to
  // Playwright's hardcoded 30s default action/navigation timeout. Confirmed
  // live (via the sibling Patient-path runner): the shared QA host's initial
  // page load can take ~18-30s+, which intermittently exceeded that 30s
  // default and threw a "page.goto: Timeout 30000ms exceeded" error. Raised
  // to 60s to give this slow host reliable headroom without being excessive.
  // Note: this does not affect `expect()` assertions (e.g. `toBeVisible()`),
  // which use Playwright's separate ~5s default expect timeout - unaffected
  // and unchanged by this setting.
  browserContext.setDefaultTimeout(60_000);
  browserContext.setDefaultNavigationTimeout(60_000);
  const page: Page = await browserContext.newPage();

  let captureError: unknown;
  try {
    await captureHomePage(page, context, 'hcp');
    await captureHcpPath(page, context);
  } catch (error) {
    captureError = error;
  } finally {
    await browser.close();
  }

  if (!sharedContext) {
    const dateStamp = context.runTimestamp.split('_')[0];
    if (context.manifest.length > 0) {
      await mergePngsToPdf(context.manifest, pdfOutputPath(context, dateStamp));
    }
  }

  if (captureError) {
    throw captureError;
  }

  console.log(`Completed: ${context.manifest.length} screenshots saved to ${context.pngDir}`);

  return context;
}

if (require.main === module) {
  const deviceArg = process.argv.find((a) => a.startsWith('--device='));
  const browserArg = process.argv.find((a) => a.startsWith('--browser='));
  const resolutionName = deviceArg ? deviceArg.split('=')[1] : 'xlDesktop';
  const browserName = browserArg ? (browserArg.split('=')[1] as BrowserName) : undefined;

  runHcpPath(resolutionName, browserName).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
