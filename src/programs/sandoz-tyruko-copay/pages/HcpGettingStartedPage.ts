import { Page, Locator, expect } from '@playwright/test';
import { HcpGettingStartedData, HcpSupportService } from '../testdata/types';
import { labelFor } from './formFields';

// HCP "Enroll Patient in Support Services", 1st step (/hcp/getting-started/),
// confirmed live, 2026-10-05. All controls are Vuetify checkboxes with stable
// ids (the site treats "Patient is" and "Preferred Language" as checkbox sets).
const THERAPY_ID = {
  newToTherapy: 'newtherapy',
  switchingFromOtherTherapy: 'switchingPatient',
} as const;

const SERVICE_ID: Record<HcpSupportService, string> = {
  allSupportServices: 'allSupportServices',
  benefitsInvestigation: 'benefitsInvestigation',
  priorAuthorization: 'prior_Authorization',
  copayServices: 'copayServices',
  bridgeOrQuickStart: 'bridge_start',
  sandozPatientAssistance: 'sandoz_patient_assistance',
};

const LANGUAGE_ID = {
  english: 'preferredenglish',
  spanish: 'preferredspanish',
  other: 'preferredother',
} as const;

export class HcpGettingStartedPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Getting Started' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/hcp\/getting-started/);
    await expect(this.heading).toBeVisible();
  }

  async fill(data: HcpGettingStartedData): Promise<void> {
    await this.expectVisible();
    await labelFor(this.page, THERAPY_ID[data.therapyStatus]).click();
    for (const service of data.services) {
      await labelFor(this.page, SERVICE_ID[service]).click();
    }
    await labelFor(this.page, LANGUAGE_ID[data.preferredLanguage]).click();
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
