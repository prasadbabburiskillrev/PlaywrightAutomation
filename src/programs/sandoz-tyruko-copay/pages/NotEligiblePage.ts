import { Page, Locator, expect } from '@playwright/test';

export class NotEligiblePage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Confirmed live, 2026-10-05: "Thank you for your request!" (the name
    // match is a substring match, so the exclamation mark is optional).
    this.heading = page.getByRole('heading', { name: 'Thank you for your request' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/not-eligible/);
    await expect(this.heading).toBeVisible();
  }
}
