'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressBar from '@/components/ProgressBar';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Step6Page() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  const [formData, setFormData] = useState({
    collateralType: currentLead?.formData?.step6?.collateralType || '',
    collateralSubType: currentLead?.formData?.step6?.collateralSubType || '',
    ownershipType: currentLead?.formData?.step6?.ownershipType || '',
    currency: 'INR',
    propertyValue: currentLead?.formData?.step6?.propertyValue || '',
    description: currentLead?.formData?.step6?.description || '',
    location: currentLead?.formData?.step6?.location || ''
  });

  useEffect(() => {
    if (currentLead?.formData?.step6) {
      setFormData(currentLead.formData.step6);
    }
  }, [currentLead]);

  const setField = (key: string, value: string | number) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleNext = () => {
    if (!currentLead) return;

    updateLead(currentLead.id, {
      formData: {
        ...currentLead.formData,
        step6: formData
      },
      currentStep: 7
    });
    router.push('/lead/step7');
  };
  
  const handleExit = () => {
    if (!currentLead) {
        router.push('/leads');
        return;
    }
    // Save current data as draft before exiting
    updateLead(currentLead.id, {
      formData: {
        ...currentLead.formData,
        step6: formData
      },
      currentStep: 6
    });
    router.push('/leads');
  };

  const handlePrevious = () => {
    router.push('/lead/step5');
  };

  const canProceed = formData.collateralType && 
    (formData.collateralType === 'property' ? formData.collateralSubType : true) && 
    formData.ownershipType && 
    formData.propertyValue;

  return (
    <DashboardLayout 
        title="Collateral Details" 
        showNotifications={false}
        showExitButton={true} 
        onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto mb-20">
        <ProgressBar currentStep={5} totalSteps={10} />

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Collateral Information</h2>

            <div className="space-y-4">
              
              {/* 1. Collateral Type */}
              <div>
                <Label htmlFor="collateralType">
                  Collateral Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.collateralType}
                  onValueChange={(value:string) => {
                    setFormData({...formData, collateralType: value, collateralSubType: ''});
                  }}
                >
                  <SelectTrigger id="collateralType" className="h-12">
                    <SelectValue placeholder="Select collateral type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="property">Property</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Collateral Sub Type - Only show when Property is selected */}
              {formData.collateralType === 'property' && (
                <div>
                  <Label htmlFor="collateralSubType">
                    Collateral Sub Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.collateralSubType}
                    onValueChange={(value:string) => setField('collateralSubType', value)}
                  >
                    <SelectTrigger id="collateralSubType" className="h-12">
                      <SelectValue placeholder="Select collateral sub type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="builder-property-under-construction">Builder Property Under Construction</SelectItem>
                      <SelectItem value="construction-on-land">Construction On Land</SelectItem>
                      <SelectItem value="plot-self-construction">Plot + Self Construction</SelectItem>
                      <SelectItem value="purchase-plot">Purchase a Plot</SelectItem>
                      <SelectItem value="ready-property">Ready Property</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 2. Ownership Type */}
              <div>
                <Label htmlFor="ownershipType">
                  Ownership Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.ownershipType}
                  onValueChange={(value:string) => setField('ownershipType', value)}
                >
                  <SelectTrigger id="ownershipType" className="h-12">
                    <SelectValue placeholder="Select ownership type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="selfOwnership">Self Ownership</SelectItem>
                    <SelectItem value="jointOwnership">Joint Ownership</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Estimated Property Value (INR only) */}
              <div>
                <Label htmlFor="propertyValue">
                  Estimated Property Value (INR) <span className="text-red-500">*</span>
                </Label>
                <div className="flex">
                  <div className="flex items-center px-4 h-12 bg-[#F3F4F6] border border-r-0 border-gray-300 rounded-l-lg">
                    <span className="text-[#003366] font-sm">₹INR</span>
                  </div>
                  <Input
                    id="propertyValue"
                    type="text"
                    value={formData.propertyValue ? (() => {
                      const numStr = formData.propertyValue.toString();
                      const lastThree = numStr.slice(-3);
                      const otherNums = numStr.slice(0, -3);
                      if (otherNums.length === 0) return lastThree;
                      return otherNums.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
                    })() : ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setField('propertyValue', value);
                    }}
                    placeholder="Enter estimated value"
                    className="h-12 rounded-l-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Enter value between ₹1,00,000 to ₹99,99,99,999</p>
              </div>

              {/* 4. Collateral Description */}
              <div>
                <Label htmlFor="description">Collateral Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Enter detailed description of the collateral"
                  className="min-h-[100px]"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: Provide additional details about the collateral</p>
              </div>

              {/* 5. Location (Changed from Textarea to Input) */}
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setField('location', e.target.value)}
                  placeholder="Enter collateral location"
                  className="h-12"
                />
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