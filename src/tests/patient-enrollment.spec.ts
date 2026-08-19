import { test, expect } from '../fixtures';
import { EligibilityAnswers } from '../testdata/types';
import { generatePatientInformation } from '../utils/DataGenerator';

const eligibleAnswers: EligibilityAnswers = {
  paysWithCashOrFederalProgram: false,
  livesInEligibleState: true,
  hasCommercialInsurance: true,
  agreesToTerms: true,
};

const ineligibleAnswers: EligibilityAnswers = {
  ...eligibleAnswers,
  paysWithCashOrFederalProgram: true,
};

test.describe('Patient enrollment', () => {
  test('routes to the not-eligible page when the cash/federal-program answer is Yes', async ({
    landingPage,
    eligibilityPage,
    notEligiblePage,
  }) => {
    await landingPage.goto();
    await landingPage.selectRoleAction('patient', 'enroll');
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
    await landingPage.selectRoleAction('patient', 'enroll');
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
    await landingPage.selectRoleAction('patient', 'enroll');
    await landingPage.goNext();

    await eligibilityPage.answer(eligibleAnswers);
    await eligibilityPage.goNext();

    await patientInfoPage.submit();
    await patientInfoPage.expectValidationErrorCount(10);
  });

  test('completes enrollment successfully end to end with eligible answers', async ({
    patientEnrollment,
    successPage,
  }, testInfo) => {
    // This is the heaviest test in the suite - 4 wizard pages plus several
    // backend calls (city lookup, survey session, and a real enrollPatient
    // submission). Verified live: it comfortably fits in the default 90s
    // budget when the shared QA host is quiet, but that same submission can
    // take well past it when the host is under load. A larger, test-scoped
    // timeout avoids flaking the whole suite over host slowness without
    // loosening the 90s default for every other (lighter) test.
    // Bumped further to absorb the requested diagnostic waits (10s per
    // navigation step + 30s before the terminal Enroll click, ~70s added).
    testInfo.setTimeout(300_000);
    const patientData = generatePatientInformation();

    await patientEnrollment.startEnrollment();
    await patientEnrollment.completeEligibility(eligibleAnswers);
    await patientEnrollment.completePatientInformation(patientData);
    await patientEnrollment.completeConsent(`${patientData.firstName} ${patientData.lastName}`);

    await successPage.expectVisible();
  });
});
