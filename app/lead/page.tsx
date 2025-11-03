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
    
    // Step 1 should go to new-lead page
    if (currentStep === 1) {
      router.replace('/lead/new-lead');
    } else if (currentStep >= 2) {
      // Step 2 and above should go to new-lead-info page
      router.replace('/lead/new-lead-info');
    }
  }, [currentLead, router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Redirecting to current step...</p>
    </div>
  );
}
