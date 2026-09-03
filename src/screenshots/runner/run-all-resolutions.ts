import { RESOLUTIONS, BrowserName } from '../../utils/deviceBrowsers';
import { runAll } from './run-all';

async function runAllResolutions(browserName?: BrowserName): Promise<void> {
  const failures: string[] = [];
  for (const resolution of RESOLUTIONS) {
    console.log(`--- Running screenshot capture for resolution: ${resolution.name} ---`);
    try {
      await runAll(resolution.name, browserName);
    } catch (error) {
      console.error(`--- Resolution ${resolution.name} failed, continuing with remaining resolutions ---`, error);
      failures.push(resolution.name);
    }
  }
  if (failures.length > 0) {
    console.error(`Completed with failures for: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  const browserArg = process.argv.find((a) => a.startsWith('--browser='));
  const browserName = browserArg ? (browserArg.split('=')[1] as BrowserName) : undefined;

  runAllResolutions(browserName).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
