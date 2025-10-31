'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect authenticated users to the Home Dashboard
        router.replace('/dashboard');
      } else {
        // Redirect unauthenticated users to the Login page
        router.push('/login');
      }
    }
  }, [router, user, loading]);

  return null;
}
