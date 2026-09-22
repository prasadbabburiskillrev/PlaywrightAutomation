import { Page, Locator, expect } from '@playwright/test';

export class NotEligiblePage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Thank you for your request!' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/not-eligible/);
    await expect(this.heading).toBeVisible();
  }
}
