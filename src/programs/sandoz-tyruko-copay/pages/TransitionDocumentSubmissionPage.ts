import { Page, Locator, expect } from '@playwright/test';

// Patient Transition Program, LAST step - the "Document Submission" page that
// lives at /upload-documents/ but is a different screen from DocumentUploadPage
// (no document-type radio). Confirmed live, 2026-10-05: one or more of a
// pharmacy receipt, a prescription-label photo, a fill screenshot or an EOB;
// jpeg/jpg/pdf/png, 10 MB per file; ends in "Submit".
export class TransitionDocumentSubmissionPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly fileInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Document Submission' });
    this.fileInput = page.locator('input[type="file"]');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/upload-documents/);
    await expect(this.heading).toBeVisible();
  }

  async attachFile(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
  }

  // Terminal action: submits a real application to the shared QA host.
  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
