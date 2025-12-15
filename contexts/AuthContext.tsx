'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loginPravesh, verifyPraveshOTP, resendPraveshOTP, getUserProfile, logoutUser, isApiError, type ApiSuccess, type VerifyOTPResponseData, type LoginPraveshResponse, type UserProfileResponse } from '@/lib/api';

interface User {
  user_id: number;
  email: string;
  username: string;
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
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  verifyOtpAndSignIn: (otp: string) => Promise<boolean>;
  resendOtp: () => Promise<boolean>;
  logout: () => void;
  pendingAuth: { email: string; verificationCode: string; maskedPhone: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'user';
const AUTH_STORAGE_KEY = 'auth';
const PENDING_AUTH_KEY = 'pendingAuth';

// Helper functions to save/load from localStorage
const saveToStorage = (key: string, value: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
    // Also save to sessionStorage for backward compatibility during transition
    sessionStorage.setItem(key, value);
  }
};

const getFromStorage = (key: string): string | null => {
  if (typeof window !== 'undefined') {
    // Check localStorage first
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;
    // Fallback to sessionStorage
    return sessionStorage.getItem(key);
  }
  return null;
};

const removeFromStorage = (key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingAuth, setPendingAuth] = useState<{ email: string; verificationCode: string; maskedPhone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 1. Check for authenticated user and tokens
    if (typeof window !== 'undefined') {
      const storedAuth = getFromStorage(AUTH_STORAGE_KEY);
      const storedUser = getFromStorage(USER_STORAGE_KEY);

      if (storedAuth && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          // Invalid data, clear it
          removeFromStorage(AUTH_STORAGE_KEY);
          removeFromStorage(USER_STORAGE_KEY);
        }
      }

      // 2. Check for pending authentication (waiting for OTP)
      const storedPendingAuth = getFromStorage(PENDING_AUTH_KEY);
      if (storedPendingAuth) {
        try {
          setPendingAuth(JSON.parse(storedPendingAuth));
        } catch {
          removeFromStorage(PENDING_AUTH_KEY);
        }
      }
    }

    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Clear any old tokens and auth data before starting new login
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem('auth');
        sessionStorage.removeItem('auth');
        // Don't clear user yet - wait until OTP is verified
      }

      const response = await loginPravesh({ username: email, password });

      if (isApiError(response)) {
        return false;
      }

      // Extract verification_code and masked_phone_number from response.data
      const successResponse = response as ApiSuccess<LoginPraveshResponse>;
      if (!successResponse.data) {
        return false;
      }

      const { verification_code, masked_phone_number } = successResponse.data;

      // Store pending auth with email, verificationCode, and maskedPhone
      const authData = {
        email,
        verificationCode: verification_code,
        maskedPhone: masked_phone_number
      };
      setPendingAuth(authData);
      saveToStorage(PENDING_AUTH_KEY, JSON.stringify(authData));

      return true;
    } catch (error) {
      return false;
    }
  };

  const verifyOtpAndSignIn = async (otp: string): Promise<boolean> => {
    try {
      // Retrieve verificationCode from pendingAuth state (or storage as fallback)
      let verificationCode: string | null = null;

      if (pendingAuth?.verificationCode) {
        verificationCode = pendingAuth.verificationCode;
      } else if (typeof window !== 'undefined') {
        const storedPendingAuth = getFromStorage(PENDING_AUTH_KEY);
        if (storedPendingAuth) {
          try {
            const parsed = JSON.parse(storedPendingAuth);
            verificationCode = parsed.verificationCode || null;
          } catch {
            // Invalid data
          }
        }
      }

      if (!verificationCode) {
        return false;
      }

      const response = await verifyPraveshOTP({ otp, verification_code: verificationCode });

      if (isApiError(response)) {
        return false;
      }

      // Backend response structure: { success: true, message, data: { access_token, refresh_token, ... } }
      // Tokens are in the data object
      const successResponse = response as ApiSuccess<VerifyOTPResponseData>;

      if (!successResponse.data) {
        return false;
      }

      // Clear any old tokens first to ensure fresh tokens are used
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem('auth');
        sessionStorage.removeItem('auth');
      }

      // Store new tokens in localStorage
      const authData = {
        access_token: successResponse.data.access_token,
        refresh_token: successResponse.data.refresh_token,
        token_type: successResponse.data.token_type,
        expires_in: successResponse.data.expires_in,
        id_token: successResponse.data.id_token,
      };

      saveToStorage(AUTH_STORAGE_KEY, JSON.stringify(authData));

      // Fetch user profile using the id token (handled by apiFetchAuth automatically via getAuthToken)
      // Wait a tiny bit to ensure token is saved to localStorage
      await new Promise(resolve => setTimeout(resolve, 10));

      try {
        const profileResponse = await getUserProfile();
        if (!isApiError(profileResponse) && profileResponse.data) {
          const profile = profileResponse.data;
          // Map API response to User interface
          // Convert UUID to a numeric ID (take first 8 hex chars and convert to number)
          const uuidToNumber = (uuid: string): number => {
            const hex = uuid.replace(/-/g, '').substring(0, 8);
            return parseInt(hex, 16) || 0;
          };

          const userData: User = {
            user_id: uuidToNumber(profile.id),
            email: profile.email,
            username: profile.username,
            first_name: profile.first_name,
            last_name: profile.last_name,
            employee_code: profile.employee_code,
            designation: null, // Not in profile response
            branch: profile.branch_code ? {
              id: 0,
              name: '',
              code: profile.branch_code,
            } : null,
            state: null, // Not in profile response
          };

          setUser(userData);
          saveToStorage(USER_STORAGE_KEY, JSON.stringify(userData));
        }
      } catch (error) {
        // If profile fetch fails, still proceed with auth (user can be set later)
        console.error('Failed to fetch user profile:', error);
      }

      // Clear pending auth
      removeFromStorage(PENDING_AUTH_KEY);
      setPendingAuth(null);

      return true;
    } catch (error) {
      return false;
    }
  };

  const resendOtp = async (): Promise<boolean> => {
    try {
      // Retrieve verificationCode from pendingAuth state (or storage as fallback)
      let verificationCode: string | null = null;
      let email: string | null = null;

      if (pendingAuth?.verificationCode) {
        verificationCode = pendingAuth.verificationCode;
        email = pendingAuth.email;
      } else if (typeof window !== 'undefined') {
        const storedPendingAuth = getFromStorage(PENDING_AUTH_KEY);
        if (storedPendingAuth) {
          try {
            const parsed = JSON.parse(storedPendingAuth);
            verificationCode = parsed.verificationCode || null;
            email = parsed.email || null;
          } catch {
            // Invalid data
          }
        }
      }

      if (!verificationCode) {
        return false;
      }

      const response = await resendPraveshOTP({ verification_code: verificationCode });

      if (isApiError(response)) {
        return false;
      }

      // If the response contains a new verification_code, update the pendingAuth state
      const successResponse = response as ApiSuccess<LoginPraveshResponse>;
      if (successResponse.data) {
        const { verification_code, masked_phone_number } = successResponse.data;

        // Update pendingAuth with new verification_code
        const authData = {
          email: email || '',
          verificationCode: verification_code,
          maskedPhone: masked_phone_number
        };
        setPendingAuth(authData);
        saveToStorage(PENDING_AUTH_KEY, JSON.stringify(authData));
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      // Ignore errors during logout
    }

    setUser(null);
    setPendingAuth(null);

    // Clear all auth-related storage from both localStorage and sessionStorage
    removeFromStorage(USER_STORAGE_KEY);
    removeFromStorage(AUTH_STORAGE_KEY);
    removeFromStorage(PENDING_AUTH_KEY);

    // Additional cleanup: explicitly clear all possible auth keys
    if (typeof window !== 'undefined') {
      // Clear from localStorage
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(PENDING_AUTH_KEY);
      // Clear from sessionStorage
      sessionStorage.removeItem(USER_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(PENDING_AUTH_KEY);
      // Clear any other possible auth-related keys
      localStorage.removeItem('auth');
      sessionStorage.removeItem('auth');
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
      localStorage.removeItem('pendingAuth');
      sessionStorage.removeItem('pendingAuth');
    }

    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyOtpAndSignIn, resendOtp, logout, pendingAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
