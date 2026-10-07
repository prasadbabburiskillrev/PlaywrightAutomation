import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, 'src/programs/apotex-evdi/.env') });
dotenv.config({ path: path.resolve(__dirname, 'src/programs/summit-ivonescimab/.env') });
dotenv.config({ path: path.resolve(__dirname, 'src/programs/sandoz-tyruko-copay/.env') });
// Onboarding a new program: add another dotenv.config({ path: ... }) call
// here pointing at that program's own .env file. Because every program's
// base-URL var is namespaced (e.g. APOTEX_EVDI_BASE_URL), loading multiple
// programs' .env files into this one process is safe — dotenv won't
// override a key that's already set, and there's no shared key to collide.

function programProjects(key: string, baseURL: string) {
  const use = { ...devices['Desktop Chrome'], baseURL };
  return [
    { name: `${key}-e2e`, testDir: `./src/programs/${key}/tests/e2e`, use },
    { name: `${key}-design`, testDir: `./src/programs/${key}/tests/design`, use },
  ];
}

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Every program has two projects, split by what the spec is for:
    //   <key>-e2e     tests/e2e/*.e2e.spec.ts       business-flow regression (npm test)
    //   <key>-design  tests/design/*.design.spec.ts Figma-vs-live UI checks (npm run test:design)
    // The suffix of the project name is what the npm scripts select on (--project="*-e2e").
    ...programProjects('apotex-evdi', process.env.APOTEX_EVDI_BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/'),
    ...programProjects(
      'summit-ivonescimab',
      process.env.SUMMIT_IVONESCIMAB_BASE_URL ?? 'https://portal-qa.trialcard.com/summit/ivonescimab/',
    ),
    ...programProjects(
      'sandoz-tyruko-copay',
      process.env.SANDOZ_TYRUKO_COPAY_BASE_URL ?? 'https://portal-qa.trialcard.com/sandoz/tyrukocopay/',
    ),
    // Onboarding a new program: add one line here,
    //   ...programProjects('<new-program>', process.env.<NEW_PROGRAM>_BASE_URL ?? '<new-program-default-url>'),
  ],
});
