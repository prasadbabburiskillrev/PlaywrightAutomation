import { Page, Locator, expect } from '@playwright/test';

export class DocumentUploadSuccessPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly uploadMoreButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Thank you for your submission!' });
    this.uploadMoreButton = page.getByRole('button', { name: 'Upload More Documents' });
  }

  async expectVisible(): Promise<void> {
    // "Upload" posts the files to the backend before the SPA routes here;
    // like the enrollment SuccessPage, allow for the slow shared QA host.
    await expect(this.page).toHaveURL(/upload-documents-success/, { timeout: 60_000 });
    await expect(this.heading).toBeVisible();
  }

  async uploadMore(): Promise<void> {
    await this.uploadMoreButton.click();
  }
}
