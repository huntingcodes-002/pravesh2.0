'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MOCK_USER, validateOTP } from '@/lib/mock-auth';

interface User {
  id: string;
  email: string;
  name: string;
  rmId: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  verifyOtpAndSignIn: (otp: string) => Promise<boolean>;
  logout: () => void;
  pendingAuth: { email: string; user: User } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'user';
const PENDING_AUTH_KEY = 'pendingAuth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingAuth, setPendingAuth] = useState<{ email: string; user: User } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 1. Check for authenticated user
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    
    // 2. Check for pending authentication (waiting for OTP)
    const storedPendingAuth = sessionStorage.getItem(PENDING_AUTH_KEY);
    if (storedPendingAuth) {
        setPendingAuth(JSON.parse(storedPendingAuth));
    }

    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Check credentials, but DO NOT sign in yet. Prepare user object for OTP.
    if (email === MOCK_USER.email && password === MOCK_USER.password) {
      const userData: User = {
        id: '1',
        email: MOCK_USER.email,
        name: MOCK_USER.name,
        rmId: MOCK_USER.rmId,
        phone: MOCK_USER.phone
      };

      const authData = { email: email, user: userData };
      setPendingAuth(authData);
      sessionStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(authData));
      
      // Successfully authenticated credentials, now proceed to OTP step
      return true; 
    }
    return false;
  };

  const verifyOtpAndSignIn = async (otp: string): Promise<boolean> => {
    if (!pendingAuth) {
        return false;
    }

    // Logic: Validate OTP using mock-auth
    if (validateOTP(otp)) {
        // Final sign-in step: clear pending state and set user
        setUser(pendingAuth.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(pendingAuth.user));
        sessionStorage.removeItem(PENDING_AUTH_KEY);
        setPendingAuth(null);
        return true;
    }
    
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem(PENDING_AUTH_KEY);
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
