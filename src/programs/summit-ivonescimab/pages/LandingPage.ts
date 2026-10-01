import { Page, Locator } from '@playwright/test';
import { PortalRole, PortalAction } from '../testdata/types';

const ACTION_LABEL: Record<PortalRole, Record<PortalAction, string>> = {
  patient: {
    enrollCopay: 'Enroll in Co-pay Assistance',
  },
};

export class LandingPage {
  readonly page: Page;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nextButton = page.getByRole('button', { name: 'Next' });
  }

  async goto(): Promise<void> {
    // Same rationale as apotex-evdi's LandingPage.goto(): baseURL already
    // includes a subpath (.../summit/ivonescimab/), so goto('') preserves it
    // instead of resolving to the shared QA host's unrelated root tenant.
    await this.page.goto('');
  }

  async selectRoleAction(role: PortalRole, action: PortalAction): Promise<void> {
    const label = ACTION_LABEL[role][action];
    // Unlike Apotex's single combined role+action selector, this site renders
    // 3 separate role-cards (Healthcare Provider / Patient / Pharmacy), each
    // with its own action radiogroup - confirmed live: selecting one role's
    // action disables the other two cards' radios. Every action label across
    // all 3 cards is unique text on the page, so no radiogroup-index scoping
    // is needed (unlike Apotex's `.nth(ROLE_RADIOGROUP_INDEX[role])`).
    // Same Vuetify ripple-intercepted-radio quirk as Apotex (confirmed live):
    // click the visible label text, not the underlying input.
    await this.page.getByText(label, { exact: true }).click();
  }

  async goNext(): Promise<void> {
    await this.nextButton.click();
  }
}
