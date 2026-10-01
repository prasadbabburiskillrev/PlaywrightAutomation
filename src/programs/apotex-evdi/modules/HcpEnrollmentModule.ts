import { LandingPage } from '../pages/LandingPage';
import { EligibilityPage } from '../pages/EligibilityPage';
import { PatientInformationPage } from '../pages/PatientInformationPage';
import { EligibilityAnswers, PatientInformationData } from '../testdata/types';

export class HcpEnrollmentModule {
  constructor(
    private readonly landingPage: LandingPage,
    private readonly eligibilityPage: EligibilityPage,
    private readonly patientInfoPage: PatientInformationPage
  ) {}

  async startEnrollment(): Promise<void> {
    await this.landingPage.goto();
    await this.landingPage.selectRoleAction('hcp', 'enroll');
    await this.landingPage.goNext();
  }

  async completeEligibility(answers: EligibilityAnswers): Promise<void> {
    await this.eligibilityPage.answer(answers);
    await this.eligibilityPage.goNext();
  }

  async completePatientInformation(data: PatientInformationData): Promise<void> {
    await this.patientInfoPage.fill(data);
    // This "Submit" click is the terminal enrollment action on the HCP path.
    await this.patientInfoPage.submit({ extraPreClickWaitMs: 30_000 });
  }
}
