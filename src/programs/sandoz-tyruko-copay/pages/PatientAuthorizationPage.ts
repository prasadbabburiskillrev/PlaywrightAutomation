import { Page, Locator, expect } from '@playwright/test';
import { PatientAuthorizationData } from '../testdata/types';

export class PatientAuthorizationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly submitButton: Locator;
  readonly signDateField: Locator;

  constructor(page: Page) {
    this.page = page;
    // Confirmed live, 2026-10-05, at
    // https://portal-qa.trialcard.com/sandoz/tyrukocopay/patient/patient-authorization/
    // (3rd step after Eligibility Questions and Patient Information). The same
    // text also appears as a stepper item, so match the heading role.
    this.heading = page.getByRole('heading', { name: 'Patient Authorization' });
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.signDateField = page.locator('input[name="signDate"]');
  }

  private field(name: string): Locator {
    return this.page.locator(`input[name="${name}"]:not([type="hidden"])`);
  }

  // The three required consents and the optional TCPA one are Vuetify
  // checkboxes with stable ids; click the visible label text, not the input
  // (ripple overlay intercepts pointer events on the input itself).
  private checkbox(id: string): Locator {
    return this.page.locator(`label[for="${id}"]`);
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/patient\/patient-authorization/);
    await expect(this.heading).toBeVisible();
  }

  // Field names confirmed live, 2026-10-05:
  //   checkboxes (by id): consentCheckbox*, tcpaConsentCheckbox (optional),
  //                       tncCheckbox*, fcraCheckbox*
  //   signature: FName*, LName*; signDate is READONLY (the site fills it in,
  //   so it cannot be filled - see signDateField)
  //   optional representative: repFName, repLName, patientHomePhone (the
  //   representative's Phone reuses this name), relationShipToPatient
  async fill(data: PatientAuthorizationData): Promise<void> {
    await this.expectVisible();
    await this.checkbox('consentCheckbox').click();
    if (data.agreesToTcpa) {
      await this.checkbox('tcpaConsentCheckbox').click();
    }
    await this.checkbox('tncCheckbox').click();
    await this.checkbox('fcraCheckbox').click();

    await this.field('FName').fill(data.signatureFirstName);
    await this.field('LName').fill(data.signatureLastName);

    const rep = data.representative;
    if (rep?.firstName) await this.field('repFName').fill(rep.firstName);
    if (rep?.lastName) await this.field('repLName').fill(rep.lastName);
    if (rep?.phone) await this.field('patientHomePhone').fill(rep.phone);
    if (rep?.relationship) await this.field('relationShipToPatient').fill(rep.relationship);
  }

  // Submitting is the terminal enrollment action - it creates a real record
  // on the shared QA host. The post-submit confirmation page has NOT been
  // observed yet, so no success page object exists; add one the first time
  // this is run intentionally.
  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
