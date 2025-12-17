/**
 * API utility functions for backend integration
 */

const API_BASE_URL = 'https://uatlb.api.saarathifinance.com/api/lead-collection/';
const AUTH_API_BASE_URL = 'https://uatlb.api.saarathifinance.com/api/token/';

export interface ApiError {
  success: false;
  error: string;
  error_type: string;
  details?: Record<string, any>;
  application_id?: string;
}

export interface ApiSuccess<T = any> {
  success: true;
  message?: string;
  application_id?: string;
  workflow_id?: string;
  next_step?: string;
  data?: T;
  // Allow additional fields for auth endpoints that return data at top level
  [key: string]: any;
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

// =========================================================================
// Shared Application Types
// =========================================================================

export interface ApplicationSummaryItem {
  application_id: string;
  first_name: string | null;
  last_name: string | null;
  mobile_number: string | null;
  created_on: string;
}

export interface ApplicationsSummaryResponse {
  success: true;
  total_applications: number;
  draft_applications: number;
  completed_applications: number;
  applications: ApplicationSummaryItem[];
}

/**
 * Helper function to check if response is an error
 */
export function isApiError(response: ApiResponse): response is ApiError {
  return !response.success;
}

/**
 * Helper function to get auth token (ID Token) from localStorage (with sessionStorage fallback)
 * Exported for use across the application
 * Always fetches fresh token from storage (no caching)
 */
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    // Check localStorage first (new auth) - always read fresh
    let authData = localStorage.getItem('auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        // Use id_token instead of access_token
        const token = parsed.id_token;
        // Validate token exists and is not empty
        if (token && typeof token === 'string' && token.trim().length > 0) {
          return token;
        }
        // If id_token is missing but we have auth data, we might want to keep it or clear it.
        // For now, if the expected token is missing, we treat it as no token.
      } catch {
        // Invalid JSON, clear it
        localStorage.removeItem('auth');
      }
    }
    // Fallback to sessionStorage for backward compatibility - always read fresh
    authData = sessionStorage.getItem('auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        const token = parsed.id_token;
        // Validate token exists and is not empty
        if (token && typeof token === 'string' && token.trim().length > 0) {
          return token;
        }
      } catch {
        // Invalid JSON, clear it
        sessionStorage.removeItem('auth');
      }
    }
  }
  return null;
}

/**
 * Helper function to handle API errors
 */
export function handleApiError(error: any): ApiError {
  if (error.response?.data) {
    return error.response.data as ApiError;
  }

  if (error.message) {
    return {
      success: false,
      error: error.message,
      error_type: 'NETWORK_ERROR',
      details: { original_error: String(error) }
    };
  }

  return {
    success: false,
    error: 'An unexpected error occurred',
    error_type: 'UNKNOWN_ERROR',
    details: { original_error: String(error) }
  };
}

/**
 * Base fetch function with error handling
 */
async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Get auth token if available
    let authToken = getAuthToken();

    // Build fetch options ensuring method from options takes precedence
    const buildOptions = (token: string | null): RequestInit => ({
      ...options, // Spread options first (includes method if specified)
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers, // Allow custom headers to override
      },
    });

    let fetchOptions = buildOptions(authToken);

    // If no method specified, default to GET (but POST should be specified in options)
    if (!fetchOptions.method) {
      fetchOptions.method = 'GET';
    }

    let response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

    // Handle 401 Unauthorized - Attempt Refresh Token
    if (response.status === 401) {
      const refreshed = await handleTokenRefresh();
      if (refreshed) {
        // Retry original request with new token
        authToken = getAuthToken();
        fetchOptions = buildOptions(authToken);
        if (!fetchOptions.method) fetchOptions.method = 'GET';
        response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
      }
    }

    const data = await response.json();

    if (!response.ok) {
      // Return error response
      return data as ApiError;
    }

    // Return success response
    return data as ApiSuccess<T>;
  } catch (error: any) {
    return handleApiError(error);
  }
}

/**
 * Helper to refresh token
 */
async function handleTokenRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const authDataStr = localStorage.getItem('auth') || sessionStorage.getItem('auth');
  if (!authDataStr) return false;

  try {
    const authData = JSON.parse(authDataStr);
    const refreshToken = authData.refresh_token;

    if (!refreshToken) return false;

    const response = await refreshAuthToken({ refresh_token: refreshToken });

    if (isApiError(response) || !response.success || !response.data) {
      // Refresh failed, clear auth
      localStorage.removeItem('auth');
      sessionStorage.removeItem('auth');
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
      // Optional: Redirect to login or let the app handle the 401
      return false;
    }

    // Update storage with new tokens
    const newAuthData = {
      ...authData,
      ...response.data,
    };

    localStorage.setItem('auth', JSON.stringify(newAuthData));
    // Update sessionStorage if it was there
    if (sessionStorage.getItem('auth')) {
      sessionStorage.setItem('auth', JSON.stringify(newAuthData));
    }

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Base fetch function for multipart/form-data (file uploads)
 */
async function apiFetchFormData<T = any>(
  endpoint: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  try {
    // Get auth token if available
    const authToken = getAuthToken();

    const headers: HeadersInit = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    // Don't set Content-Type header - browser will set it with boundary

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return data as ApiError;
    }

    return data as ApiSuccess<T>;
  } catch (error: any) {
    return handleApiError(error);
  }
}

/**
 * Base fetch function for auth endpoints (uses different base URL)
 * Supports both JSON and urlencoded formats
 * Optionally includes Authorization header for authenticated requests
 */
async function apiFetchAuth<T = any>(
  endpoint: string,
  options: RequestInit = {},
  useUrlEncoded: boolean = false,
  includeAuth: boolean = false
): Promise<ApiResponse<T>> {
  try {
    // Get auth token if needed
    const authToken = includeAuth ? getAuthToken() : null;

    // Build fetch options ensuring method from options takes precedence
    const fetchOptions: RequestInit = {
      ...options, // Spread options first (includes method if specified)
      headers: {
        ...(useUrlEncoded ? { 'Content-Type': 'application/x-www-form-urlencoded' } : { 'Content-Type': 'application/json' }),
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        ...options.headers, // Allow custom headers to override
      },
    };

    // If no method specified, default to GET (but POST should be specified in options)
    if (!fetchOptions.method) {
      fetchOptions.method = 'GET';
    }

    const response = await fetch(`${AUTH_API_BASE_URL}${endpoint}`, fetchOptions);

    const data = await response.json();

    if (!response.ok) {
      // Return error response
      return data as ApiError;
    }

    // Return success response
    return data as ApiSuccess<T>;
  } catch (error: any) {
    return handleApiError(error);
  }
}

// ============================================================================
// Authentication API Endpoints (Pravesh - New Auth Flow)
// ============================================================================

/**
 * Authentication: Login with Username/Password (Pravesh)
 * POST /api/auth/login-pravesh/
 */
export interface LoginPraveshRequest {
  username: string; // User's email
  password: string;
}

export interface LoginPraveshResponse {
  masked_phone_number: string;
  verification_code: string; // Encrypted session token required for next steps
}

export async function loginPravesh(data: LoginPraveshRequest): Promise<ApiResponse<LoginPraveshResponse>> {
  // Convert to URL-encoded format as per API spec
  const formData = new URLSearchParams();
  formData.append('username', data.username);
  formData.append('password', data.password);

  return apiFetchAuth<LoginPraveshResponse>('login-pravesh/', {
    method: 'POST',
    body: formData.toString(),
  }, true);
}

/**
 * Authentication: Verify OTP Response (Pravesh)
 * Response structure from /api/auth/verify-otp/
 * Based on Postman collection, tokens are in data object
 */
export interface VerifyOTPResponseData {
  access_token?: string; // Optional as per new API
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  id_token: string;
  not_before_policy: number;
  session_state: string;
  scope: string;
}

export interface VerifyOTPResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
}

/**
 * Authentication: Verify OTP (Pravesh)
 * POST /api/auth/verify-otp/
 */
export interface VerifyPraveshOTPRequest {
  otp: string;
  verification_code: string; // From Login Response
}

export async function verifyPraveshOTP(data: VerifyPraveshOTPRequest): Promise<ApiResponse<VerifyOTPResponseData>> {
  // Convert to URL-encoded format as per API spec
  const formData = new URLSearchParams();
  formData.append('otp', data.otp);
  formData.append('verification_code', data.verification_code);

  return apiFetchAuth<VerifyOTPResponseData>('verify-otp/', {
    method: 'POST',
    body: formData.toString(),
  }, true);
}

/**
 * Authentication: Resend OTP (Pravesh)
 * POST /api/auth/resend-otp/
 */
export interface ResendPraveshOTPRequest {
  verification_code: string; // From Login/Previous Resend Response
}

export async function resendPraveshOTP(data: ResendPraveshOTPRequest): Promise<ApiResponse<LoginPraveshResponse>> {
  // Convert to URL-encoded format as per API spec
  const formData = new URLSearchParams();
  formData.append('verification_code', data.verification_code);

  return apiFetchAuth<LoginPraveshResponse>('resend-otp/', {
    method: 'POST',
    body: formData.toString(),
  }, true);
}

/**
 * Authentication: Refresh Token
 * POST /api/token/refresh-token/
 */
export interface RefreshTokenRequest {
  refresh_token: string;
}

export async function refreshAuthToken(data: RefreshTokenRequest): Promise<ApiResponse<VerifyOTPResponseData>> {
  // Send refresh token in Authorization header without Bearer prefix
  return apiFetchAuth<VerifyOTPResponseData>('refresh-token/', {
    method: 'POST',
    headers: {
      'Authorization': data.refresh_token
    }
  }, false, false);
}

/**
 * Authentication: Logout
 * GET /api/token/logout/
 */
export async function logoutUser(): Promise<ApiResponse<any>> {
  return apiFetchAuth('logout/', {
    method: 'GET',
  }, false, true); // Include auth token
}

/**
 * Authentication: Forgot Password
 * POST /api/token/forgotpassword/
 */
export interface ForgotPasswordRequest {
  email: string;
}

export async function forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse<any>> {
  return apiFetchAuth('forgotpassword/', {
    method: 'POST',
    body: JSON.stringify(data),
  }, false, false);
}

/**
 * Authentication: Get User Profile
 * GET /api/auth/user-profile/
 */
export interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  email_verified: boolean;
  is_active: boolean;
  user_type: string;
  branch_code: string;
  employee_code: string;
  permissions: string[];
}

export async function getUserProfile(): Promise<ApiResponse<UserProfileResponse>> {
  return apiFetchAuth<UserProfileResponse>('user-profile/', {
    method: 'GET',
  }, false, true); // Include auth token
}

// ============================================================================
// API Endpoint Functions
// ============================================================================

/**
 * Endpoint 1: Create New Lead
 * POST /api/lead-collection/applications/new-lead/
 */
export interface NewLeadRequest {
  product_type: string;
  application_type: string;
  mobile_number: string;
  first_name: string;
  last_name: string;
}

export interface NewLeadResponse {
  application_id: string;
  workflow_id?: string;
  next_step?: string;
  product_type: string;
  application_type: string;
  mobile_number: string;
  first_name: string;
  last_name: string;
}

export async function createNewLead(data: NewLeadRequest): Promise<ApiResponse<NewLeadResponse>> {
  return apiFetch<NewLeadResponse>('applications/new-lead/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Endpoint: Resend Mobile OTP
 * POST /api/lead-collection/applications/resend-mobile-otp/
 */
export interface ResendMobileOtpRequest {
  application_id: string;
}

export interface ResendMobileOtpData {
  application_id: string;
  otp_sent: boolean;
  resend_count: number;
  ttl_seconds: number;
  mobile_number: string;
}

export async function resendMobileOTP(
  data: ResendMobileOtpRequest
): Promise<ApiResponse<ResendMobileOtpData>> {
  return apiFetch<ResendMobileOtpData>('applications/resend-mobile-otp/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Endpoint: Fetch Payment Status
 * GET /api/lead-collection/applications/payment-status/
 */
export interface PaymentStatusData {
  state?: string;
  masked_customer_mobile?: string;
  paid_on?: string;
  [key: string]: any;
}

export async function fetchPaymentStatus(
  applicationId: string
): Promise<ApiResponse<PaymentStatusData>> {
  const query = `applications/payment-status/?application_id=${encodeURIComponent(applicationId)}`;
  return apiFetch<PaymentStatusData>(query, {
    method: 'GET',
    credentials: 'include',
  });
}

/**
 * Endpoint: Submit Co-Applicant Address Details
 * POST /api/lead-collection/applications/{application_id}/co-applicant-address-details/{co_applicant_index}/
 */
export interface CoApplicantAddressPayload {
  address_type: string;
  address_line_1: string;
  address_line_2?: string;
  address_line_3?: string;
  landmark: string;
  pincode: string;
  latitude: string;
  longitude: string;
  is_primary: boolean;
}

export interface CoApplicantAddressRequest {
  application_id: string;
  co_applicant_index: number;
  addresses: CoApplicantAddressPayload[];
}

export type CoApplicantAddressResponse = ApiResponse<{
  addresses_created?: number;
  customer_id?: string;
  addresses?: Array<{
    id?: string | number;
    address_line_1?: string;
    address_type?: string;
    is_primary?: boolean;
  }>;
}>;

export async function submitCoApplicantAddressDetails(
  data: CoApplicantAddressRequest
): Promise<CoApplicantAddressResponse> {
  const { application_id, co_applicant_index, addresses } = data;
  return apiFetch(`applications/${encodeURIComponent(application_id)}/co-applicant-address-details/${co_applicant_index}/`, {
    method: 'POST',
    body: JSON.stringify({ addresses }),
  }) as Promise<CoApplicantAddressResponse>;
}

/**
 * Endpoint: Delete Co-Applicant
 * POST /api/lead-collection/applications/co-applicant-delete/
 */
export interface DeleteCoApplicantRequest {
  application_id: string;
  co_applicant_index: number;
}

export type DeleteCoApplicantResponse = ApiResponse<{
  application_id?: string;
  co_applicant_index?: number;
  deleted_participant_id?: number | string;
  remaining_co_applicants?: number;
}>;

export async function deleteCoApplicantFromApi(
  data: DeleteCoApplicantRequest
): Promise<DeleteCoApplicantResponse> {
  return apiFetch('applications/co-applicant-delete/', {
    method: 'POST',
    body: JSON.stringify(data),
  }) as Promise<DeleteCoApplicantResponse>;
}

/**
 * Endpoint: Pincode Lookup
 * POST /api/base/pincode/lookup/
 */
export interface PincodeLookupRequest {
  zip_code: string;
}

export interface PincodeLookupSuccess {
  success: true;
  zip_code: string;
  state: string;
  state_code: string;
  city: string;
  city_code?: string;
}

export type PincodeLookupResponse = ApiResponse<PincodeLookupSuccess>;

export async function lookupPincode(
  zip_code: string
): Promise<PincodeLookupResponse> {
  try {
    const authToken = getAuthToken();

    const response = await fetch('https://uatlb.api.saarathifinance.com/api/base/pincode/lookup/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify({ zip_code }),
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return data as ApiError;
    }

    return data as PincodeLookupSuccess;
  } catch (error: any) {
    return handleApiError(error);
  }
}

/**
 * Endpoint 7: Verify Mobile OTP
 * POST /api/lead-collection/applications/verify-mobile/
 */
export interface VerifyMobileRequest {
  application_id: string;
  otp: string;
}

export interface VerifyMobileResponse {
  success: true;
  message: string;
  application_id: string;
  mobile_verified: boolean;
  next_step?: string;
  data?: {
    customer_id?: string;
    mobile_number?: string;
    verified_at?: string;
  };
}

export async function verifyMobileOTP(data: VerifyMobileRequest): Promise<ApiResponse<VerifyMobileResponse>> {
  return apiFetch<VerifyMobileResponse>('applications/verify-mobile/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Endpoint 3: Submit Personal Info
 * POST /api/lead-collection/applications/personal-info/
 */
export interface PersonalInfoRequest {
  application_id: string;
  customer_type: 'individual' | 'non_individual';
  pan_number?: string;
  pan_unavailability_reason?: string;
  alternate_id_type?: string;
  alternate_id_number?: string;
  date_of_birth: string; // ISO date string
  gender: string;
  email?: string;
}

export interface PersonalInfoResponse {
  success: boolean;
  message?: string;
  application_id: string;
  next_step?: string;
  data?: {
    application_id: string;
    customer_id: string;
    customer_type: string;
    pan_number?: string;
    pan_unavailability_reason?: string;
    alternate_id_type?: string;
    alternate_id_number?: string;
    date_of_birth: string;
    gender: string;
    email?: string;
    pan_verification_required?: boolean;
    pan_verification_status?: string;
  };
}

export async function submitPersonalInfo(data: PersonalInfoRequest): Promise<ApiResponse<PersonalInfoResponse>> {
  return apiFetch<PersonalInfoResponse>('applications/personal-info/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Endpoint: Start Co-Applicant Workflow
 * POST /api/lead-collection/applications/co-applicant-management/
 */
export interface CoApplicantWorkflowRequest {
  application_id: string;
  relationship_to_primary: string;
}

export interface CoApplicantWorkflowResponse {
  success: boolean;
  message?: string;
  co_applicant_workflow_id?: string;
  co_applicant_index?: number;
  next_step?: string;
}

export async function startCoApplicantWorkflow(
  data: CoApplicantWorkflowRequest
): Promise<ApiResponse<CoApplicantWorkflowResponse>> {
  return apiFetch<CoApplicantWorkflowResponse>('applications/co-applicant-management/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Endpoint: Submit Co-Applicant Consent Mobile
 * POST /api/lead-collection/applications/{application_id}/co-applicant-consent-mobile/{index}/
 */
export interface CoApplicantConsentMobileRequest {
  application_id: string;
  co_applicant_index: number;
  mobile_number: string;
  first_name: string;
  last_name: string;
}

export interface CoApplicantConsentMobileResponse {
  success: boolean;
  message?: string;
  application_id: string;
  co_applicant_index: number;
  otp_sent?: boolean;
  data?: {
    mobile_number?: string;
    full_name?: string;
  };
}

export async function submitCoApplicantConsentMobile(
  data: CoApplicantConsentMobileRequest
): Promise<ApiResponse<CoApplicantConsentMobileResponse>> {
  const { application_id, co_applicant_index, ...payload } = data;
  return apiFetch<CoApplicantConsentMobileResponse>(
    `applications/${application_id}/co-applicant-consent-mobile/${co_applicant_index}/`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export interface CoApplicantVerifyMobileRequest {
  application_id: string;
  co_applicant_index: number;
  otp: string;
}

export interface CoApplicantVerifyMobileResponse {
  success: boolean;
  message?: string;
  application_id: string;
  co_applicant_index: number;
  mobile_verified: boolean;
}

export async function verifyCoApplicantMobileOTP(
  data: CoApplicantVerifyMobileRequest
): Promise<ApiResponse<CoApplicantVerifyMobileResponse>> {
  const { application_id, co_applicant_index, otp } = data;
  return apiFetch<CoApplicantVerifyMobileResponse>(
    `applications/${application_id}/co-applicant-verify-mobile/${co_applicant_index}/`,
    {
      method: 'POST',
      body: JSON.stringify({ otp }),
    }
  );
}

/**
 * Endpoint: Submit Co-Applicant Personal Info
 * POST /api/lead-collection/applications/{application_id}/co-applicant-personal-info/{index}/
 */
export interface CoApplicantPersonalInfoRequest {
  application_id: string;
  co_applicant_index: number;
  customer_type: 'individual' | 'non_individual';
  pan_number?: string;
  date_of_birth: string;
  gender: string;
  email?: string;
}

export interface CoApplicantPersonalInfoResponse {
  success: boolean;
  message?: string;
  application_id: string;
  co_applicant_index: number;
  next_step?: string;
  data?: {
    application_id?: string;
    customer_id?: string;
    customer_type?: string;
    pan_number?: string;
    date_of_birth?: string;
    gender?: string;
    email?: string;
  };
}

export async function submitCoApplicantPersonalInfo(
  data: CoApplicantPersonalInfoRequest
): Promise<ApiResponse<CoApplicantPersonalInfoResponse>> {
  const { application_id, co_applicant_index } = data;
  const payload = {
    application_id,
    co_applicant_index,
    customer_type: data.customer_type,
    pan_number: data.pan_number,
    date_of_birth: data.date_of_birth,
    gender: data.gender,
    ...(data.email ? { email: data.email } : {}),
  };
  return apiFetch<CoApplicantPersonalInfoResponse>(
    `applications/${application_id}/co-applicant-personal-info/${co_applicant_index}/`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Endpoint 4: Submit Address Details
 * POST /api/lead-collection/applications/address-details/
 */
export interface AddressDetailsRequest {
  application_id: string;
  addresses: Array<{
    address_type: string; // From dropdown
    address_line_1: string;
    address_line_2?: string;
    address_line_3?: string;
    landmark?: string;
    pincode: string;
    latitude: string;
    longitude: string;
    is_primary: boolean;
  }>;
}

export interface AddressDetailsResponse {
  application_id: string;
  addresses_count: number;
}

export async function submitAddressDetails(data: AddressDetailsRequest): Promise<ApiResponse<AddressDetailsResponse>> {
  return apiFetch<AddressDetailsResponse>('applications/address-details/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Endpoint 5: Upload Document
 * POST /api/lead-collection/applications/document-upload/
 */
export interface DocumentUploadRequest {
  application_id: string;
  document_type: 'pan_card' | 'aadhaar_card' | 'driving_license' | 'passport' | 'voter_id' | 'collateral_documents' | 'collateral_legal' | 'bank_statement' | 'salary_slip' | 'itr' | 'other' | string;
  front_file: File;
  back_file?: File;
  document_name?: string;
  metadata?: Record<string, any> | string;
  latitude?: string;
  longitude?: string;
}

export interface DocumentUploadResponse {
  document_type: string;
  document_name: string;
  file_size: number;
  uploaded_at: string;
  // Parsed data for PAN/Aadhaar (if available)
  parsed_data?: {
    // PAN data
    pan_number?: string;
    date_of_birth?: string;
    name?: string;
    gender?: string;
    // Aadhaar data
    address_line_1?: string;
    address_line_2?: string;
    address_line_3?: string;
    city?: string;
    state?: string;
    pincode?: string;
    // Common
    extracted_data?: Record<string, any>;
  };
}

export async function uploadDocument(data: DocumentUploadRequest): Promise<ApiResponse<DocumentUploadResponse>> {
  const formData = new FormData();

  formData.append('application_id', data.application_id);
  formData.append('document_type', data.document_type);
  formData.append('front_file', data.front_file);

  if (data.back_file) {
    formData.append('back_file', data.back_file);
  }

  if (data.document_name) {
    formData.append('document_name', data.document_name);
  }

  if (data.metadata) {
    if (typeof data.metadata === 'string') {
      formData.append('metadata', data.metadata);
    } else {
      formData.append('metadata', JSON.stringify(data.metadata));
    }
  }

  if (data.latitude) {
    formData.append('latitude', data.latitude);
  }

  if (data.longitude) {
    formData.append('longitude', data.longitude);
  }

  return apiFetchFormData<DocumentUploadResponse>('applications/document-upload/', formData);
}

/**
 * Endpoint: Upload Co-Applicant Document
 * POST /api/lead-collection/applications/{application_id}/document-upload/{co_applicant_index}/
 */
export interface CoApplicantDocumentUploadRequest {
  application_id: string;
  co_applicant_index: number;
  document_type: 'pan_card' | 'aadhaar_card';
  front_file: File;
  back_file?: File;
  document_name?: string;
  latitude: string;
  longitude: string;
}

export interface CoApplicantDocumentUploadResponse {
  success: boolean;
  message?: string;
  application_id: string;
  co_applicant_index: number;
  next_step?: string;
  data?: {
    document_type: string;
    uploaded_at: string;
    reference_ids?: {
      front: string | null;
      back: string | null;
    };
  };
}

export async function uploadCoApplicantDocument(
  data: CoApplicantDocumentUploadRequest
): Promise<ApiResponse<CoApplicantDocumentUploadResponse>> {
  try {
    const authToken = getAuthToken();

    const formData = new FormData();
    formData.append('document_type', data.document_type);
    formData.append('front_file', data.front_file);

    if (data.back_file) {
      formData.append('back_file', data.back_file);
    } else {
      formData.append('back_file', '');
    }

    if (data.document_name) {
      formData.append('document_name', data.document_name);
    }

    formData.append('metadata', JSON.stringify({}));
    formData.append('latitude', data.latitude);
    formData.append('longitude', data.longitude);

    const headers: HeadersInit = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(
      `${API_BASE_URL}applications/${encodeURIComponent(data.application_id)}/document-upload/${data.co_applicant_index}/`,
      {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return result as ApiError;
    }

    return result as ApiSuccess<CoApplicantDocumentUploadResponse>;
  } catch (error: any) {
    return handleApiError(error);
  }
}

/**
 * Endpoint 6: Get Detailed Application Info
 * GET /api/lead-collection/applications/{application_id}/detailed-info/
 */
export interface ParticipantPersonalInfo {
  full_name?: {
    value: string;
    verified: boolean;
  };
  date_of_birth?: {
    value: string;
    verified: boolean;
  };
  mobile_number?: {
    value: string;
    verified: boolean;
  };
  pan_number?: {
    value: string;
    verified: boolean;
  };
  email?: string | null;
  gender?: string;
  marital_status?: string | null;
}

export interface ParticipantAddress {
  address_line_1: string;
  address_line_2?: string;
  address_line_3?: string;
  address_type: string;
  city: string;
  city_code?: string;
  is_primary: boolean;
  landmark?: string;
  latitude?: string;
  longitude?: string;
  pincode: string;
  state: string;
  state_code?: string;
}

export interface Participant {
  participant_type: 'primary_participant' | 'co-applicant';
  co_applicant_index?: number;
  personal_info?: ParticipantPersonalInfo;
  addresses?: ParticipantAddress[];
  employment_details?: any;
  bureau_result?: any;
}

export interface CollateralDetails {
  application_id: string;
  collateral_type: string;
  ownership_type: string;
  estimated_property_value: string;
  collateral_description?: string;
  address?: {
    address_line_1: string;
    address_line_2?: string;
    address_line_3?: string;
    city: string;
    city_code?: string;
    landmark?: string;
    latitude?: string;
    longitude?: string;
    pincode: string;
    state: string;
    state_code?: string;
  };
  location?: {
    address_line_1: string;
    address_line_2?: string;
    address_line_3?: string;
    landmark?: string;
    latitude?: string;
    longitude?: string;
    pincode: string;
  };
  submitted_at?: string;
  submitted_by?: string;
}

export interface LoanDetails {
  application_id: string;
  loan_amount_requested: string;
  loan_purpose: string;
  loan_purpose_description?: string;
  product_code: string;
  interest_rate?: string;
  tenure_months?: number;
  sourcing_channel: string;
  submitted_at?: string;
  submitted_by?: string;
}

export interface PaymentResult {
  amount: number;
  created_on: string;
  masked_customer_mobile: string;
  order_id: string;
  paid_on?: string;
  state: 'completed' | 'pending' | 'failed' | 'cancelled';
}

export interface ApplicationDetails {
  application_id: string;
  collateral_details?: CollateralDetails;
  loan_details?: LoanDetails;
  participants?: Participant[];
  payment_result?: PaymentResult;
}

export interface DetailedInfoResponse {
  success: boolean;
  application_details: ApplicationDetails;
  // Legacy fields for backward compatibility
  application_id?: string;
  workflow_id?: string;
  workflow_status?: string;
  current_step?: string;
  error_message?: string;
  completed_steps?: Record<string, any>;
  new_lead_data?: any;
  personal_info?: any;
  address_info?: any;
  employment_info?: any;
  co_applicant_info?: any;
  collateral_info?: any;
  loan_details?: any;
  participants?: any[];
  co_applicant_workflows?: any[];
  workflow_state?: any;
}

export async function getDetailedInfo(application_id: string): Promise<ApiResponse<DetailedInfoResponse>> {
  return apiFetch<DetailedInfoResponse>(`applications/${application_id}/detailed-info/`, {
    method: 'GET',
  });
}

/**
 * Endpoint: Applications Summary
 * GET /api/lead-collection/applications/summary/
 */
export async function fetchApplicationsSummary(): Promise<ApiResponse<ApplicationsSummaryResponse>> {
  return apiFetch<ApplicationsSummaryResponse>('applications/summary/', {
    method: 'GET',
  });
}

/**
 * Endpoint: Get Co-Applicant Management
 * GET /api/lead-collection/applications/co-applicant-management/?application_id={application_id}
 */
export interface CoApplicantManagementItem {
  co_applicant_index: number;
  customer_name: string;
  mobile_number: string;
  relationship_to_primary: string;
  workflow_status: string;
  completed_steps: Record<string, any>;
  is_completed: boolean;
  can_edit: boolean;
  can_delete: boolean;
  participant_id: number;
  has_customer: boolean;
}

export interface CoApplicantManagementResponse {
  success: boolean;
  application_id: string;
  co_applicants: CoApplicantManagementItem[];
  can_add_more: boolean;
  can_proceed_to_next_step: boolean;
}

export async function getCoApplicantManagement(
  application_id: string
): Promise<ApiResponse<CoApplicantManagementResponse>> {
  return apiFetch<CoApplicantManagementResponse>(
    `applications/co-applicant-management/?application_id=${encodeURIComponent(application_id)}`,
    {
      method: 'GET',
    }
  );
}


/**
 * Payment Waiver Request
 */
export interface PaymentWaiverRequest {
  application_id: string;
  applicant_name: string;
  comment: string;
  system_value: string;
  branch_code: string;
  state_code: string;
}

export interface PaymentWaiverResponse {
  deviation_id: number;
  status: 'pending' | 'approved' | 'rejected';
}

export async function requestPaymentWaiver(
  data: PaymentWaiverRequest
): Promise<ApiResponse<PaymentWaiverResponse>> {
  return apiFetch<PaymentWaiverResponse>(
    'applications/payment-waiver/',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

export interface DocumentStatus {
  required: boolean;
  uploaded: boolean;
}

export interface RequiredDocumentsResponse {
  success: boolean;
  application_id: string;
  required_documents: Record<string, DocumentStatus>;
}

export interface CoApplicantRequiredDocumentsResponse {
  success: boolean;
  application_id: string;
  co_applicant_index: number;
  required_documents: Record<string, DocumentStatus>;
}

export async function getRequiredDocuments(applicationId: string): Promise<ApiResponse<RequiredDocumentsResponse>> {
  return apiFetch<RequiredDocumentsResponse>(`applications/${applicationId}/required-documents/`, {
    method: 'GET',
  });
}

export async function getCoApplicantRequiredDocuments(applicationId: string, index: number): Promise<ApiResponse<CoApplicantRequiredDocumentsResponse>> {
  return apiFetch<CoApplicantRequiredDocumentsResponse>(`applications/${applicationId}/co-applicant-required-documents/${index}/`, {
    method: 'GET',
  });
}

/**
 * Trigger Bureau Check
 * POST /api/lead-collection/applications/{application_id}/bureau-check/
 */
export interface BureauCheckRequest {
  application_id: string;
  agency?: string; // Default 'CRIF'
}

export interface BureauCheckResponse {
  success: boolean;
  message: string;
  application_id: string;
  data: any;
}

export async function triggerBureauCheck(
  data: BureauCheckRequest
): Promise<ApiResponse<BureauCheckResponse>> {
  return apiFetch<BureauCheckResponse>(
    `applications/${data.application_id}/bureau-check/`,
    {
      method: 'POST',
      body: JSON.stringify({ agency: data.agency || 'CRIF' }),
    }
  );
}

/**
 * Trigger BRE (Business Rule Engine)
 * GET /api/bre/trigger/?application_number={application_id}
 */
export interface BreQuestion {
  id: number;
  question_text: string;
  rule_id: string;
  status: string;
  created_at: string;
}

export interface BreTriggerResponse {
  success: boolean;
  data: string[]; // Array of question strings
  count: number;
  message: string;
  saved_questions: BreQuestion[];
}

export async function triggerBre(applicationId: string): Promise<ApiResponse<BreTriggerResponse>> {
  return apiFetch<BreTriggerResponse>(`bre/trigger/?application_number=${encodeURIComponent(applicationId)}`, {
    method: 'GET',
  });
}

// Account Aggregator APIs

export interface AccountAggregatorResponse {
  success: boolean;
  message?: string;
  application_id: string;
  next_step?: string;
  data?: any;
  aa_workflow_id?: string;
  status?: string;
  info?: any;
}

// Applicant
export async function initiateAccountAggregator(applicationId: string): Promise<ApiResponse<AccountAggregatorResponse>> {
  return apiFetch<AccountAggregatorResponse>(`applications/${applicationId}/account-aggregator/`, {
    method: 'POST',
  });
}

export async function resendAccountAggregatorConsent(applicationId: string): Promise<ApiResponse<AccountAggregatorResponse>> {
  return apiFetch<AccountAggregatorResponse>(`applications/${applicationId}/account-aggregator/resend-consent/`, {
    method: 'POST',
  });
}

export async function getAccountAggregatorStatus(applicationId: string): Promise<ApiResponse<AccountAggregatorResponse>> {
  return apiFetch<AccountAggregatorResponse>(`applications/${applicationId}/account-aggregator/`, {
    method: 'GET',
  });
}

// Co-Applicant
export async function initiateCoApplicantAccountAggregator(applicationId: string, index: number): Promise<ApiResponse<AccountAggregatorResponse>> {
  return apiFetch<AccountAggregatorResponse>(`applications/${applicationId}/co-applicant-account-aggregator/${index}/`, {
    method: 'POST',
  });
}

export async function resendCoApplicantAccountAggregatorConsent(applicationId: string, index: number): Promise<ApiResponse<AccountAggregatorResponse>> {
  return apiFetch<AccountAggregatorResponse>(`applications/${applicationId}/co-applicant-account-aggregator/${index}/resend-consent/`, {
    method: 'POST',
  });
}

export async function getCoApplicantAccountAggregatorStatus(applicationId: string, index: number): Promise<ApiResponse<AccountAggregatorResponse>> {
  return apiFetch<AccountAggregatorResponse>(`applications/${applicationId}/co-applicant-account-aggregator/${index}/`, {
    method: 'GET',
  });
}
