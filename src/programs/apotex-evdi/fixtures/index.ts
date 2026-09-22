import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { NotEligiblePage } from '../pages/NotEligiblePage';
import { PatientInformationPage } from '../pages/PatientInformationPage';
import { PatientConsentPage } from '../pages/PatientConsentPage';
import { SuccessPage } from '../pages/SuccessPage';
import { PatientEnrollmentModule } from '../modules/PatientEnrollmentModule';
import { HcpEnrollmentModule } from '../modules/HcpEnrollmentModule';

interface PortalFixtures {
  landingPage: LandingPage;
  eligibilityPage: EligibilityPage;
  notEligiblePage: NotEligiblePage;
  patientInfoPage: PatientInformationPage;
  consentPage: PatientConsentPage;
  successPage: SuccessPage;
  patientEnrollment: PatientEnrollmentModule;
  hcpEnrollment: HcpEnrollmentModule;
}

export const test = base.extend<PortalFixtures>({
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },
  eligibilityPage: async ({ page }, use) => {
    await use(new EligibilityPage(page));
  },
  notEligiblePage: async ({ page }, use) => {
    await use(new NotEligiblePage(page));
  },
  patientInfoPage: async ({ page }, use) => {
    await use(new PatientInformationPage(page));
  },
  consentPage: async ({ page }, use) => {
    await use(new PatientConsentPage(page));
  },
  successPage: async ({ page }, use) => {
    await use(new SuccessPage(page));
  },
  patientEnrollment: async ({ landingPage, eligibilityPage, patientInfoPage, consentPage }, use) => {
    await use(new PatientEnrollmentModule(landingPage, eligibilityPage, patientInfoPage, consentPage));
  },
  hcpEnrollment: async ({ landingPage, eligibilityPage, patientInfoPage }, use) => {
    await use(new HcpEnrollmentModule(landingPage, eligibilityPage, patientInfoPage));
  },
});

export { expect } from '@playwright/test';
