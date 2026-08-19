import { Page, Locator, expect } from '@playwright/test';

export class SuccessPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Congratulations!' });
  }

  async expectVisible(): Promise<void> {
    // The "Enroll" click triggers a backend enrollPatient call before the
    // SPA routes to /patient-success; verified live to take well over the
    // default 5s web-first-assertion timeout. A generous explicit timeout
    // avoids flaking on this slow QA-host round trip without resorting to a
    // hardcoded sleep - the assertion still polls/retries, it just tolerates
    // a longer wait.
    await expect(this.page).toHaveURL(/success/, { timeout: 60_000 });
    await expect(this.heading).toBeVisible();
  }
}
