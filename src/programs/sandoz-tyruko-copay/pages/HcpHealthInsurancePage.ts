import { Page, Locator, expect } from '@playwright/test';
import { HcpHealthInsuranceData } from '../testdata/types';
import { inputByName } from './formFields';

// HCP "Enroll Patient in Support Services", 3rd step
// (/hcp/health-insurance-information/), confirmed live, 2026-10-05.
// Three checkboxes (Medical / Pharmacy / No insurance); selecting Medical or
// Pharmacy reveals that section's fields. The Medical and Pharmacy checkboxes
// share the SAME id (`hasPharmacyInsurance`), so they are clicked by label
// text. "No insurance" reveals no fields. The optional Secondary Insurance
// fields (secondaryInsurance, secondaryInsurancePhone, secondaryMemberID)
// repeat in each section, so they are intentionally not filled here.
export class HcpHealthInsurancePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Health Insurance Information' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/hcp\/health-insurance-information/);
    await expect(this.heading).toBeVisible();
  }

  async fill(data: HcpHealthInsuranceData): Promise<void> {
    await this.expectVisible();
    if (data.noInsurance) {
      await this.page.getByText(/^Patient does not have insurance/).click();
      return;
    }
    if (data.medical) {
      const m = data.medical;
      await this.page.getByText('Patient has Medical insurance', { exact: true }).click();
      await inputByName(this.page, 'primaryMedicalInsurance').fill(m.primaryInsurance);
      if (m.insurancePhone) await inputByName(this.page, 'medicalInsurancePhone').fill(m.insurancePhone);
      await inputByName(this.page, 'medicalMemberName').fill(m.memberName);
      await inputByName(this.page, 'medicalMemberId').fill(m.memberId);
      await inputByName(this.page, 'policyGroup').fill(m.policyGroup);
      if (m.memberEmployer) await inputByName(this.page, 'memberEmployer').fill(m.memberEmployer);
    }
    if (data.pharmacy) {
      const r = data.pharmacy;
      await this.page.getByText('Patient has Pharmacy Insurance', { exact: true }).click();
      await inputByName(this.page, 'rxInsurance').fill(r.insurance);
      await inputByName(this.page, 'pharmacyMemberName').fill(r.memberName);
      await inputByName(this.page, 'pharmacyInsurancePhone').fill(r.insurancePhone);
      await inputByName(this.page, 'pharmacyMemberId').fill(r.memberId);
      if (r.rxGroup) await inputByName(this.page, 'rxGroup').fill(r.rxGroup);
      if (r.rxBin) await inputByName(this.page, 'rxBin').fill(r.rxBin);
      if (r.rxPcn) await inputByName(this.page, 'rxPcn').fill(r.rxPcn);
    }
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
