import { LandingPage } from '../pages/LandingPage';
import { DocumentUploadPage } from '../pages/DocumentUploadPage';
import { PortalRole } from '../testdata/types';
import { UploadFiles } from '../testdata/uploadFiles';

// Unlike enrollment, the upload flow is the same for both roles (verified
// live: Patient and HCP "Upload Documents" both route straight to the same
// /upload-documents/ page, with no eligibility step), so one module takes the
// role as a parameter instead of splitting into per-role modules.
export class DocumentUploadModule {
  constructor(
    private readonly landingPage: LandingPage,
    private readonly uploadPage: DocumentUploadPage
  ) {}

  async startUpload(role: PortalRole): Promise<void> {
    await this.landingPage.goto();
    await this.landingPage.selectRoleAction(role, 'upload');
    await this.landingPage.goNext();
    await this.uploadPage.expectVisible();
  }

  async uploadDocuments(files: UploadFiles): Promise<void> {
    await this.uploadPage.addFiles(files);
    await this.uploadPage.submit();
  }
}
