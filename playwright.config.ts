import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, 'src/programs/apotex-evdi/.env') });
dotenv.config({ path: path.resolve(__dirname, 'src/programs/summit-ivonescimab/.env') });
// Onboarding a new program: add another dotenv.config({ path: ... }) call
// here pointing at that program's own .env file. Because every program's
// base-URL var is namespaced (e.g. APOTEX_EVDI_BASE_URL), loading multiple
// programs' .env files into this one process is safe — dotenv won't
// override a key that's already set, and there's no shared key to collide.

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
    {
      name: 'apotex-evdi',
      testDir: './src/programs/apotex-evdi/tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.APOTEX_EVDI_BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/',
      },
    },
    {
      name: 'summit-ivonescimab',
      testDir: './src/programs/summit-ivonescimab/tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.SUMMIT_IVONESCIMAB_BASE_URL ?? 'https://portal-qa.trialcard.com/summit/ivonescimab/',
      },
    },
    // Onboarding a new program: add one entry here, e.g.
    // {
    //   name: '<new-program>',
    //   testDir: './src/programs/<new-program>/tests',
    //   use: {
    //     ...devices['Desktop Chrome'],
    //     baseURL: process.env.<NEW_PROGRAM>_BASE_URL ?? '<new-program-default-url>',
    //   },
    // },
  ],
});
