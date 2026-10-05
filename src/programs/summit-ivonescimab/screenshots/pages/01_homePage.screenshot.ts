import { Page } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { PortalRole } from '../../testdata/types';
import { RunContext, capture } from '../../../../shared/screenshots-engine/screenshotHelper';

export async function captureHomePage(page: Page, context: RunContext, role: PortalRole): Promise<void> {
  const landingPage = new LandingPage(page);

  await landingPage.goto();
  await page.waitForTimeout(3000);
  await capture(page, context, `${role}_landing_default`);

  await landingPage.selectRoleAction(role, 'enrollCopay');
  await capture(page, context, `${role}_landing_roleSelected`);

  await landingPage.goNext();
}
