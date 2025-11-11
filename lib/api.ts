/**
 * API utility functions for backend integration
 */

const API_BASE_URL = 'https://uatlb.api.saarathifinance.com/api/lead-collection/';

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
 * Helper function to get access token from sessionStorage
 */
function getAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    const authData = sessionStorage.getItem('auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        return parsed.access_token || null;
      } catch {
        return null;
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
    // Get access token if available
    const accessToken = getAccessToken();
    
    // Build fetch options ensuring method from options takes precedence
    const fetchOptions: RequestInit = {
      ...options, // Spread options first (includes method if specified)
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        ...options.headers, // Allow custom headers to override
      },
    };

    // If no method specified, default to GET (but POST should be specified in options)
    if (!fetchOptions.method) {
      fetchOptions.method = 'GET';
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

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
 * Base fetch function for multipart/form-data (file uploads)
 */
async function apiFetchFormData<T = any>(
  endpoint: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  try {
    // Get access token if available
    const accessToken = getAccessToken();
    
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
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

// ============================================================================
// Authentication API Endpoints
// ============================================================================

/**
 * Authentication: Request Login OTP
 * POST /api/lead-collection/auth/login/
 */
export interface LoginRequest {
  email: string;
}

export interface LoginResponse {
  success: true;
  message: string;
  email_masked: string;
  expires_in_minutes: number;
}

export async function requestLoginOTP(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  return apiFetch<LoginResponse>('auth/login/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Authentication: Verify OTP
 * POST /api/lead-collection/auth/verify-otp/
 */
export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

export interface VerifyOTPResponse {
  success: true;
  message: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user_info: {
    user_id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    employee_code: string;
    designation: string | null;
    branch: {
      id: number;
      name: string;
      code: string;
    } | null;
    state: {
      id: number;
      name: string;
    } | null;
  };
}

export async function verifyOTP(data: VerifyOTPRequest): Promise<ApiResponse<VerifyOTPResponse>> {
  return apiFetch<VerifyOTPResponse>('auth/verify-otp/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// API Endpoint Functions
// ============================================================================

/**
 * Endpoint 1: Create New Lead
 * POST /api/lead-collection/applications/new-lead/
 */
export interface NewLeadRequest {
  product_type: 'secured' | 'unsecured';
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
  document_type: 'pan_card' | 'aadhaar_card' | 'driving_license' | 'passport' | 'voter_id' | 'collateral_documents' | 'bank_statement' | 'salary_slip' | 'itr' | 'other';
  front_file: File;
  back_file?: File;
  document_name?: string;
  metadata?: Record<string, any>;
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
    formData.append('metadata', JSON.stringify(data.metadata));
  }

  return apiFetchFormData<DocumentUploadResponse>('applications/document-upload/', formData);
}

/**
 * Endpoint 6: Get Detailed Application Info
 * GET /api/lead-collection/applications/{application_id}/detailed-info/
 */
export interface DetailedInfoResponse {
  application_id: string;
  workflow_id: string;
  workflow_status: string;
  current_step?: string;
  error_message?: string;
  completed_steps: Record<string, any>;
  new_lead_data?: any;
  personal_info?: {
    pan_number?: string;
    date_of_birth?: string;
    gender?: string;
    name?: string;
    // Parsed data from PAN document
    parsed_pan_data?: {
      pan_number?: string;
      date_of_birth?: string;
      name?: string;
      father_name?: string;
      gender?: string;
    };
    // OCR result structure from backend
    ocr_result?: {
      ocr_data?: {
        result?: {
          card_number?: string;
          date_of_birth?: string;
          name_on_card?: string;
          father_name?: string;
          card_type?: string;
          type_of_date?: string;
          front_image_status?: boolean;
          back_image_status?: boolean;
        };
      };
      success?: boolean;
    };
  };
  address_info?: {
    addresses?: Array<{
      address_type?: string;
      address_line_1?: string;
      address_line_2?: string;
      address_line_3?: string;
      city?: string;
      state?: string;
      pincode?: string;
      landmark?: string;
    }>;
    // Parsed data from Aadhaar document
    parsed_aadhaar_data?: {
      address_line_1?: string;
      address_line_2?: string;
      address_line_3?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
  };
  employment_info?: any;
  co_applicant_info?: any;
  collateral_info?: any;
  loan_details?: any;
  participants?: any[];
  co_applicant_workflows?: any[];
  workflow_state?: {
    pan_ocr_data?: {
      extracted_fields?: {
        pan_number?: string;
        date_of_birth?: string; // DD/MM/YYYY format
        name_on_card?: string;
        father_name?: string;
      };
      ocr_result?: any;
      ocr_success?: boolean;
      status?: string;
    };
    aadhaar_ocr_data?: any;
    aadhaar_extracted_address?: any;
    [key: string]: any;
  };
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

