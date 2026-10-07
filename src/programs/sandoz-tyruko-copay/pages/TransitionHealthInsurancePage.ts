import { Page, Locator, expect } from '@playwright/test';

// Patient Transition Program, 3rd step (/patient/health-insurance-information/).
// Confirmed live, 2026-10-05: the page currently only says "This page is under
// construction." with Back / Next - no fields. Extend this when the site gets
// the real form.
export class TransitionHealthInsurancePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly underConstructionText: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Health Insurance Information' });
    this.underConstructionText = page.getByText('This page is under construction.');
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/patient\/health-insurance-information/);
    await expect(this.heading).toBeVisible();
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
