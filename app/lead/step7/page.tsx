'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressBar from '@/components/ProgressBar';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { cn } from '@/lib/utils';


export default function Step7Page() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  
  // Total steps updated to 11
  const totalSteps = 10;
  
  const [formData, setFormData] = useState({
    loanAmount: currentLead?.loanAmount || 0,
    loanPurpose: currentLead?.loanPurpose || '',
    customPurpose: currentLead?.formData?.step7?.customPurpose || '', // Added Custom Purpose
    purposeDescription: currentLead?.formData?.step7?.purposeDescription || '', // Added Description
    productCode: currentLead?.formData?.step7?.productCode || '',
    schemeCode: currentLead?.formData?.step7?.schemeCode || '', // Added Scheme Code
    interestRate: currentLead?.formData?.step7?.interestRate || '',
    tenure: currentLead?.formData?.step7?.tenure || '',
    tenureUnit: 'months', // Fixed to months
    applicationType: currentLead?.formData?.step7?.applicationType || 'new', // Overwritten by step 1 in real app, kept for form structure
    loanBranch: currentLead?.formData?.step7?.loanBranch || 'BR001', // Added Loan Branch
    assignedOfficer: currentLead?.formData?.step7?.assignedOfficer || '', // Added Assigned Officer
    sourcingChannel: currentLead?.formData?.step7?.sourcingChannel || 'direct', // Added Sourcing Channel
    sourcingBranch: currentLead?.formData?.step7?.sourcingBranch || '', // Added Sourcing Branch (Conditional)
  });

  useEffect(() => {
    if (currentLead?.formData?.step7) {
      setFormData(currentLead.formData.step7);
    }
  }, [currentLead]);
  
  const setField = (key: string, value: string | number | string[]) => setFormData(prev => ({ ...prev, [key]: value }));

  // Helper function to format number with Indian comma system
  const formatNumberWithCommas = (value: number): string => {
    if (isNaN(value) || value === 0) return '0';
    
    // Convert to string and add commas using Indian numbering system
    const numStr = Math.floor(value).toString();
    const lastThree = numStr.slice(-3);
    const otherNums = numStr.slice(0, -3);
    
    if (otherNums.length === 0) return lastThree;
    
    // Add commas every 2 digits from right (Indian system)
    const formatted = otherNums.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    return formatted;
  };

  // Helper function to parse formatted number back to number
  const parseFormattedNumber = (formattedValue: string): number => {
    const numericValue = formattedValue.replace(/,/g, '');
    return parseInt(numericValue) || 0;
  };

  // Helper function to handle loan amount input changes
  const handleLoanAmountChange = (value: string) => {
    // Remove any non-numeric characters except commas
    const cleanValue = value.replace(/[^0-9,]/g, '');
    
    // Parse the value
    const numericValue = parseFormattedNumber(cleanValue);
    
    // Always update the value, validation happens on canProceed
    setField('loanAmount', numericValue);
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${(value / 1000).toFixed(0)}K`;
  };

  const handleNext = () => {
    if (!currentLead) return;

    updateLead(currentLead.id, {
      formData: {
        ...currentLead.formData,
        step7: formData
      },
      loanAmount: formData.loanAmount,
      loanPurpose: formData.loanPurpose,
      currentStep: 8
    });
    router.push('/lead/documents');
  };

  const handleExit = () => {
    if (!currentLead) {
        router.push('/leads');
        return;
    }
    updateLead(currentLead.id, {
      formData: {
        ...currentLead.formData,
        step7: formData
      },
      currentStep: 7
    });
    router.push('/leads');
  };


  const handlePrevious = () => {
    router.push('/lead/step6');
  };

  const canProceed = formData.loanAmount > 0 && formData.loanPurpose && formData.sourcingChannel && formData.interestRate && formData.tenure;

  return (
    <DashboardLayout 
        title="Loan Details & Requirements" 
        showNotifications={false}
        showExitButton={true} 
        onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24">
        <ProgressBar currentStep={6} totalSteps={totalSteps} />

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Loan Information</h2>

            <div className="space-y-6">
              
              {/* 1. Loan Amount Requested */}
              <div>
                <Label>Loan Amount Requested <span className="text-red-500">*</span></Label>
                  <div className="mt-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">₹</span>
                    <Input
                      id="loanAmount"
                      type="text"
                      value={formData.loanAmount > 0 ? formatNumberWithCommas(formData.loanAmount) : ''}
                      onChange={(e) => handleLoanAmountChange(e.target.value)}
                      placeholder="Enter loan amount (e.g., 1,00,000)"
                      className="h-12 pl-8"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span className="text-sm font-bold text-blue-600">{formData.loanAmount > 0 ? formatCurrency(formData.loanAmount) : ''}</span>
                  </div>
                </div>
              </div>

              {/* 2. Loan Purpose */}
              <div>
                <Label htmlFor="loanPurpose">Loan Purpose <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.loanPurpose}
                  onValueChange={(value: string) => setField('loanPurpose', value)}
                >
                  <SelectTrigger id="loanPurpose" className="h-12">
                    <SelectValue placeholder="Select Loan Purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business-expansion">Business Expansion</SelectItem>
                    <SelectItem value="working-capital">Working Capital</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Loan Purpose Description */}
              <div>
                <Label htmlFor="purposeDescription">Loan Purpose Description</Label>
                <Textarea
                  id="purposeDescription"
                  value={formData.purposeDescription}
                  onChange={(e) => setField('purposeDescription', e.target.value)}
                  placeholder="Optional description (max 100 characters)"
                  className="min-h-[80px]"
                  maxLength={100}
                />
                <div className="text-xs text-gray-500 mt-1">
                    {formData.purposeDescription.length}/100 characters
                </div>
              </div>

              {/* 4. Product Code */}
              <div>
                <Label htmlFor="productCode" className="text-sm font-medium text-[#003366] mb-2 block">Product Code</Label>
                <div className="flex items-center px-4 h-12 bg-[#F3F4F6] border border-gray-300 rounded-lg">
                  <span className="text-[#003366] font-medium">Business Loan</span>
                </div>
              </div>

              {/* 5. Interest Rate & Tenure Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Interest Rate */}
                <div>
                  <Label htmlFor="interestRate">Interest Rate (%) <span className="text-red-500">*</span></Label>
                  <Input
                    id="interestRate"
                    type="number"
                    value={formData.interestRate}
                    onChange={(e) => setField('interestRate', e.target.value)}
                    placeholder="12.5"
                    className="h-12"
                    step="0.1" min="0" max="50"
                  />
                </div>

                {/* Tenure */}
                <div>
                  <Label htmlFor="tenure">Tenure (Months) <span className="text-red-500">*</span></Label>
                  <Input
                    id="tenure"
                    type="number"
                    value={formData.tenure}
                    onChange={(e) => setField('tenure', e.target.value)}
                    placeholder="24"
                    className="h-12"
                    min="1" max="999"
                  />
                </div>
              </div>


              {/* 6. Sourcing Channel */}
              <div>
                <Label htmlFor="sourcingChannel">Sourcing Channel <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.sourcingChannel}
                  onValueChange={(value: string) => setField('sourcingChannel', value)}
                >
                  <SelectTrigger id="sourcingChannel" className="h-12">
                    <SelectValue placeholder="Select Sourcing Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>


        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
            <div className="flex gap-3 max-w-2xl mx-auto">
                <Button onClick={handlePrevious} variant="outline" className="flex-1 h-12 rounded-lg">
                  Previous
                </Button>
                <Button onClick={handleNext} disabled={!canProceed} className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]">
                  Next
                </Button>
            </div>
        </div>

        </div>
      </div>
    </DashboardLayout>
  );
}