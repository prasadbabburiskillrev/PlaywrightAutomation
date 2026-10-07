import { test, expect } from '../../fixtures';
import { EligibilityAnswers } from '../../testdata/types';
import { generatePatientInformation, generatePatientAuthorization } from '../../utils/DataGenerator';

const eligibleAnswers: EligibilityAnswers = {
  enrolledInFederalOrStateProgram: false,
  prescribedForOnLabelIndication: true,
  hasCommercialInsurance: true,
  agreesToTerms: true,
  hasHighDeductibleHealthPlan: 'no',
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
    await patientInfoPage.expectValidationErrorCount(9);
  });

  test('reaches Patient Authorization and fills it without submitting', async ({
    landingPage,
    eligibilityPage,
    patientInfoPage,
    patientAuthorizationPage,
    page,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'enrollCopay');
    await landingPage.goNext();

    await eligibilityPage.answer(eligibleAnswers);
    await eligibilityPage.goNext();

    const patient = generatePatientInformation();
    await patientInfoPage.fill(patient);
    await patientInfoPage.submit();

    await patientAuthorizationPage.fill(generatePatientAuthorization(patient));
    // Deliberately stops before Submit: that creates a real enrollment record.
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    await expect(patientAuthorizationPage.signDateField).toHaveValue(`${mm}/${dd}/${today.getFullYear()}`);
    await expect(patientAuthorizationPage.submitButton).toBeEnabled();
    await expect(page).toHaveURL(/patient\/patient-authorization/);
  });
});
