import { Page, expect } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';
import { DocumentUploadPage } from '../../pages/DocumentUploadPage';
import { DocumentUploadSuccessPage } from '../../pages/DocumentUploadSuccessPage';
import { PortalRole } from '../../testdata/types';
import { SAMPLE_PDF, SAMPLE_PNG, oversizedFile, unsupportedTypeFile } from '../../testdata/uploadFiles';
import { RunContext, capture } from '../../../../shared/screenshots-engine/screenshotHelper';

// Runs after a role's enrollment path, from wherever that path left off, so
// it re-enters through the landing page itself. Patient and HCP share the
// same upload page (verified live) - only the landing-page entry differs.
export async function captureDocumentUploadPath(page: Page, context: RunContext, role: PortalRole): Promise<void> {
  const landingPage = new LandingPage(page);
  const uploadPage = new DocumentUploadPage(page);
  const successPage = new DocumentUploadSuccessPage(page);

  await landingPage.goto();
  await landingPage.selectRoleAction(role, 'upload');
  await capture(page, context, `${role}_landing_uploadSelected`);
  await landingPage.goNext();

  // Same reasoning as the enrollment paths: route transitions don't reliably
  // show the spinner capture() waits on, so wait for this page's own heading.
  await expect(uploadPage.heading).toBeVisible();
  await capture(page, context, `${role}_documentUpload_default`);

  await uploadPage.submit();
  await expect(uploadPage.noDocumentError).toBeVisible();
  await capture(page, context, `${role}_documentUpload_validationError_noDocument`);

  await uploadPage.addFiles(unsupportedTypeFile());
  await expect(uploadPage.invalidTypeError).toBeVisible();
  await capture(page, context, `${role}_documentUpload_invalidFileType`);

  // Confirmed live: the rejection alert is sticky - once the invalid-type
  // message is up, a later oversize rejection does not replace it, so the
  // size-limit state is only reachable from a fresh page.
  await page.reload();
  await expect(uploadPage.heading).toBeVisible();
  await uploadPage.addFiles(oversizedFile());
  await expect(uploadPage.sizeLimitError).toBeVisible();
  await capture(page, context, `${role}_documentUpload_fileTooLarge`);

  // Same sticky alert: reload so the happy-path capture isn't overlaid with
  // the previous rejection message.
  await page.reload();
  await expect(uploadPage.heading).toBeVisible();
  await uploadPage.addFiles([SAMPLE_PDF, SAMPLE_PNG]);
  await expect(uploadPage.selectedFile('sample-image.png')).toBeVisible();
  await capture(page, context, `${role}_documentUpload_filesSelected`);

  await uploadPage.submit();
  await successPage.expectVisible();
  await capture(page, context, `${role}_documentUploadSuccess_default`);
}
