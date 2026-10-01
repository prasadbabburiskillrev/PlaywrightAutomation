import { Page, Locator, expect } from '@playwright/test';
import { PatientInformationData } from '../testdata/types';

export class PatientInformationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Patient Information' });
    this.continueButton = page.getByRole('button', { name: 'Next' });
  }

  private field(name: string): Locator {
    // Same Vuetify combobox-proxy quirk as Apotex, confirmed live via DOM
    // inspection: gender/state render a second, hidden
    // `<input type="hidden" name="...">` proxy sharing the same `name`
    // attribute as the visible combobox input. Excluding hidden inputs scopes
    // this to the single interactive element for every field.
    return this.page.locator(`input[name="${name}"]:not([type="hidden"])`);
  }

  // Same route-transition-collision guard as Apotex's PatientInformationPage:
  // waiting for this page's own heading guarantees the real form (and its
  // "Next" button) has mounted before any interaction, rather than racing the
  // previous page's identically-named button.
  private async waitUntilReady(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  // Field `name` attributes confirmed live, 2026-09-23, via
  // `document.querySelectorAll('input, [role="combobox"]')` on
  // https://portal-qa.trialcard.com/summit/ivonescimab/patient/patient-information/ :
  // firstName, lastName, dateOfBirth, gender, addressOne, addressTwo, zip,
  // city, state, patientPhone, patientHomePhone, email - identical to
  // Apotex's field names.
  async fill(data: PatientInformationData): Promise<void> {
    await this.waitUntilReady();
    await this.field('firstName').fill(data.firstName);
    await this.field('lastName').fill(data.lastName);
    await this.field('dateOfBirth').fill(data.dateOfBirth);
    await this.selectComboboxOption('gender', data.gender);
    await this.field('addressOne').fill(data.addressLine1);
    if (data.addressLine2) {
      await this.field('addressTwo').fill(data.addressLine2);
    }
    await this.field('zip').fill(data.zipCode);
    await this.field('city').fill(data.city);
    await this.selectStateOption(data.state);
    await this.field('patientPhone').fill(data.mobilePhone);
    if (data.homePhone) {
      await this.field('patientHomePhone').fill(data.homePhone);
    }
    await this.field('email').fill(data.email);
  }

  private async selectComboboxOption(fieldName: string, optionName: string): Promise<void> {
    await this.field(fieldName).click();
    await this.page.getByRole('option', { name: optionName, exact: true }).click();
  }

  private async selectStateOption(stateName: string): Promise<void> {
    await this.field('state').click();
    const listbox = this.page.getByRole('listbox');
    const option = this.page.getByRole('option', { name: stateName, exact: true });
    // Confirmed live, 2026-09-23: same virtualized State dropdown as Apotex
    // (20 options initially rendered, `max-height: 304px`,
    // `overflow-y: auto`) - scroll-loop until the target option mounts.
    for (let attempt = 0; attempt < 20 && (await option.count()) === 0; attempt++) {
      await listbox.hover();
      await this.page.mouse.wheel(0, 300);
    }
    await option.click();
  }

  async submit(): Promise<void> {
    await this.waitUntilReady();
    await this.continueButton.click();
  }

  async expectValidationErrorCount(count: number): Promise<void> {
    // Confirmed live, 2026-09-23: submitting empty shows "There are 10
    // errors" (10 required fields: firstName, lastName, dateOfBirth, gender,
    // addressOne, zip, city, state, patientPhone, email - addressTwo and
    // patientHomePhone are optional), same message format as Apotex.
    await expect(this.page.getByText(`There are ${count} errors`, { exact: true })).toBeVisible();
  }
}
