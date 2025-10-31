'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function LoanRequirementPage() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    loanAmount: currentLead?.loanAmount || 0,
    loanPurpose: currentLead?.loanPurpose || '',
    customPurpose: currentLead?.formData?.step7?.customPurpose || '',
    purposeDescription: currentLead?.formData?.step7?.purposeDescription || '',
    productCode: currentLead?.formData?.step7?.productCode || '',
    schemeCode: currentLead?.formData?.step7?.schemeCode || '',
    interestRate: currentLead?.formData?.step7?.interestRate || '',
    tenure: currentLead?.formData?.step7?.tenure || '',
    tenureUnit: 'months',
    applicationType: currentLead?.formData?.step7?.applicationType || 'new',
    loanBranch: currentLead?.formData?.step7?.loanBranch || 'BR001',
    assignedOfficer: currentLead?.formData?.step7?.assignedOfficer || '',
    sourcingChannel: currentLead?.formData?.step7?.sourcingChannel || 'direct',
    sourcingBranch: currentLead?.formData?.step7?.sourcingBranch || '',
  });

  useEffect(() => {
    if (currentLead?.formData?.step7) {
      setFormData(currentLead.formData.step7);
    }
  }, [currentLead]);

  const setField = (key: string, value: string | number | string[]) => setFormData(prev => ({ ...prev, [key]: value }));

  const formatNumberWithCommas = (value: number): string => {
    if (isNaN(value) || value === 0) return '0';
    const numStr = Math.floor(value).toString();
    const lastThree = numStr.slice(-3);
    const otherNums = numStr.slice(0, -3);
    if (otherNums.length === 0) return lastThree;
    const formatted = otherNums.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    return formatted;
  };

  const parseFormattedNumber = (formattedValue: string): number => {
    const numericValue = formattedValue.replace(/,/g, '');
    return parseInt(numericValue) || 0;
  };

  const handleLoanAmountChange = (value: string) => {
    const cleanValue = value.replace(/[^0-9,]/g, '');
    const numericValue = parseFormattedNumber(cleanValue);
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

  const handleSave = () => {
    if (!currentLead) return;

    updateLead(currentLead.id, {
      formData: {
        ...currentLead.formData,
        step7: formData
      },
      loanAmount: formData.loanAmount,
      loanPurpose: formData.loanPurpose,
    });

    toast({
      title: 'Information Saved',
      description: 'Loan requirement details have been saved successfully.',
      className: 'bg-green-50 border-green-200'
    });

    router.push('/lead/new-lead-info');
  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };

  if (!currentLead) {
    return null;
  }

  return (
    <DashboardLayout
      title="Loan Details & Requirements"
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Loan Information</h2>

            <div className="space-y-6">
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

              <div>
                <Label htmlFor="productCode" className="text-sm font-medium text-[#003366] mb-2 block">Product Code</Label>
                <div className="flex items-center px-4 h-12 bg-[#F3F4F6] border border-gray-300 rounded-lg">
                  <span className="text-[#003366] font-medium">Business Loan</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              onClick={handleSave}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white"
            >
              Save Information
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
