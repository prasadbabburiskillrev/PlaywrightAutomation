export type PortalRole = 'patient';
export type PortalAction = 'enrollCopay';

export interface EligibilityAnswers {
  enrolledInFederalOrStateProgram: boolean;
  isAdult: boolean;
  livesInUsOrTerritories: boolean;
  hasCommercialInsurance: boolean;
  agreesToTerms: boolean;
}

export interface PatientInformationData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Prefer not to answer';
  addressLine1: string;
  addressLine2?: string;
  zipCode: string;
  city: string;
  state: string;
  mobilePhone: string;
  homePhone?: string;
  email: string;
}
