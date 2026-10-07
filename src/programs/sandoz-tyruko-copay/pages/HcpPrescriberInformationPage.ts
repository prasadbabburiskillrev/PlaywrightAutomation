import { Page, Locator, expect } from '@playwright/test';
import { HcpPrescriberData } from '../testdata/types';
import { inputByName, selectStateOption } from './formFields';

// HCP "Enroll Patient in Support Services", 4th step
// (/hcp/prescriber-information/), confirmed live, 2026-10-05. Required:
// firstName, lastName, siteName (labelled "Practice Name"), prescriberNpi,
// addressLineOne, prescriberZipCode, prescriberCity, officeContactName,
// officeContactPhone, officeContactFax. NPI must be a valid 10-digit number.
// The Co-Pay Only path has a DIFFERENT prescriber form - see
// HcpCopayPrescriberPage.
export class HcpPrescriberInformationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Prescriber Information' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/hcp\/prescriber-information/);
    await expect(this.heading).toBeVisible();
  }

  async fill(data: HcpPrescriberData): Promise<void> {
    await this.expectVisible();
    await inputByName(this.page, 'firstName').fill(data.firstName);
    await inputByName(this.page, 'lastName').fill(data.lastName);
    await inputByName(this.page, 'siteName').fill(data.practiceName);
    await inputByName(this.page, 'prescriberNpi').fill(data.npi);
    if (data.ptan) await inputByName(this.page, 'prescriberPtan').fill(data.ptan);
    if (data.taxId) await inputByName(this.page, 'taxID').fill(data.taxId);
    await inputByName(this.page, 'addressLineOne').fill(data.addressLine1);
    if (data.addressLine2) await inputByName(this.page, 'addressLineTwo').fill(data.addressLine2);
    await inputByName(this.page, 'prescriberZipCode').fill(data.zipCode);
    await inputByName(this.page, 'prescriberCity').fill(data.city);
    if (data.state) await selectStateOption(this.page, 'state', data.state);
    await inputByName(this.page, 'officeContactName').fill(data.officeContactName);
    await inputByName(this.page, 'officeContactPhone').fill(data.officeContactPhone);
    await inputByName(this.page, 'officeContactFax').fill(data.officeContactFax);
    if (data.officeContactEmail) await inputByName(this.page, 'officeContactEmail').fill(data.officeContactEmail);
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
