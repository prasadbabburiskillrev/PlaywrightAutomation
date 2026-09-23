import {
  BrowserName,
  DEFAULT_BROWSER,
  PROGRAM_NAME,
  SPINNER_SELECTOR,
  getBrowser,
  getResolution,
} from '../../utils/deviceBrowsers';
import { RunContext, buildRunTimestamp, createRunContext, pdfOutputPath, resetSequence } from '../../../../shared/screenshots-engine/screenshotHelper';
import { mergePngsToPdf } from '../../../../shared/screenshots-engine/pdfMerger';
import { runPatientPath } from './run-patient-path';
import { runHcpPath } from './run-hcp-path';

export async function runAll(resolutionName: string, browserName?: BrowserName): Promise<void> {
  const resolution = getResolution(resolutionName);
  const browserDef = getBrowser(browserName ?? DEFAULT_BROWSER);
  const deviceType = `${resolution.name}_${browserDef.name}`;
  const runTimestamp = buildRunTimestamp();

  resetSequence();
  const context: RunContext = createRunContext(PROGRAM_NAME, deviceType, runTimestamp, SPINNER_SELECTOR, resolution.name);

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
