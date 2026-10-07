import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { NotEligiblePage } from '../pages/NotEligiblePage';
import { PatientInformationPage } from '../pages/PatientInformationPage';
import { PatientAuthorizationPage } from '../pages/PatientAuthorizationPage';
import { PharmacyPatientInformationPage } from '../pages/PharmacyPatientInformationPage';
import { NcpdpPage } from '../pages/NcpdpPage';
import { HcpGettingStartedPage } from '../pages/HcpGettingStartedPage';
import { HcpHealthInsurancePage } from '../pages/HcpHealthInsurancePage';
import { HcpPrescriberInformationPage } from '../pages/HcpPrescriberInformationPage';
import { HcpDiagnosisInformationPage } from '../pages/HcpDiagnosisInformationPage';
import { HcpPharmacyPrescriptionPage } from '../pages/HcpPharmacyPrescriptionPage';
import { HcpCopayPrescriberPage } from '../pages/HcpCopayPrescriberPage';
import { DocumentUploadPage } from '../pages/DocumentUploadPage';
import { TransitionHealthInsurancePage } from '../pages/TransitionHealthInsurancePage';
import { TransitionDocumentSubmissionPage } from '../pages/TransitionDocumentSubmissionPage';
import { TransitionSuccessPage } from '../pages/TransitionSuccessPage';

interface PortalFixtures {
  landingPage: LandingPage;
  eligibilityPage: EligibilityPage;
  notEligiblePage: NotEligiblePage;
  patientInfoPage: PatientInformationPage;
  patientAuthorizationPage: PatientAuthorizationPage;
  pharmacyPatientInfoPage: PharmacyPatientInformationPage;
  ncpdpPage: NcpdpPage;
  hcpGettingStartedPage: HcpGettingStartedPage;
  hcpHealthInsurancePage: HcpHealthInsurancePage;
  hcpPrescriberPage: HcpPrescriberInformationPage;
  hcpDiagnosisPage: HcpDiagnosisInformationPage;
  hcpPharmacyPrescriptionPage: HcpPharmacyPrescriptionPage;
  hcpCopayPrescriberPage: HcpCopayPrescriberPage;
  documentUploadPage: DocumentUploadPage;
  transitionHealthInsurancePage: TransitionHealthInsurancePage;
  transitionDocumentSubmissionPage: TransitionDocumentSubmissionPage;
  transitionSuccessPage: TransitionSuccessPage;
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
  patientAuthorizationPage: async ({ page }, use) => {
    await use(new PatientAuthorizationPage(page));
  },
  pharmacyPatientInfoPage: async ({ page }, use) => {
    await use(new PharmacyPatientInformationPage(page));
  },
  ncpdpPage: async ({ page }, use) => {
    await use(new NcpdpPage(page));
  },
  hcpGettingStartedPage: async ({ page }, use) => {
    await use(new HcpGettingStartedPage(page));
  },
  hcpHealthInsurancePage: async ({ page }, use) => {
    await use(new HcpHealthInsurancePage(page));
  },
  hcpPrescriberPage: async ({ page }, use) => {
    await use(new HcpPrescriberInformationPage(page));
  },
  hcpDiagnosisPage: async ({ page }, use) => {
    await use(new HcpDiagnosisInformationPage(page));
  },
  hcpPharmacyPrescriptionPage: async ({ page }, use) => {
    await use(new HcpPharmacyPrescriptionPage(page));
  },
  hcpCopayPrescriberPage: async ({ page }, use) => {
    await use(new HcpCopayPrescriberPage(page));
  },
  documentUploadPage: async ({ page }, use) => {
    await use(new DocumentUploadPage(page));
  },
  transitionHealthInsurancePage: async ({ page }, use) => {
    await use(new TransitionHealthInsurancePage(page));
  },
  transitionDocumentSubmissionPage: async ({ page }, use) => {
    await use(new TransitionDocumentSubmissionPage(page));
  },
  transitionSuccessPage: async ({ page }, use) => {
    await use(new TransitionSuccessPage(page));
  },
});

export { expect } from '@playwright/test';
