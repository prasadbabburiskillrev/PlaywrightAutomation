import { Page, Locator } from '@playwright/test';
import { PortalRole, PortalAction } from '../testdata/types';

const ACTION_LABEL: Record<PortalRole, Record<PortalAction, string>> = {
  patient: {
    enroll: 'Enroll in Copay Assistance',
    upload: 'Upload Documents',
  },
  hcp: {
    enroll: 'Enroll Patient in Copay Assistance',
    upload: 'Upload Documents',
  },
};

const ROLE_RADIOGROUP_INDEX: Record<PortalRole, number> = {
  patient: 0,
  hcp: 1,
};

export class LandingPage {
  readonly page: Page;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async goto(): Promise<void> {
    // NOTE: this deliberately uses '' rather than '/'. Playwright resolves a
    // relative goto() target against baseURL using WHATWG URL rules, and
    // baseURL here already includes a subpath (.../apotex/evdi/). goto('/')
    // resolves to the *site root* (https://portal-qa.trialcard.com/), which
    // serves an unrelated tenant's app on this shared QA host and has no
    // role-selection landing page — confirmed live, causing every subsequent
    // locator to time out. goto('') preserves baseURL's path as-is.
    await this.page.goto('');
  }

  async selectRoleAction(role: PortalRole, action: PortalAction): Promise<void> {
    const label = ACTION_LABEL[role][action];
    const radiogroup = this.page.getByRole('radiogroup').nth(ROLE_RADIOGROUP_INDEX[role]);
    // Vuetify radios: click the visible label text. Clicking the underlying
    // <input role="radio"> times out because a ripple overlay <div> intercepts
    // pointer events on it (verified live).
    await radiogroup.getByText(label, { exact: true }).click();
  }

  async goNext(): Promise<void> {
    // Explicit, requested diagnostic wait ahead of this page's navigation.
    await this.page.waitForTimeout(10_000);
    await this.nextButton.click();
  }
}
