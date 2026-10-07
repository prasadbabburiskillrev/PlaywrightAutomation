import { Locator, Page } from '@playwright/test';

// Locators for the Pharmacy-path Patient Information page, used by the Figma design spec.
// Selectors were read from the live DOM (Vuetify 2 text fields wrapped in `.field`).
export class PatientInformationDesignPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly intro: Locator;
  readonly questions: Locator;
  readonly fieldsContainer: Locator;
  readonly fields: Locator;
  readonly errorSummary: Locator;
  readonly buttonsContainer: Locator;
  readonly backButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1.page-heading');
    this.intro = page.locator('.patient-information-intro');
    this.questions = page.locator('.patient-information-questions');
    this.fieldsContainer = page.locator('.patient-information-fields');
    this.fields = this.fieldsContainer.locator('.field');
    this.errorSummary = page.locator('.patient-information-questions > .error-message');
    this.buttonsContainer = page.locator('.patient-information-buttons');
    this.backButton = page.locator('.back-btn-primary');
    this.submitButton = page.locator('.next-btn-secondary');
  }

  label(field: Locator): Locator {
    return field.locator('label.field-label');
  }
  requiredMarker(field: Locator): Locator {
    return field.locator('label.field-label .required-star');
  }
  /** Element that paints the field background. */
  inputSlot(field: Locator): Locator {
    return field.locator('.v-input__slot');
  }
  /** Vuetify outlined fields draw their border and radius on this fieldset. */
  inputBorder(field: Locator): Locator {
    return field.locator('.v-input__slot fieldset');
  }
  inputText(field: Locator): Locator {
    return field.locator('input:not([type="hidden"])').first();
  }
  hint(field: Locator): Locator {
    return field.locator('.field-hint');
  }
  fieldError(field: Locator): Locator {
    return field.locator('.field-error');
  }
  phoneIcon(field: Locator): Locator {
    return field.locator('.field-input--phone .v-icon');
  }
  dropdownIcon(field: Locator): Locator {
    return field.locator('.v-input__icon--append .v-icon');
  }
  buttonLabel(button: Locator): Locator {
    return button.locator('.v-btn__content');
  }

  /**
   * Opening the page URL directly redirects to the landing page, so walk the Pharmacy flow:
   * landing -> eligibility (eligible answers) -> Patient Information.
   */
  async open(baseUrl: string): Promise<void> {
    const page = this.page;
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
    // Pharmacy is the 3rd role card; its radiogroup holds the only action.
    await page.getByRole('radiogroup').nth(2).getByText('Enroll Patient in Co-pay Assistance').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForURL(/\/pharmacy\/eligibility\//);
    // Eligible answers: not subsidized (No), then Yes to the other four.
    for (const [i, answer] of ['No', 'Yes', 'Yes', 'Yes', 'Yes'].entries()) {
      await page.getByRole('radiogroup').nth(i).getByText(answer, { exact: true }).click();
    }
    await page.getByRole('button', { name: 'Next' }).click();
    await this.heading.waitFor();
  }

  /** Submit the empty form to show the mandatory-field errors (nothing is enrolled). */
  async showMandatoryErrors(): Promise<void> {
    if (await this.errorSummary.isVisible()) return;
    await this.submitButton.click();
    await this.errorSummary.waitFor();
  }
}
