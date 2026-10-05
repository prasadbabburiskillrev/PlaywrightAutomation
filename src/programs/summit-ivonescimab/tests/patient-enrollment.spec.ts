import { test, expect } from '../fixtures';
import { EligibilityAnswers } from '../testdata/types';

const eligibleAnswers: EligibilityAnswers = {
  enrolledInFederalOrStateProgram: false,
  isAdult: true,
  livesInUsOrTerritories: true,
  hasCommercialInsurance: true,
  agreesToTerms: true,
};

const ineligibleAnswers: EligibilityAnswers = {
  ...eligibleAnswers,
  enrolledInFederalOrStateProgram: true,
};

test.describe('Patient enrollment', () => {
  test('routes to the not-eligible page when enrolled in a federal/state program', async ({
    landingPage,
    eligibilityPage,
    notEligiblePage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'enrollCopay');
    await landingPage.goNext();

    await eligibilityPage.answer(ineligibleAnswers);
    await eligibilityPage.goNext();

    await notEligiblePage.expectVisible();
  });

  test('continues to the Patient Information step with eligible answers', async ({
    page,
    landingPage,
    eligibilityPage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'enrollCopay');
    await landingPage.goNext();

    await eligibilityPage.answer(eligibleAnswers);
    await eligibilityPage.goNext();

    await expect(page).toHaveURL(/patient\/patient-information/);
  });

  test('shows a validation error per required field when submitted empty', async ({
    landingPage,
    eligibilityPage,
    patientInfoPage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'enrollCopay');
    await landingPage.goNext();

    await eligibilityPage.answer(eligibleAnswers);
    await eligibilityPage.goNext();

    await patientInfoPage.submit();
    await patientInfoPage.expectValidationErrorCount(10);
  });
});
