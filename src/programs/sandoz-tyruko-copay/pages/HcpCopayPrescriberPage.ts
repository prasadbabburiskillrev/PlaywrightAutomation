import { Page, Locator, expect } from '@playwright/test';
import { HcpCopayPrescriberData } from '../testdata/types';
import { inputByName, selectStateOption, todayMmDdYyyy } from './formFields';

// HCP "Enroll Patient in Co-Pay Assistance Only", LAST step
// (/hcp/prescriber-information/), confirmed live, 2026-10-05. Not the same
// form as the Support Services prescriber step: every field is optional
// ("complete these fields to view the patient's copay card information in your
// HCP Portal") except `prescriberSignature`. `signDate` is read-only and
// pre-filled with today's date. Ends in "Submit" - the terminal action.
export class HcpCopayPrescriberPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly submitButton: Locator;
  readonly signDateField: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Prescriber Information' });
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.signDateField = inputByName(page, 'signDate');
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/hcp\/prescriber-information/);
    await expect(this.heading).toBeVisible();
  }

  async fill(data: HcpCopayPrescriberData): Promise<void> {
    await this.expectVisible();
    if (data.firstName) await inputByName(this.page, 'firstName').fill(data.firstName);
    if (data.lastName) await inputByName(this.page, 'lastName').fill(data.lastName);
    if (data.npi) await inputByName(this.page, 'prescriberNpi').fill(data.npi);
    if (data.officeName) await inputByName(this.page, 'siteName').fill(data.officeName);
    if (data.addressLine1) await inputByName(this.page, 'addressLineOne').fill(data.addressLine1);
    if (data.addressLine2) await inputByName(this.page, 'addressLineTwo').fill(data.addressLine2);
    if (data.zipCode) await inputByName(this.page, 'prescriberZipCode').fill(data.zipCode);
    if (data.city) await inputByName(this.page, 'prescriberCity').fill(data.city);
    if (data.state) await selectStateOption(this.page, 'state', data.state);
    if (data.siteNpi) await inputByName(this.page, 'siteNpi').fill(data.siteNpi);
    await inputByName(this.page, 'prescriberSignature').fill(data.prescriberSignature);
  }

  async expectSignDateIsToday(): Promise<void> {
    await expect(this.signDateField).toHaveValue(todayMmDdYyyy());
  }

  // Terminal enrollment action: creates a real record on the shared QA host.
  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
