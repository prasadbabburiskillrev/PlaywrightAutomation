import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { NotEligiblePage } from '../pages/NotEligiblePage';
import { PatientInformationPage } from '../pages/PatientInformationPage';

interface PortalFixtures {
  landingPage: LandingPage;
  eligibilityPage: EligibilityPage;
  notEligiblePage: NotEligiblePage;
  patientInfoPage: PatientInformationPage;
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
});

export { expect } from '@playwright/test';
