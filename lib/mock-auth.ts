
export const MOCK_USER = {
  email: 'rm1@rm.com',
  password: '12qwaszx',
  name: 'Albert Einstein',
  rmId: 'RM-MH-MU-AE201',
  phone: '911',
};

export const MOCK_OTP = '342286';

export function validateOTP(otp: string): boolean {
  return otp === MOCK_OTP;
}

export function validateLogin(email: string, password: string): boolean {
  return email === MOCK_USER.email && password === MOCK_USER.password;
}
