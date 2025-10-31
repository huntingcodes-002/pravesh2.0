'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLead } from '@/contexts/LeadContext';

export default function LeadFlowPage() {
  const { currentLead } = useLead();
  const router = useRouter();
  useEffect(() => {
    if (!currentLead) {
      router.replace('/leads');
      return;
    }

    // Redirect to the current step
    const currentStep = currentLead.currentStep || 1;
    router.replace(`/lead/step${currentStep}`);
  }, [currentLead, router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Redirecting to current step...</p>
    </div>
  );
}
