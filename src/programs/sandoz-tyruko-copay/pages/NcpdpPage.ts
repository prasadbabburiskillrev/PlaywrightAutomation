import { Page, Locator, expect } from '@playwright/test';
import { PharmacyNcpdpData } from '../testdata/types';
import { inputByName } from './formFields';

// Pharmacy path, 1st step (/pharmacy/ncpdp/), confirmed live, 2026-10-05:
// a single required `ncpdp` field (the pharmacy's NCPDP provider ID).
export class NcpdpPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'NCPDP Input' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/pharmacy\/ncpdp/);
    await expect(this.heading).toBeVisible();
  }

  async fill(data: PharmacyNcpdpData): Promise<void> {
    await this.expectVisible();
    await inputByName(this.page, 'ncpdp').fill(data.ncpdp);
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
