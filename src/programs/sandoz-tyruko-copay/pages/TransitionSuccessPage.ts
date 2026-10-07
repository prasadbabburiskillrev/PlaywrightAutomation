import { Page, Locator, expect } from '@playwright/test';

// Patient Transition Program, terminal "Thank you!" page. Confirmed live,
// 2026-10-05, at /upload-documents-success/ (reached by submitting Document
// Submission; for quick access, pick the transition action on the landing page,
// click Next, then browse to /upload-documents-success/ directly).
export class TransitionSuccessPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly processingNote: Locator;
  readonly contactNote: Locator;
  readonly downloadSummaryButton: Locator;
  readonly completeAnotherServiceButton: Locator;
  readonly programDisclaimer: Locator;
  readonly prescribingInfoLine: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Thank you!' });
    this.processingNote = page.getByText('Your application will be processed within four (4) weeks.');
    this.contactNote = page.getByText('please contact Tyruko Patient Support Program at');
    this.downloadSummaryButton = page.getByRole('button', { name: 'Download Summary' });
    this.completeAnotherServiceButton = page.getByRole('button', { name: 'Complete Another Service' });
    // The disclaimer text is split by <sup> tags, but this phrase sits in one
    // text node of the bordered box, so getByText resolves to that box.
    this.programDisclaimer = page.getByText('Patient Transition Program provides a one-time reimbursement');
    this.prescribingInfoLine = page.locator('p', { hasText: 'Please see full' });
  }

  // Quick access that skips the whole enrollment: the success route renders
  // once the transition flow has been started from the landing page.
  async gotoDirect(): Promise<void> {
    // 'load' never fires on this page (third-party scripts keep it pending), so
    // wait for DOMContentLoaded and let expectVisible() wait for the content.
    await this.page.goto('upload-documents-success/', { waitUntil: 'domcontentloaded' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/upload-documents-success/);
    // The QA host can take ~50s to render this page after navigation.
    await expect(this.heading).toBeVisible({ timeout: 120_000 });
  }
}
