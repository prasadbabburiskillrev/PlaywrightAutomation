import { Page, Locator, expect } from '@playwright/test';
import { HcpPharmacyPrescriptionData } from '../testdata/types';
import { inputByName, todayMmDdYyyy } from './formFields';

const PROCUREMENT_LABEL = {
  buyAndBill: 'Buy and Bill',
  specialtyPharmacy: 'Specialty pharmacy to coordinate delivery',
} as const;

const ADMINISTRATION_LABEL = {
  prescribersOffice: "Prescriber's office",
  preferredInfusionSite: 'Preferred infusion site',
  assistLocatingInfusionCenter: 'Assist in locating an infusion center',
} as const;

// HCP "Enroll Patient in Support Services", LAST step
// (/hcp/pharmacy-information/, stepper label "Pharmacy Information"),
// confirmed live, 2026-10-05. The three radiogroups are, in order: Initial
// Infusion (Yes/No), Procurement, Administration. `todaysDate` is a required
// masked MM/DD/YYYY field that the site pre-fills. Ends in "Submit" - the
// terminal enrollment action.
export class HcpPharmacyPrescriptionPage {
  readonly page: Page;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.submitButton = page.getByRole('button', { name: 'Submit' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/hcp\/pharmacy-information/);
    await expect(this.page.getByText('Procurement and Infusion Options')).toBeVisible();
  }

  async fill(data: HcpPharmacyPrescriptionData): Promise<void> {
    await this.expectVisible();
    await inputByName(this.page, 'refills').fill(data.refills);
    const groups = this.page.getByRole('radiogroup');
    await groups.nth(0).getByText(data.initialInfusion ? 'Yes' : 'No', { exact: true }).click();
    await groups.nth(1).getByText(PROCUREMENT_LABEL[data.procurement], { exact: true }).click();
    await groups.nth(2).getByText(ADMINISTRATION_LABEL[data.administration], { exact: true }).click();
    await inputByName(this.page, 'prescriberSignature').fill(data.prescriberSignature);
  }

  async expectDateIsToday(): Promise<void> {
    await expect(inputByName(this.page, 'todaysDate')).toHaveValue(todayMmDdYyyy());
  }

  // Terminal enrollment action: creates a real record on the shared QA host.
  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
