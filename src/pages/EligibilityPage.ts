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
    await radiogroup.getByText(answerYes ? 'Yes' : 'No', { exact: true }).click();
  }

  async answer(answers: EligibilityAnswers): Promise<void> {
    await this.answerQuestion(0, answers.paysWithCashOrFederalProgram);
    await this.answerQuestion(1, answers.livesInEligibleState);
    await this.answerQuestion(2, answers.hasCommercialInsurance);
    await this.answerQuestion(3, answers.agreesToTerms);
  }

  async goNext(): Promise<void> {
    // Explicit, requested diagnostic wait ahead of this page's navigation.
    await this.page.waitForTimeout(10_000);
    await this.nextButton.click();
  }
}
