import { Page, Locator, expect } from '@playwright/test';

export class NotEligiblePage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Confirmed live, 2026-09-23: "Thank you for your request" - no
    // exclamation mark, unlike Apotex's "Thank you for your request!".
    this.heading = page.getByRole('heading', { name: 'Thank you for your request' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/not-eligible/);
    await expect(this.heading).toBeVisible();
  }
}
