import { test, expect } from '../fixtures';
import { PortalRole } from '../testdata/types';
import { SAMPLE_PDF, SAMPLE_PNG, oversizedFile, unsupportedTypeFile } from '../testdata/uploadFiles';

// Patient and HCP "Upload Documents" share one page and one flow (verified
// live), so every case runs once per role to prove both landing-page entry
// points are wired up.
const roles: PortalRole[] = ['patient', 'hcp'];

for (const role of roles) {
  test.describe(`${role === 'patient' ? 'Patient' : 'HCP'} document upload`, () => {
    test.beforeEach(async ({ documentUpload }) => {
      await documentUpload.startUpload(role);
    });

    test('shows an error when Upload is clicked with no documents', async ({ documentUploadPage }) => {
      await documentUploadPage.submit();

      await expect(documentUploadPage.noDocumentError).toBeVisible();
      await documentUploadPage.expectVisible();
    });

    test('rejects a file with an unsupported type', async ({ documentUploadPage }) => {
      await documentUploadPage.addFiles(unsupportedTypeFile());

      await expect(documentUploadPage.invalidTypeError).toBeVisible();
      await expect(documentUploadPage.selectedFile('unsupported.txt')).toHaveCount(0);
      await expect(documentUploadPage.removeFileButtons).toHaveCount(0);
    });

    test('rejects a file over the 10 MB size limit', async ({ documentUploadPage }) => {
      await documentUploadPage.addFiles(oversizedFile());

      await expect(documentUploadPage.sizeLimitError).toBeVisible();
      await expect(documentUploadPage.selectedFile('oversized.pdf')).toHaveCount(0);
      await expect(documentUploadPage.removeFileButtons).toHaveCount(0);
    });

    test('lists selected files and removes one', async ({ documentUploadPage }) => {
      await documentUploadPage.addFiles([SAMPLE_PDF, SAMPLE_PNG]);
      await expect(documentUploadPage.selectedFile('sample-document.pdf')).toBeVisible();
      await expect(documentUploadPage.selectedFile('sample-image.png')).toBeVisible();
      await expect(documentUploadPage.addNewDocumentLink).toBeVisible();

      await documentUploadPage.removeFile('sample-image.png');

      await expect(documentUploadPage.selectedFile('sample-image.png')).toHaveCount(0);
      await expect(documentUploadPage.selectedFile('sample-document.pdf')).toBeVisible();
    });

    test('uploads documents successfully end to end', async ({
      documentUpload,
      documentUploadPage,
      documentUploadSuccessPage,
    }, testInfo) => {
      // beforeEach already spends ~10s on the landing page's diagnostic wait
      // plus slow QA-host loads, leaving too little of the 90s default for the
      // upload round trip (up to 60s) on a busy host - same reasoning as the
      // enrollment specs' end-to-end tests.
      testInfo.setTimeout(180_000);
      await documentUpload.uploadDocuments([SAMPLE_PDF, SAMPLE_PNG]);

      await documentUploadSuccessPage.expectVisible();

      await documentUploadSuccessPage.uploadMore();
      await documentUploadPage.expectVisible();
    });
  });
}
