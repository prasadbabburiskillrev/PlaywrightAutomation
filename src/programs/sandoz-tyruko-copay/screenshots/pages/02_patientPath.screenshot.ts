import { Page, expect } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { EligibilityPage } from '../../pages/EligibilityPage';
import { PatientInformationPage } from '../../pages/PatientInformationPage';
import { NotEligiblePage } from '../../pages/NotEligiblePage';
import { EligibilityAnswers } from '../../testdata/types';
import { generatePatientInformation } from '../../utils/DataGenerator';
import { RunContext, capture } from '../../../../shared/screenshots-engine/screenshotHelper';
import { expandGenderDropdown, expandStateDropdown, closeDropdown } from '../core/dropdownExpander';

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

export async function capturePatientPath(page: Page, context: RunContext): Promise<void> {
  const eligibilityPage = new EligibilityPage(page);
  const patientInfoPage = new PatientInformationPage(page);
  const notEligiblePage = new NotEligiblePage(page);
  const landingPage = new LandingPage(page);

  await expect(eligibilityPage.heading).toBeVisible();
  await capture(page, context, 'patient_eligibility_default');
  await eligibilityPage.nextButton.click();
  await capture(page, context, 'patient_eligibility_validationError');

  await eligibilityPage.answer(ineligibleAnswers);
  await eligibilityPage.goNext();
  await notEligiblePage.expectVisible();
  await capture(page, context, 'patient_notEligible_default');

  await landingPage.goto();
  await landingPage.selectRoleAction('patient', 'enrollCopay');
  await landingPage.goNext();

  await eligibilityPage.answer(eligibleAnswers);
  await capture(page, context, 'patient_eligibility_answered');
  await eligibilityPage.goNext();

  await expect(patientInfoPage.heading).toBeVisible();
  await capture(page, context, 'patient_patientInformation_default');

  await expandGenderDropdown(page);
  await capture(page, context, 'patient_patientInformation_genderExpanded');
  await closeDropdown(page);

  await expandStateDropdown(page);
  // No capHeightPx here, unlike Apotex's equivalent capture - Apotex's exact
  // px values (2946/3200/3966 etc.) were tuned from ITS OWN natural page
  // heights and must not be assumed to transfer to a differently-branded
  // page. Verified live (xsMobile, 2026-10-01): this capture came out at
  // 2404px, which is not even the tallest capture in the run (10_..._10errors
  // was 2596px) - no dead space below the footer here, so no capHeightPx
  // (following screenshotHelper.ts's CaptureHeightOptions pattern) is needed.
  await capture(page, context, 'patient_patientInformation_stateExpanded');
  await closeDropdown(page);

  await patientInfoPage.submit();
  await patientInfoPage.expectValidationErrorCount(9);
  await capture(page, context, 'patient_patientInformation_validationError_9errors');

  const patientData = generatePatientInformation();
  await patientInfoPage.fill(patientData);
  await capture(page, context, 'patient_patientInformation_filled');

  // Does NOT proceed past this point: the Patient Information -> Consent
  // transition is blocked by a live QA bug (see
  // docs/superpowers/specs/2026-09-23-summit-ivonescimab-onboarding-design.md).
  // PatientConsentPage/SuccessPage captures are follow-up work once the bug
  // is fixed - do not add capture calls here for pages that don't exist yet.
}
