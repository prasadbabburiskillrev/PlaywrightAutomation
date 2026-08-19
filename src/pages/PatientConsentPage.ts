import { Page, Locator, expect } from '@playwright/test';

export class PatientConsentPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly agreeLabel: Locator;
  readonly signatureInput: Locator;
  readonly enrollButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Patient Consent' });
    this.agreeLabel = page.getByText('I have read and agree to the Terms and Conditions', {
      exact: false,
    });
    this.signatureInput = page.locator('input[name="signature"]');
    this.enrollButton = page.getByRole('button', { name: 'Enroll' });
  }

  // Same wizard-transition race Task 3 documented on PatientInformationPage:
  // this step is reached right after PatientInformationPage's "Next"/"Submit"
  // click, and both steps render an identically-labeled "Back" button. A
  // caller that interacts with this page immediately on arrival could -
  // in principle - land mid-transition before this page's own form has
  // mounted. Asserting this page's own heading first guarantees the real
  // Patient Consent form (checkbox, signature input, "Enroll" button) is
  // present before any interaction.
  private async waitUntilReady(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async agreeAndSign(signatureName: string): Promise<void> {
    await this.waitUntilReady();
    // Same Vuetify ripple-intercept issue as the eligibility radios: click
    // the label text, not the checkbox input.
    await this.agreeLabel.click();
    await this.signatureInput.fill(signatureName);
  }

  async submit(): Promise<void> {
    await this.waitUntilReady();
    // Explicit, requested diagnostic waits: baseline 10s page-navigation
    // wait plus 30s ahead of this page's "Enroll" click - the Patient
    // path's terminal enrollment action.
    await this.page.waitForTimeout(30_000);
    await this.enrollButton.click();
  }
}
