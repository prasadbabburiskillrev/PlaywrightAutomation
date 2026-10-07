import { Page, Locator } from '@playwright/test';
import { EligibilityAnswers } from '../testdata/types';

export class EligibilityPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Patient Eligibility' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  private async answerQuestion(index: number, answerYes: boolean): Promise<void> {
    const radiogroup = this.page.getByRole('radiogroup').nth(index);
    // Same Vuetify ripple-intercepted-radio quirk as Apotex (confirmed live).
    await radiogroup.getByText(answerYes ? 'Yes' : 'No', { exact: true }).click();
  }

  // Question order confirmed live, 2026-09-23, on
  // https://portal-qa.trialcard.com/summit/ivonescimab/patient/eligibility/ :
  //   0. Enrolled in a federal/state-subsidized healthcare program? (No = eligible)
  //   1. 18 years of age or older? (Yes = eligible)
  //   2. Currently live in the United States or its territories? (Yes = eligible)
  //   3. Currently have commercial insurance that covers BIVTUO? (Yes = eligible)
  //   4. Agree to terms and conditions? (Yes = eligible)
  async answer(answers: EligibilityAnswers): Promise<void> {
    await this.answerQuestion(0, answers.enrolledInFederalOrStateProgram);
    await this.answerQuestion(1, answers.isAdult);
    await this.answerQuestion(2, answers.livesInUsOrTerritories);
    await this.answerQuestion(3, answers.hasCommercialInsurance);
    await this.answerQuestion(4, answers.agreesToTerms);
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }

  // ---- locators used by the Figma design spec (us-283645) ----
  // Read from the live pharmacy page (portal-pr, 86210): Vuetify 2 radio groups, each wrapped in a
  // `.multiple-choice` block under `.eligibility-container`.

  get pageHeading(): Locator {
    return this.page.locator('.eligibility-container h1.page-heading');
  }
  /** Both intro paragraphs (instruction + "*Indicates selection is required."). */
  get intro(): Locator {
    return this.page.locator('.eligibility-container .instruction-text');
  }
  /** First intro paragraph: carries the intro text style. */
  get introText(): Locator {
    return this.intro.locator('.instruction-p');
  }
  get questions(): Locator {
    return this.page.locator('.eligibility-container .multiple-choice');
  }
  get errorSummary(): Locator {
    return this.page.locator('.eligibility-container .questions > .error-message');
  }
  get backButton(): Locator {
    return this.page.locator('.eligibility-container .btn-container .back-btn-primary');
  }
  get submitButton(): Locator {
    return this.page.locator('.eligibility-container .btn-container .next-btn-secondary');
  }

  questionLabel(question: Locator): Locator {
    return question.locator('p.eligibility-p');
  }
  requiredMarker(question: Locator): Locator {
    return this.questionLabel(question).locator('.required-star');
  }
  option(question: Locator, index: number): Locator {
    return question.locator('.v-radio').nth(index);
  }
  optionLabel(option: Locator): Locator {
    return option.locator('label.v-label');
  }
  optionCircle(option: Locator): Locator {
    return option.locator('.v-input--selection-controls__input');
  }
  questionError(question: Locator): Locator {
    return question.locator('.required-error-message');
  }
  buttonLabel(button: Locator): Locator {
    return button.locator('.v-btn__content');
  }

  /**
   * The design spec reaches the page once. A direct visit may redirect to the landing page, so
   * fall back to landing -> Pharmacy role -> Next (no data is submitted).
   */
  async openForDesign(url: string): Promise<void> {
    const page = this.page;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    if (!(await this.heading.isVisible().catch(() => false))) {
      await page.getByRole('radiogroup').nth(2).getByText('Enroll Patient in Co-pay Assistance').click();
      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForURL(/\/pharmacy\/eligibility\//);
    }
    await this.heading.waitFor({ timeout: 120_000 });
  }

  /** Click Next on the unanswered form to show the mandatory-selection errors (nothing is enrolled). */
  async showMandatoryErrors(): Promise<void> {
    if (await this.errorSummary.isVisible().catch(() => false)) return;
    await this.nextButton.click();
    await this.errorSummary.waitFor();
  }
}
