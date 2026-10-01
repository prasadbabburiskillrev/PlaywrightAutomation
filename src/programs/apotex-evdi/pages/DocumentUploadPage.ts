import { Page, Locator, expect } from '@playwright/test';
import { UploadFiles } from '../testdata/uploadFiles';

export class DocumentUploadPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly backButton: Locator;
  readonly removeFileButtons: Locator;
  readonly addNewDocumentLink: Locator;
  readonly noDocumentError: Locator;
  readonly invalidTypeError: Locator;
  readonly sizeLimitError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Document Upload' });
    // A single, visible-in-DOM <input type="file" multiple> backs both the
    // "Click Here" link and the drop zone (verified live), so setInputFiles
    // on it is equivalent to either user gesture without a native file
    // chooser dialog.
    this.fileInput = page.locator('input[type="file"]');
    this.uploadButton = page.getByRole('button', { name: 'Upload' });
    this.backButton = page.getByRole('button', { name: 'Back' });
    // The trash icon per selected file has no accessible name - only this
    // data-test hook identifies it.
    this.removeFileButtons = page.locator('[data-test="btn_remove-file"]');
    this.addNewDocumentLink = page.getByText('Add New Document', { exact: true });
    this.noDocumentError = page.getByText('You must upload at least one document.');
    this.invalidTypeError = page.getByRole('alert').filter({ hasText: 'invalid file type' });
    this.sizeLimitError = page.getByRole('alert').filter({ hasText: 'size limitations' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/upload-documents\/?$/);
    await expect(this.heading).toBeVisible();
  }

  async addFiles(files: UploadFiles): Promise<void> {
    await this.fileInput.setInputFiles(files);
  }

  selectedFile(fileName: string): Locator {
    // Each selected file renders as a row whose title attribute is the
    // exact file name (the visible text also appends the size, e.g.
    // "sample-document.pdf 0.00MB").
    return this.page.locator(`[title="${fileName}"]`);
  }

  async removeFile(fileName: string): Promise<void> {
    await this.selectedFile(fileName).locator('xpath=..').locator('[data-test="btn_remove-file"]').click();
  }

  async submit(): Promise<void> {
    await this.uploadButton.click();
  }

  async goBack(): Promise<void> {
    await this.backButton.click();
  }
}
