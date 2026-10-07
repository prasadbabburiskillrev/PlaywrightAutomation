import { Page, Locator } from '@playwright/test';
import { PortalRole, PortalAction } from '../testdata/types';

// Landing page confirmed live, 2026-10-05: one card per role, each with its own
// radiogroup, in DOM order Patient (0), Healthcare Provider (1), Pharmacy (2).
const ROLE_RADIOGROUP_INDEX: Record<PortalRole, number> = {
  patient: 0,
  hcp: 1,
  pharmacy: 2,
};

const ACTION_LABEL: Partial<Record<PortalRole, Partial<Record<PortalAction, string>>>> = {
  patient: {
    enrollCopay: 'Enroll in Co-Pay Assistance',
    uploadDocuments: 'Upload Documents (Submit co-pay claims, copy of insurance card, or other documents)',
    eConsent: 'E-Consent (Patient Authorization)',
    transitionProgram: 'Apply to the Patient Transition Program',
  },
  hcp: {
    registerHcpPortal: 'Register for HCP Portal',
    enrollSupportServices: 'Enroll Patient in Support Services',
    enrollCopayOnly: 'Enroll Patient in Co-Pay Assistance Only',
    uploadDocuments: 'Upload Documents (Submit co-pay claims, copy of insurance card, or other documents)',
  },
  pharmacy: {
    enrollCopay: 'Enroll Patient in Co-Pay Assistance',
  },
};

export class LandingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Welcome to the TYRUKO Patient Support Program' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async goto(): Promise<void> {
    // baseURL already includes a subpath (.../sandoz/tyrukocopay/), so
    // goto('') preserves it; goto('/') would resolve to the shared QA host's
    // root and serve a different tenant.
    await this.page.goto('');
  }

  async selectRoleAction(role: PortalRole, action: PortalAction): Promise<void> {
    const label = ACTION_LABEL[role]?.[action];
    if (!label) {
      throw new Error(`The "${role}" card has no "${action}" action on the landing page`);
    }
    // The "Upload Documents (...)" text is identical on the Patient and HCP
    // cards, so scope to the role's own radiogroup instead of the whole page.
    // Click the visible label text, not the underlying <input role="radio">:
    // a Vuetify ripple overlay intercepts pointer events on the input.
    await this.page
      .getByRole('radiogroup')
      .nth(ROLE_RADIOGROUP_INDEX[role])
      .getByText(label, { exact: true })
      .click();
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
