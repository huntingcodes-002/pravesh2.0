'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressBar from '@/components/ProgressBar';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function Step10Page() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  const { toast } = useToast();

  // Total steps updated to 11
  const totalSteps = 10;

  const handleNext = () => {
    if (!currentLead) return;

    // Proceed to next step
    updateLead(currentLead.id, {
      currentStep: 11
    });
    router.push('/lead/step11');
  };

  const handlePrevious = () => {
    router.push('/lead/step9');
  };

  return (
    <DashboardLayout
      title="Evaluation & Assessment"
      showNotifications={false}
      showExitButton={true}
      onExit={() => {
        if (!currentLead) { router.push('/leads'); return; }
        updateLead(currentLead.id, { currentStep: 10 });
        router.push('/leads');
      }}
    >
      <div className="max-w-2xl mx-auto mb-20">
        <ProgressBar currentStep={9} totalSteps={totalSteps} />

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6 mb-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Credit & Risk Evaluation</h2>

            {/* Application Summary Card - Mimics HTML structure */}
            <Card className="mb-6">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 border-b pb-2">Application Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Customer:</span>
                    <p className="font-medium text-gray-900">{currentLead?.customerName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Loan Amount:</span>
                    <p className="font-medium text-gray-900">₹{currentLead?.loanAmount?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Employment:</span>
                    <p className="font-medium text-gray-900">{currentLead?.formData?.step5?.occupationType || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Credit Assessment / Risk Info Section */}
            <div className="space-y-6">
              {/* Credit Assessment Cards */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Credit Assessment</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-blue-700 font-medium mb-1">Credit Score</p>
                      <p className="text-3xl font-bold text-blue-900">720</p>
                      <p className="text-xs text-blue-600 mt-1">Good</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-green-700 font-medium mb-1">Total Exposure</p>
                      <p className="text-3xl font-bold text-green-900">₹8.5L</p>
                      <p className="text-xs text-green-600 mt-1">Within Limits</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Risk Factors List */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Risk Assessment</h3>
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">High EMI Bounces</span>
                        <Badge className="bg-red-100 text-red-700">High Risk</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Multiple Inquiries</span>
                        <Badge className="bg-yellow-100 text-yellow-700">Medium Risk</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Stable Employment</span>
                        <Badge className="bg-green-100 text-green-700">Low Risk</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700">DPD Status:</span>
                        <span className="font-medium text-orange-600">30+ DPD (Mock)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Debt-to-Income Ratio</span>
                        <Badge className="bg-red-100 text-red-700">High Risk</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
            <div className="flex gap-3 max-w-2xl mx-auto">
                <Button onClick={handlePrevious} variant="outline" className="flex-1 h-12 rounded-lg">
                  Previous
                </Button>
                <Button onClick={handleNext} className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]">
                  Next
                </Button>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
