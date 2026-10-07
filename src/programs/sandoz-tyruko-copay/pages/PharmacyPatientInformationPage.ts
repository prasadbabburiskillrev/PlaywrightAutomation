import { Page, Locator, expect } from '@playwright/test';
import { PatientInformationData } from '../testdata/types';
import { PatientInformationPage } from './PatientInformationPage';
import { inputByName, todayMmDdYyyy } from './formFields';

// Pharmacy path (/pharmacy/patient-information/), confirmed live, 2026-10-05.
// Same patient fields as PatientInformationPage, but this is the LAST step:
// it adds a pharmacist signature block and ends in "Submit" (not "Next").
// `signDate` is read-only and pre-filled by the site with today's date.
export class PharmacyPatientInformationPage {
  readonly page: Page;
  readonly patientInformation: PatientInformationPage;
  readonly submitButton: Locator;
  readonly signDateField: Locator;

  constructor(page: Page) {
    this.page = page;
    this.patientInformation = new PatientInformationPage(page);
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.signDateField = inputByName(page, 'signDate');
  }

  async fill(data: PatientInformationData, pharmacySignature: string): Promise<void> {
    await this.patientInformation.fill(data);
    await inputByName(this.page, 'pharmacySignature').fill(pharmacySignature);
  }

  async expectSignDateIsToday(): Promise<void> {
    await expect(this.signDateField).toHaveValue(todayMmDdYyyy());
  }

  // Terminal enrollment action: creates a real record on the shared QA host.
  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
