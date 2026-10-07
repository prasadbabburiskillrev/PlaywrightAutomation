import { Page, Locator, expect } from '@playwright/test';
import { DiagnosisCode } from '../testdata/types';

// HCP "Enroll Patient in Support Services", 5th step
// (/hcp/diagnosis-information), confirmed live, 2026-10-05: one required
// read-only Vuetify select. Options (ICD-10): G35.0, G35.A, G35.C0, G35.C1,
// G35.D, G37.9, K50.0. The menu STAYS OPEN after picking an option and its
// overlay then intercepts the "Next" click, so it is closed with Escape.
export class HcpDiagnosisInformationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Diagnosis Information' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/hcp\/diagnosis-information/);
    await expect(this.heading).toBeVisible();
  }

  async selectDiagnosis(code: DiagnosisCode): Promise<void> {
    await this.expectVisible();
    // The <input> is read-only and covered by .v-select__selections, so open
    // the select by clicking the wrapper.
    await this.page.locator('.v-select__selections').first().click();
    await this.page.getByRole('option', { name: code, exact: true }).click();
    await this.page.keyboard.press('Escape');
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
