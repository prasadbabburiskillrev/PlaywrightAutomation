export type PortalRole = 'patient' | 'hcp' | 'pharmacy';

// Landing-page actions, confirmed live, 2026-10-05. Patient and HCP both offer
// an "Upload Documents (...)" action with identical text, so actions are
// scoped by role (see LandingPage). Only the Patient `enrollCopay` flow has
// page objects past the landing page so far.
export type PortalAction =
  | 'enrollCopay'
  | 'uploadDocuments'
  | 'eConsent'
  | 'transitionProgram'
  | 'registerHcpPortal'
  | 'enrollSupportServices'
  | 'enrollCopayOnly';

export type HdhpAnswer = 'yes' | 'no' | 'unknown';

export interface EligibilityAnswers {
  enrolledInFederalOrStateProgram: boolean;
  prescribedForOnLabelIndication: boolean;
  hasCommercialInsurance: boolean;
  agreesToTerms: boolean;
  hasHighDeductibleHealthPlan: HdhpAnswer;
}

export interface PatientInformationData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other/Prefer not to say';
  addressLine1: string;
  addressLine2?: string;
  zipCode: string;
  city: string;
  state: string;
  mobilePhone: string;
  homePhone?: string;
  email?: string;
  // HCP Support Services only:
  middleInitial?: string;
  preferredPhone?: 'mobile' | 'home';
}

export interface PatientAuthorizationData {
  agreesToTcpa: boolean;
  signatureFirstName: string;
  signatureLastName: string;
  representative?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    relationship?: string;
  };
}

// ---- HCP: Enroll Patient in Support Services -------------------------------

export type HcpSupportService =
  | 'allSupportServices'
  | 'benefitsInvestigation'
  | 'priorAuthorization'
  | 'copayServices'
  | 'bridgeOrQuickStart'
  | 'sandozPatientAssistance';

export interface HcpGettingStartedData {
  therapyStatus: 'newToTherapy' | 'switchingFromOtherTherapy';
  services: HcpSupportService[];
  preferredLanguage: 'english' | 'spanish' | 'other';
}

export interface MedicalInsuranceData {
  primaryInsurance: string;
  insurancePhone?: string;
  memberName: string;
  memberId: string;
  policyGroup: string;
  memberEmployer?: string;
}

export interface PharmacyInsuranceData {
  insurance: string;
  memberName: string;
  insurancePhone: string;
  memberId: string;
  rxGroup?: string;
  rxBin?: string;
  rxPcn?: string;
}

export interface HcpHealthInsuranceData {
  medical?: MedicalInsuranceData;
  pharmacy?: PharmacyInsuranceData;
  // "Patient does not have insurance" (routes the patient to the SPA program).
  noInsurance?: boolean;
}

export interface HcpPrescriberData {
  firstName: string;
  lastName: string;
  practiceName: string;
  npi: string;
  ptan?: string;
  taxId?: string;
  addressLine1: string;
  addressLine2?: string;
  zipCode: string;
  city: string;
  state?: string;
  officeContactName: string;
  officeContactPhone: string;
  officeContactFax: string;
  officeContactEmail?: string;
}

export type DiagnosisCode = 'G35.0' | 'G35.A' | 'G35.C0' | 'G35.C1' | 'G35.D' | 'G37.9' | 'K50.0';

export interface HcpPharmacyPrescriptionData {
  refills: string;
  initialInfusion: boolean;
  procurement: 'buyAndBill' | 'specialtyPharmacy';
  administration: 'prescribersOffice' | 'preferredInfusionSite' | 'assistLocatingInfusionCenter';
  prescriberSignature: string;
}

// ---- HCP: Enroll Patient in Co-Pay Assistance Only -------------------------

// Every field is optional on this prescriber form except the signature
// (only needed to link the patient to the HCP Portal account).
export interface HcpCopayPrescriberData {
  firstName?: string;
  lastName?: string;
  npi?: string;
  officeName?: string;
  addressLine1?: string;
  addressLine2?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  siteNpi?: string;
  prescriberSignature: string;
}

// ---- Pharmacy: Enroll Patient in Co-Pay Assistance -------------------------

export interface PharmacyNcpdpData {
  ncpdp: string;
}

// ---- Upload Documents (Patient and HCP share this page) -------------------

export type UploadDocumentType = 'copayClaim' | 'insuranceCard' | 'otherDocumentation';
