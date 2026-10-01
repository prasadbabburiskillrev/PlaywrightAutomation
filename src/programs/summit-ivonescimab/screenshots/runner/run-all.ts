import {
  BrowserName,
  DEFAULT_BROWSER,
  PROGRAM_KEY,
  PROGRAM_NAME,
  SPINNER_SELECTOR,
  getBrowser,
  getResolution,
} from '../../utils/deviceBrowsers';
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../../../../shared/screenshots-engine/screenshotHelper';
import { mergePngsToPdf } from '../../../../shared/screenshots-engine/pdfMerger';
import { runPatientPath } from './run-patient-path';

export async function runAll(resolutionName: string, browserName?: BrowserName): Promise<void> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName ?? DEFAULT_BROWSER);
  const deviceType = `${resolution.name}_${browserDef.name}`;
  const runTimestamp = buildRunTimestamp();

  resetSequence();
  const context: RunContext = createRunContext(PROGRAM_NAME, PROGRAM_KEY, deviceType, runTimestamp, SPINNER_SELECTOR, resolution.name);

  let runError: unknown;
  try {
    // Patient path only this round - no HCP flow built yet (see the design
    // spec's Non-Goals).
    await runPatientPath(resolutionName, browserName, context);
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
