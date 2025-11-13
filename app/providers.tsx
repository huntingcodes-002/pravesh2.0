'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { LeadProvider } from '@/contexts/LeadContext';
import { Toaster } from '@/components/ui/toaster';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LeadProvider>
        {children}
        <Toaster />
      </LeadProvider>
    </AuthProvider>
  );
}