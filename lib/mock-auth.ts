
export const MOCK_USER = {
  email: 'rm1@rm.com',
  password: '12qwaszx',
  name: 'Albert Einstein',
  rmId: 'RM-MH-MU-AE201',
  phone: '911',
};

export const MOCK_OTP = '342286';

// --- New Detailed PAN Data ---
export const PAN_DATA = [
  {
    pan: 'ABCDE1234F',
    salutation: 'Mr',
    firstName: 'Userfna',
    lastName: 'Userfnb',
    dateOfBirth: '2002-08-24', // August 24, 2002
  },
  {
    pan: 'GHIJK1234L',
    salutation: 'Ms',
    firstName: 'Userfnc',
    lastName: 'Userfnd',
    dateOfBirth: '2002-08-24', // August 24, 2002
  },
  {
    pan: 'MNOPQ1234R',
    salutation: 'Mrs',
    firstName: 'Userfne',
    lastName: 'Userfnf',
    dateOfBirth: '2002-08-24', // August 24, 2002
  },
];

export const VALID_FILES = {
  'pan.jpg': 'PAN',
  'adhaar.jpg': 'Adhaar',
  'bankStm.pdf': 'BankStatement',
  'colOwn.jpg': 'CollateralProperty',
  'colPic.jpg': 'CollateralPhotos',
};

export function validateOTP(otp: string): boolean {
  return otp === MOCK_OTP;
}

export function validateLogin(email: string, password: string): boolean {
  return email === MOCK_USER.email && password === MOCK_USER.password;
}

// --- New PAN Validation Logic ---
export type PanValidationResult = {
  panExists: boolean;
  salutationMatch: boolean;
  firstNameMatch: boolean;
  lastNameMatch: boolean;
  dateOfBirthMatch: boolean;
};

export function validatePANDetails(
  pan: string,
  salutation: string,
  firstName: string,
  lastName: string,
  dateOfBirth?: string
): PanValidationResult {
  const panDetails = PAN_DATA.find((p) => p.pan.toUpperCase() === pan.toUpperCase());

  if (!panDetails) {
    return {
      panExists: false,
      salutationMatch: false,
      firstNameMatch: false,
      lastNameMatch: false,
      dateOfBirthMatch: false,
    };
  }

  return {
    panExists: true,
    salutationMatch: panDetails.salutation === salutation,
    firstNameMatch: panDetails.firstName.toLowerCase() === firstName.toLowerCase(),
    lastNameMatch: panDetails.lastName.toLowerCase() === lastName.toLowerCase(),
    dateOfBirthMatch: dateOfBirth ? panDetails.dateOfBirth === dateOfBirth : true,
  };
}


export function validateFile(fileName: string): { valid: boolean; error?: string; type?: string } {
  // Check for mock filenames first
  const fileKey = Object.keys(VALID_FILES).find(key => fileName.toLowerCase() === key.toLowerCase());
  if (fileKey) {
    const fileType = VALID_FILES[fileKey as keyof typeof VALID_FILES];
    return { valid: true, type: fileType };
  }
  
  // Default validation for camera captures
  if (fileName.startsWith('capture_')) {
    return { valid: true };
  }
  
  return { valid: false, error: 'File name is invalid for mock validation.' };
}
