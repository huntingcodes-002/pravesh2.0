'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requestLoginOTP, verifyOTP, isApiError, type ApiSuccess } from '@/lib/api';

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
  login: (email: string) => Promise<boolean>;
  verifyOtpAndSignIn: (email: string, otp: string) => Promise<boolean>;
  logout: () => void;
  pendingAuth: { email: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'user';
const AUTH_STORAGE_KEY = 'auth';
const PENDING_AUTH_KEY = 'pendingAuth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingAuth, setPendingAuth] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 1. Check for authenticated user and tokens
    if (typeof window !== 'undefined') {
      const storedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
      const storedUser = sessionStorage.getItem(USER_STORAGE_KEY);
      
      if (storedAuth && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          // Invalid data, clear it
          sessionStorage.removeItem(AUTH_STORAGE_KEY);
          sessionStorage.removeItem(USER_STORAGE_KEY);
        }
      }
      
      // 2. Check for pending authentication (waiting for OTP)
      const storedPendingAuth = sessionStorage.getItem(PENDING_AUTH_KEY);
      if (storedPendingAuth) {
        try {
          setPendingAuth(JSON.parse(storedPendingAuth));
        } catch {
          sessionStorage.removeItem(PENDING_AUTH_KEY);
        }
      }
    }

    setLoading(false);
  }, []);

  const login = async (email: string): Promise<boolean> => {
    try {
      const response = await requestLoginOTP({ email });

      if (isApiError(response)) {
        return false;
      }

      // Store pending auth with email
      const authData = { email };
      setPendingAuth(authData);
      sessionStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(authData));
      
      return true;
    } catch (error) {
      return false;
    }
  };

  const verifyOtpAndSignIn = async (email: string, otp: string): Promise<boolean> => {
    try {
      const response = await verifyOTP({ email, otp });

      if (isApiError(response)) {
        return false;
      }

      // Backend response structure: { success: true, access_token, refresh_token, user_info, ... }
      // All fields are at top level, not wrapped in data
      const successResponse = response as ApiSuccess<VerifyOTPResponse>;

      // Store tokens and user info in sessionStorage
      const authData = {
        access_token: successResponse.access_token,
        refresh_token: successResponse.refresh_token,
        token_type: successResponse.token_type,
        expires_in: successResponse.expires_in,
      };

      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      
      // Extract user_info from response (fields are at top level)
      if (successResponse.user_info) {
        setUser(successResponse.user_info);
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(successResponse.user_info));
      }

      // Clear pending auth
      sessionStorage.removeItem(PENDING_AUTH_KEY);
      setPendingAuth(null);
      
      return true;
    } catch (error) {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(PENDING_AUTH_KEY);
    setPendingAuth(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyOtpAndSignIn, logout, pendingAuth }}>
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
