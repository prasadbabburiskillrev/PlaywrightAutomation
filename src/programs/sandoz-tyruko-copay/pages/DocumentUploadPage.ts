import { Page, Locator, expect } from '@playwright/test';
import { UploadDocumentType } from '../testdata/types';

const TYPE_LABEL: Record<UploadDocumentType, string> = {
  copayClaim: 'I am uploading a co-pay claim',
  insuranceCard: 'I am uploading a copy of an insurance card',
  otherDocumentation: 'I am uploading other documentation',
};

// "Upload Documents" for BOTH the Patient and HCP cards - they land on the
// identical page (/upload-documents/), confirmed live, 2026-10-05: a radio
// choosing what is being uploaded, a file drop zone, and "Submit".
// Accepted types per the Transition Program page: jpeg, jpg, pdf, png, 10 MB.
// This is NOT the Transition Program's "Document Submission" step - see
// TransitionDocumentSubmissionPage.
export class DocumentUploadPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly fileInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Document Upload' });
    this.fileInput = page.locator('input[type="file"]');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/upload-documents/);
    await expect(this.heading).toBeVisible();
  }

  async selectDocumentType(type: UploadDocumentType): Promise<void> {
    await this.expectVisible();
    await this.page.getByText(TYPE_LABEL[type], { exact: true }).click();
  }

  async attachFile(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
  }

  // Terminal action: uploads a real document to the shared QA host.
  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
