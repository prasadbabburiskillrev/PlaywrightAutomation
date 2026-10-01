import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { NotEligiblePage } from '../pages/NotEligiblePage';
import { PatientInformationPage } from '../pages/PatientInformationPage';
import { PatientConsentPage } from '../pages/PatientConsentPage';
import { SuccessPage } from '../pages/SuccessPage';
import { DocumentUploadPage } from '../pages/DocumentUploadPage';
import { DocumentUploadSuccessPage } from '../pages/DocumentUploadSuccessPage';
import { PatientEnrollmentModule } from '../modules/PatientEnrollmentModule';
import { HcpEnrollmentModule } from '../modules/HcpEnrollmentModule';
import { DocumentUploadModule } from '../modules/DocumentUploadModule';

interface PortalFixtures {
  landingPage: LandingPage;
  eligibilityPage: EligibilityPage;
  notEligiblePage: NotEligiblePage;
  patientInfoPage: PatientInformationPage;
  consentPage: PatientConsentPage;
  successPage: SuccessPage;
  documentUploadPage: DocumentUploadPage;
  documentUploadSuccessPage: DocumentUploadSuccessPage;
  patientEnrollment: PatientEnrollmentModule;
  hcpEnrollment: HcpEnrollmentModule;
  documentUpload: DocumentUploadModule;
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
  documentUploadPage: async ({ page }, use) => {
    await use(new DocumentUploadPage(page));
  },
  documentUploadSuccessPage: async ({ page }, use) => {
    await use(new DocumentUploadSuccessPage(page));
  },
  patientEnrollment: async ({ landingPage, eligibilityPage, patientInfoPage, consentPage }, use) => {
    await use(new PatientEnrollmentModule(landingPage, eligibilityPage, patientInfoPage, consentPage));
  },
  hcpEnrollment: async ({ landingPage, eligibilityPage, patientInfoPage }, use) => {
    await use(new HcpEnrollmentModule(landingPage, eligibilityPage, patientInfoPage));
  },
  documentUpload: async ({ landingPage, documentUploadPage }, use) => {
    await use(new DocumentUploadModule(landingPage, documentUploadPage));
  },
});

export { expect } from '@playwright/test';
