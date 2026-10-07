import { Page, Locator, expect } from '@playwright/test';
import { PatientInformationData } from '../testdata/types';
import { inputByName, selectComboboxOption, selectStateOption } from './formFields';

// Patient Information step, shared by every path that has one (confirmed live,
// 2026-10-05): Patient enroll / E-Consent / Transition Program
// (/patient/patient-information/), HCP Co-Pay Only and HCP Support Services
// (/hcp/patient-information/), and Pharmacy (/pharmacy/patient-information/,
// see PharmacyPatientInformationPage for its extra signature block).
export class PatientInformationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Patient Information' });
    this.continueButton = page.getByRole('button', { name: 'Next' });
  }

  // The eligibility/getting-started -> patient-information transition is a
  // client-side route change; waiting for this page's own heading guarantees
  // the real form (and its "Next" button) has mounted before any interaction,
  // rather than racing the previous page's identically-named button.
  async waitUntilReady(): Promise<void> {
    // 15s, not the 5s default: the QA host is slow, and the route change can
    // exceed 5s under load (seen once in 11 parallel-run paths).
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  // Field `name` attributes confirmed live, 2026-10-05:
  // firstName, lastName, dateOfBirth (masked MM/DD/YYYY), gender, addressOne,
  // addressTwo, zip, city, state, patientPhone, patientHomePhone, email.
  // Only HCP Support Services adds `middle` (Patient Middle Initial) and a
  // required `prefferedPhone` radio (sic) with the options Mobile / Home.
  // Email is optional everywhere (9 required fields on the base form).
  async fill(data: PatientInformationData): Promise<void> {
    await this.waitUntilReady();
    await inputByName(this.page, 'firstName').fill(data.firstName);
    if (data.middleInitial) {
      await inputByName(this.page, 'middle').fill(data.middleInitial);
    }
    await inputByName(this.page, 'lastName').fill(data.lastName);
    await inputByName(this.page, 'dateOfBirth').fill(data.dateOfBirth);
    // Gender options: "Male", "Female", "Other/Prefer not to say".
    await selectComboboxOption(this.page, 'gender', data.gender);
    await inputByName(this.page, 'addressOne').fill(data.addressLine1);
    if (data.addressLine2) {
      await inputByName(this.page, 'addressTwo').fill(data.addressLine2);
    }
    await inputByName(this.page, 'zip').fill(data.zipCode);
    await inputByName(this.page, 'city').fill(data.city);
    await selectStateOption(this.page, 'state', data.state);
    await inputByName(this.page, 'patientPhone').fill(data.mobilePhone);
    if (data.homePhone) {
      await inputByName(this.page, 'patientHomePhone').fill(data.homePhone);
    }
    if (data.preferredPhone) {
      await this.page
        .getByRole('radiogroup')
        .getByText(data.preferredPhone === 'mobile' ? 'Mobile' : 'Home', { exact: true })
        .click();
    }
    if (data.email) {
      await inputByName(this.page, 'email').fill(data.email);
    }
  }

  async submit(): Promise<void> {
    await this.waitUntilReady();
    await this.continueButton.click();
  }

  async expectValidationErrorCount(count: number): Promise<void> {
    // Confirmed live, 2026-10-05: submitting empty shows "There are nine
    // errors" - the count is spelled out as a word (9 required fields:
    // firstName, lastName, dateOfBirth, gender, addressOne, zip, city, state,
    // patientPhone; addressTwo, patientHomePhone and email are optional).
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    const text = count === 1 ? 'There is 1 error' : `There are ${words[count] ?? count} errors`;
    await expect(this.page.getByText(text, { exact: true })).toBeVisible();
  }
}
