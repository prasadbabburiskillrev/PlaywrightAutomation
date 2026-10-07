import { chromium, firefox, webkit, Browser, Page } from '@playwright/test';
import {
  BrowserDefinition,
  BrowserName,
  DEFAULT_BROWSER,
  EXECUTION_MODE,
  PROGRAM_KEY,
  PROGRAM_NAME,
  SPINNER_SELECTOR,
  getBrowser,
  getResolution,
} from '../../utils/deviceBrowsers';
import { config } from '../../config';
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../../../../shared/screenshots-engine/screenshotHelper';
import { mergePngsToPdf } from '../../../../shared/screenshots-engine/pdfMerger';
import { captureHomePage } from '../pages/01_homePage.screenshot';
import { capturePatientPath } from '../pages/02_patientPath.screenshot';

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
    context = createRunContext(PROGRAM_NAME, PROGRAM_KEY, deviceType, runTimestamp, SPINNER_SELECTOR, resolution.name);
  }

  const browser = await launch(browserDef);
  const browserContext = await browser.newContext({
    baseURL: config.baseURL,
    viewport: { width: resolution.width, height: resolution.height },
  });
  // Same 60s override as Apotex's runner - a bare browserContext outside the
  // `playwright test` runner otherwise falls back to Playwright's hardcoded
  // 30s default action/navigation timeout.
  browserContext.setDefaultTimeout(60_000);
  browserContext.setDefaultNavigationTimeout(60_000);
  const page: Page = await browserContext.newPage();

  let captureError: unknown;
  try {
    await captureHomePage(page, context, 'patient');
    await capturePatientPath(page, context);
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

  runPatientPath(resolutionName, browserName).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
