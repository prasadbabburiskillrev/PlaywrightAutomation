import { Page, expect } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { EligibilityPage } from '../../pages/EligibilityPage';
import { PatientInformationPage } from '../../pages/PatientInformationPage';
import { NotEligiblePage } from '../../pages/NotEligiblePage';
import { SuccessPage } from '../../pages/SuccessPage';
import { EligibilityAnswers } from '../../testdata/types';
import { generatePatientInformation } from '../../utils/DataGenerator';
import { RunContext, capture } from '../core/screenshotHelper';
import { expandGenderDropdown, expandStateDropdown, closeDropdown } from '../core/dropdownExpander';

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

export async function captureHcpPath(page: Page, context: RunContext): Promise<void> {
  const eligibilityPage = new EligibilityPage(page);
  const patientInfoPage = new PatientInformationPage(page);
  const notEligiblePage = new NotEligiblePage(page);
  const successPage = new SuccessPage(page);
  const landingPage = new LandingPage(page);

  // The preceding landing->eligibility transition doesn't reliably show the
  // app's route-transition spinner (confirmed live), so capture()'s generic
  // spinner wait alone isn't sufficient - assert this page's own heading is
  // actually mounted first (see 02_patientPath.screenshot.ts for the same
  // guard on the Patient path).
  await expect(eligibilityPage.heading).toBeVisible();
  await capture(page, context, 'hcp_eligibility_default');
  await eligibilityPage.nextButton.click();
  await capture(page, context, 'hcp_eligibility_validationError');

  await eligibilityPage.answer(ineligibleAnswers);
  await eligibilityPage.goNext();
  await notEligiblePage.expectVisible();
  await capture(page, context, 'hcp_notEligible_default');

  await landingPage.goto();
  await landingPage.selectRoleAction('hcp', 'enroll');
  await landingPage.goNext();

  await eligibilityPage.answer(eligibleAnswers);
  await capture(page, context, 'hcp_eligibility_answered');
  await eligibilityPage.goNext();

  // Same eligibility->patient-information transition as the Patient path
  // (see 02_patientPath.screenshot.ts): confirmed live to show no spinner at
  // all, so this page's own heading is the only reliable "has it actually
  // mounted" signal.
  await expect(patientInfoPage.heading).toBeVisible();
  await capture(page, context, 'hcp_patientInformation_default');

  await expandGenderDropdown(page);
  await capture(page, context, 'hcp_patientInformation_genderExpanded');
  await closeDropdown(page);

  await expandStateDropdown(page);
  await capture(page, context, 'hcp_patientInformation_stateExpanded');
  await closeDropdown(page);

  await patientInfoPage.submit();
  await patientInfoPage.expectValidationErrorCount(9);
  await capture(page, context, 'hcp_patientInformation_validationError_9errors');

  const patientData = generatePatientInformation();
  await patientInfoPage.fill(patientData);
  await capture(page, context, 'hcp_patientInformation_filled');

  // Terminal action for the HCP path. Known, escalated live-app bug (see
  // hcp-enrollment.spec.ts): this click races the app's own validation and
  // fails roughly 2-in-3 to 3-in-4 attempts. Per design decision, this
  // framework attempts it once and skips the success capture (with a
  // warning) rather than adding retry complexity here.
  await patientInfoPage.submit({ extraPreClickWaitMs: 30_000 });

  try {
    await successPage.expectVisible();
    await capture(page, context, 'hcp_success_default');
  } catch (error) {
    console.warn(
      '[hcp_success_default] Skipped - known flaky HCP terminal-submit bug (see hcp-enrollment.spec.ts) ' +
        'did not reach /success on this single attempt.',
      error
    );
  }
}
