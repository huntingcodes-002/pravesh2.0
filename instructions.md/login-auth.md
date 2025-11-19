## Overview
We are migrating the authentication flow from "Email-only" to "Email + Password -> OTP". This requires integrating new API endpoints that utilize a `verification_code` session token for security.

## 1. API Integration (`lib/api.ts`)

Update `lib/api.ts` to include these specific new endpoints and types. Do not remove existing types unless they are unused.

### 1.1 New Interfaces
Add these TypeScript interfaces to define the expected request/response shapes:

// Login Request
export interface LoginPraveshRequest {
  username: string; // User's email
  password: string;
}

// Login Response (and Resend Response)
export interface LoginPraveshResponse {
  success: boolean;
  message: string;
  data: {
    masked_phone_number: string;
    verification_code: string; // Encrypted session token required for next steps
  };
}

// Verify OTP Request
export interface VerifyOTPRequest {
  otp: string;
  verification_code: string; // From Login Response
}

// Resend OTP Request
export interface ResendOTPRequest {
  verification_code: string; // From Login/Previous Resend Response
}
1.2 New API Functions
Implement these functions using the existing apiFetch wrapper.

loginPravesh

Endpoint: POST /api/auth/login-pravesh/

Payload: LoginPraveshRequest

Description: Authenticates credentials. The backend redirects internally to generating an OTP. Returns LoginPraveshResponse containing the verification_code.

verifyPraveshOTP

Endpoint: POST /api/auth/verify-otp/

Payload: VerifyOTPRequest

Description: Verifies the user-entered OTP against the verification_code. Returns the standard Auth token response (same as existing verifyOTP return type).

resendPraveshOTP

Endpoint: POST /api/auth/resend-otp/

Payload: ResendOTPRequest

Description: Triggers a new OTP SMS. Returns LoginPraveshResponse (potentially with a fresh verification_code).

2. Authentication Logic (contexts/AuthContext.tsx)
Refactor the AuthContext to manage the verification_code lifecycle.

2.1 State Management
Update the PendingAuth type definition to include:

verificationCode: string

maskedPhone: string

Ensure pendingAuth state is persisted to sessionStorage (key: pendingAuth) so the flow survives a page refresh on the OTP screen.

2.2 Update login Function
Signature: Change to login(email: string, password: string).

Logic:

Call loginPravesh({ username: email, password }).

On success:

Extract verification_code and masked_phone_number from response.data.

Set pendingAuth state with these values + the email.

Persist to sessionStorage.

Return true (to trigger redirect in the UI).

2.3 Update verifyOtpAndSignIn Function
Signature: verifyOtpAndSignIn(otp: string). (Remove email param if it's now unused, or keep for logging).

Logic:

Retrieve verificationCode from pendingAuth state (or sessionStorage).

If missing, return false (or throw error).

Call verifyPraveshOTP({ otp, verification_code }).

On success:

Save tokens (access_token, etc.) to sessionStorage key 'auth'.

Set User state.

Clear pendingAuth.

2.4 Implement resendOtp Function
Logic:

Retrieve verificationCode from pendingAuth.

Call resendPraveshOTP({ verification_code }).

Important: If the response contains a new verification_code, update the pendingAuth state and sessionStorage immediately to keep the session valid.

3. UI Updates
3.1 Login Page (app/login/page.tsx)
UI: Add a Password input field (type="password") to the form.

Validation: Update zod schema to validate the password field.

Action: Update onSubmit to pass both data.email and data.password to the login function.

3.2 OTP Page (app/otp/page.tsx)
Display: Use the maskedPhone from the pendingAuth context to show a message like "OTP sent to +91******123".

Action: Wire the "Verify" button to verifyOtpAndSignIn(otp).

Action: Wire the "Resend OTP" button to resendOtp().

4. General Requirements
No Hardcoding: Do not hardcode usernames, passwords, or tokens. Use the data flow described.

Error Handling: Pass API error messages to the UI via toast notifications.