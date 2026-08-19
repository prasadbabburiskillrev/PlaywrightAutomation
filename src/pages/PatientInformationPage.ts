import { Page, Locator, expect } from '@playwright/test';
import { PatientInformationData } from '../testdata/types';

export class PatientInformationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Patient Information' });
    // "Next" on the Patient path, "Submit" on the HCP path (its final step).
    this.continueButton = page.getByRole('button', { name: /^(Next|Submit)$/ });
  }

  private field(name: string): Locator {
    // Vuetify's v-select/combobox fields (gender, state) render a second,
    // hidden `<input type="hidden" name="...">` proxy alongside the visible
    // combobox input to hold the underlying model value - both share the
    // same `name` attribute. `input[name="X"]` alone therefore resolves to 2
    // elements for those fields, and Playwright's strict mode throws on
    // `.click()` (verified live via DOM inspection). Excluding hidden inputs
    // scopes this to the single interactive element for every field.
    return this.page.locator(`input[name="${name}"]:not([type="hidden"])`);
  }

  // The eligibility -> patient-information step is a client-side route
  // transition that briefly shows a loading overlay while the next route's
  // component chunk loads. If a caller interacts with this page immediately
  // after eligibilityPage.goNext() resolves, Playwright's getByRole('button',
  // { name: /^(Next|Submit)$/ }) locator can still resolve to the *previous*
  // page's identically-named "Next" button (the URL hasn't updated yet),
  // producing a click that never actually reaches this page's form -
  // verified live via trace inspection. Waiting for this page's own heading
  // guarantees the real Patient Information form (and its "Next"/"Submit"
  // button) has mounted before any interaction.
  private async waitUntilReady(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

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
    // The state list is virtualized (Vuetify v-virtual-scroll): options
    // outside the visible window don't exist in the DOM until scrolled in,
    // and typing into the field does not filter it (verified live).
    for (let attempt = 0; attempt < 20 && (await option.count()) === 0; attempt++) {
      await listbox.hover();
      await this.page.mouse.wheel(0, 300);
    }
    await option.click();
  }

  // `extraPreClickWaitMs` is added on top of the baseline 10s page-navigation
  // wait below; HcpEnrollmentModule passes 30_000 here because this button is
  // "Submit" (the terminal enrollment action) on the HCP path specifically -
  // the Patient path's call to this same method (button reads "Next") omits it.
  async submit(options?: { extraPreClickWaitMs?: number }): Promise<void> {
    await this.waitUntilReady();
    // Explicit, requested diagnostic waits: baseline wait ahead of this
    // page's navigation, plus the caller-specified extra wait for the HCP
    // path's terminal Submit click.
    await this.page.waitForTimeout(10_000 + (options?.extraPreClickWaitMs ?? 0));
    // Explicit wait (experiment, not a blanket sleep): the HCP path's live,
    // reproducible `/error` race correlates with a guest-session token
    // refresh (`Authentication/guest`) firing around Submit time - see
    // hcp-enrollment.spec.ts's describe-block comment. Give any in-flight
    // network activity a bounded window to settle before the terminal
    // Submit click. Bounded + swallowed so it never hangs or fails on this
    // SPA's long-lived connections when nothing is in flight.
    await this.page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await this.continueButton.click();
  }

  async expectValidationErrorCount(count: number): Promise<void> {
    await expect(this.page.getByText(`There are ${count} errors`, { exact: true })).toBeVisible();
  }
}
