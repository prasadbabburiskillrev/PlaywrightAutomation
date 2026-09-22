import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { PatientInformationPage } from '../pages/PatientInformationPage';
import { PatientConsentPage } from '../pages/PatientConsentPage';
import { EligibilityAnswers, PatientInformationData } from '../testdata/types';

export class PatientEnrollmentModule {
  constructor(
    private readonly landingPage: LandingPage,
    private readonly eligibilityPage: EligibilityPage,
    private readonly patientInfoPage: PatientInformationPage,
    private readonly consentPage: PatientConsentPage
  ) {}

  async startEnrollment(): Promise<void> {
    await this.landingPage.goto();
    await this.landingPage.selectRoleAction('patient', 'enroll');
    await this.landingPage.goNext();
  }

  async completeEligibility(answers: EligibilityAnswers): Promise<void> {
    await this.eligibilityPage.answer(answers);
    await this.eligibilityPage.goNext();
  }

  async completePatientInformation(data: PatientInformationData): Promise<void> {
    await this.patientInfoPage.fill(data);
    await this.patientInfoPage.submit();
  }

  async completeConsent(signatureName: string): Promise<void> {
    await this.consentPage.agreeAndSign(signatureName);
    
    await this.consentPage.submit();
  }
}
