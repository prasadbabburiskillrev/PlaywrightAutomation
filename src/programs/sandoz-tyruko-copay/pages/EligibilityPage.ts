import { Page, Locator, expect } from '@playwright/test';
import { EligibilityAnswers, HdhpAnswer } from '../testdata/types';

const HDHP_LABEL: Record<HdhpAnswer, string> = {
  yes: 'Yes',
  no: 'No',
  unknown: "I don't know",
};

export class EligibilityPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Eligibility Questionnaire' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  private async answerQuestion(index: number, label: string): Promise<void> {
    const radiogroup = this.page.getByRole('radiogroup').nth(index);
    // Click the visible label text: a Vuetify ripple overlay intercepts
    // pointer events on the underlying <input role="radio">.
    await radiogroup.getByText(label, { exact: true }).click();
  }

  private yesNo(value: boolean): string {
    return value ? 'Yes' : 'No';
  }

  // Question order confirmed live, 2026-10-05, on
  // https://portal-qa.trialcard.com/sandoz/tyrukocopay/patient/eligibility/ :
  //   0. Enrolled in a federal/state-subsidized program? (answers True / False;
  //      False = eligible)
  //   1. Prescribed TYRUKO for an on-label indication? (Yes = eligible)
  //   2. Currently have commercial insurance that covers TYRUKO? (Yes = eligible)
  //   3. Read and agreed to the terms and conditions? (Yes = eligible)
  //   4. Enrolled in a High Deductible Health Plan? (Yes / No / I don't know;
  //      every answer continues to Patient Information)
  // Answering No to questions 1-3, or True to question 0, routes to /not-eligible.
  async answer(answers: EligibilityAnswers): Promise<void> {
    await this.answerQuestion(0, answers.enrolledInFederalOrStateProgram ? 'True' : 'False');
    await this.answerQuestion(1, this.yesNo(answers.prescribedForOnLabelIndication));
    await this.answerQuestion(2, this.yesNo(answers.hasCommercialInsurance));
    await this.answerQuestion(3, this.yesNo(answers.agreesToTerms));
    await this.answerQuestion(4, HDHP_LABEL[answers.hasHighDeductibleHealthPlan]);
  }

  async expectVisible(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
