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
}
