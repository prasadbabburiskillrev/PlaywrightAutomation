import { faker } from '@faker-js/faker';
import { PatientInformationData } from '../testdata/types';

function generateDateOfBirth(): string {
  const birthdate = faker.date.birthdate({ min: 18, max: 100, mode: 'age' });
  const mm = String(birthdate.getMonth() + 1).padStart(2, '0');
  const dd = String(birthdate.getDate()).padStart(2, '0');
  const yyyy = birthdate.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function generateMobilePhone(): string {
  // NANP-style: 1st (area code) and 4th (exchange code) digits must not be 0 or 1.
  const digit = () => faker.number.int({ min: 0, max: 9 });
  const leadingDigit = () => faker.number.int({ min: 2, max: 9 });
  const digits = [
    leadingDigit(),
    digit(),
    digit(),
    leadingDigit(),
    digit(),
    digit(),
    digit(),
    digit(),
    digit(),
    digit(),
  ];
  return digits.join('');
}

export function generatePatientInformation(): PatientInformationData {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    dateOfBirth: generateDateOfBirth(),
    gender: 'Prefer not to answer',
    addressLine1: faker.location.streetAddress(),
    zipCode: '10010',
    city: 'New York',
    state: 'New York',
    mobilePhone: generateMobilePhone(),
    email: faker.internet.email(),
  };
}
