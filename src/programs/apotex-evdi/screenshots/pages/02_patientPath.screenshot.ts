import { Page, expect } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { EligibilityPage } from '../../pages/EligibilityPage';
import { PatientInformationPage } from '../../pages/PatientInformationPage';
import { PatientConsentPage } from '../../pages/PatientConsentPage';
import { NotEligiblePage } from '../../pages/NotEligiblePage';
import { SuccessPage } from '../../pages/SuccessPage';
import { EligibilityAnswers } from '../../testdata/types';
import { generatePatientInformation } from '../../utils/DataGenerator';
import { RunContext, capture } from '../../../../shared/screenshots-engine/screenshotHelper';
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

export async function capturePatientPath(page: Page, context: RunContext): Promise<void> {
  const eligibilityPage = new EligibilityPage(page);
  const patientInfoPage = new PatientInformationPage(page);
  const consentPage = new PatientConsentPage(page);
  const notEligiblePage = new NotEligiblePage(page);
  const successPage = new SuccessPage(page);
  const landingPage = new LandingPage(page);

  // Eligibility: default + validation-error states. Confirmed live: an
  // empty submit stays on this same page ("There are 4 errors"), so this is
  // safe to capture without breaking the flow below.
  //
  // The preceding landing->eligibility transition doesn't reliably show the
  // app's route-transition spinner (confirmed live: it's absent for some
  // transitions), so capture()'s generic spinner wait alone isn't sufficient
  // here - assert this page's own heading is actually mounted first, same
  // guard EligibilityPage's siblings already use internally.
  await expect(eligibilityPage.heading).toBeVisible();
  await capture(page, context, 'patient_eligibility_default');
  await eligibilityPage.nextButton.click();
  await capture(page, context, 'patient_eligibility_validationError');

  // Not-Eligible branch: answering "Yes" to the cash/federal-program
  // question routes straight to /not-eligible, a dead end. Captured now,
  // while already on this fresh Eligibility instance, rather than right
  // before Success - avoids a 3rd full wizard restart.
  await eligibilityPage.answer(ineligibleAnswers);
  await eligibilityPage.goNext();
  await notEligiblePage.expectVisible();
  await capture(page, context, 'patient_notEligible_default');

  // Restart for the eligible branch that continues through to Success.
  await landingPage.goto();
  await landingPage.selectRoleAction('patient', 'enroll');
  await landingPage.goNext();

  await eligibilityPage.answer(eligibleAnswers);
  await capture(page, context, 'patient_eligibility_answered');
  await eligibilityPage.goNext();

  // Patient Information. This transition confirmed live to NOT show the
  // app's route-transition spinner at all, so capture()'s spinner wait can't
  // guard it - waiting for this page's own heading (same check
  // PatientInformationPage.fill/submit already perform internally) is the
  // only reliable signal that the new route has actually mounted.
  await expect(patientInfoPage.heading).toBeVisible();
  await capture(page, context, 'patient_patientInformation_default');

  await expandGenderDropdown(page);
  await capture(page, context, 'patient_patientInformation_genderExpanded');
  await closeDropdown(page);

  await expandStateDropdown(page);
  await capture(page, context, 'patient_patientInformation_stateExpanded');
  await closeDropdown(page);

  await patientInfoPage.submit();
  await patientInfoPage.expectValidationErrorCount(10);
  await capture(page, context, 'patient_patientInformation_validationError_10errors');

  const patientData = generatePatientInformation();
  await patientInfoPage.fill(patientData);
  await capture(page, context, 'patient_patientInformation_filled');
  await patientInfoPage.submit();

  // Consent. Confirmed live: an empty Enroll click stays on this same
  // /patient/patient-consent/ URL ("There are 2 errors"), so it's safe to
  // capture the error state here and then sign + submit for real after.
  // Same route-transition guard as above - this page's own heading, not
  // capture()'s spinner wait, is what actually guarantees the new route
  // has mounted.
  await expect(consentPage.heading).toBeVisible();
  await capture(page, context, 'patient_consent_default');

  await consentPage.submit();
  await capture(page, context, 'patient_consent_validationError');

  await consentPage.agreeAndSign(`${patientData.firstName} ${patientData.lastName}`);
  await consentPage.submit();

  await successPage.expectVisible();
  await capture(page, context, 'patient_success_default');
}
