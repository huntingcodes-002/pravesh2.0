'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

export default function CollateralPage() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  const { toast } = useToast();
  
  const formatIndianNumber = (value: string | number): string => {
    if (value === '' || value === null || value === undefined) return '';
    const strValue = value.toString();
    if (!strValue) return '';
    const [integerPartRaw, decimalPart] = strValue.split('.');
    const integerPart = integerPartRaw.replace(/^0+(?!$)/, '');
    if (integerPart.length <= 3) {
      return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
    }
    const lastThree = integerPart.slice(-3);
    const otherNums = integerPart.slice(0, -3);
    const formatted =
      otherNums.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    return decimalPart ? `${formatted}.${decimalPart}` : formatted;
  };

  const [formData, setFormData] = useState({
    collateralType: currentLead?.formData?.step6?.collateralType || 'property',
    collateralSubType: currentLead?.formData?.step6?.collateralSubType || '',
    ownershipType: currentLead?.formData?.step6?.ownershipType || 'selfOwnership',
    currency: 'INR',
    propertyValue: currentLead?.formData?.step6?.propertyValue || '',
    description: currentLead?.formData?.step6?.description || '',
    location: currentLead?.formData?.step6?.location || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentLead?.formData?.step6) {
      setFormData({
        ...currentLead.formData.step6,
        collateralType: 'property',
        ownershipType: 'selfOwnership',
      });
    }
  }, [currentLead]);

  const setField = (key: string, value: string | number) => setFormData(prev => ({ ...prev, [key]: value }));

  const API_URL = 'https://uatlb.api.saarathifinance.com/api/lead-collection/applications/collateral-details/';
  const AUTH_TOKEN =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzYyOTM2OTAzLCJpYXQiOjE3NjI4NTA1MDMsImp0aSI6IjM5OTZiZDhhMDAxNzRiZjJhMTZkZWQ5ODk1MDg4YWViIiwidXNlcl9pZCI6NDF9.9qeKcZF_Mc9tdCbhSDvma3M-jTs7pkHhYWh3GqKeUD8';

  const handleSave = async () => {
    if (!currentLead || isSaving) return;

    if (!formData.propertyValue) {
      toast({
        title: 'Property value required',
        description: 'Please enter the estimated property value.',
        variant: 'destructive',
      });
      return;
    }

    const numericValue = parseFloat(String(formData.propertyValue));
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      toast({
        title: 'Invalid property value',
        description: 'Please enter a valid property value greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const payload = {
      application_id: currentLead.appId,
      collateral_type: 'property',
      ownership_type: 'self_ownership',
      estimated_property_value: numericValue,
      collateral_description: formData.description || '',
      location: formData.location || '',
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          Authorization: AUTH_TOKEN,
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to save collateral details.');
      }

      const data = await response.json();

      updateLead(currentLead.id, {
        formData: {
          ...currentLead.formData,
          step6: {
            ...formData,
            collateralType: 'property',
            ownershipType: 'selfOwnership',
            propertyValue: formData.propertyValue,
            description: formData.description,
            location: formData.location,
          },
        },
      });

      toast({
        title: 'Information Saved',
        description: data?.message || 'Collateral details have been saved successfully.',
        className: 'bg-green-50 border-green-200',
      });

      router.push('/lead/new-lead-info');
    } catch (error: any) {
      toast({
        title: 'Failed to save information',
        description: error?.message || 'Something went wrong while saving collateral details.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }

  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };

  if (!currentLead) {
    return null;
  }

  return (
    <DashboardLayout 
      title="Collateral Details" 
      showNotifications={false}
      showExitButton={true} 
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto mb-20">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Collateral Information</h2>

            <div className="space-y-4">
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
                    value={formData.propertyValue ? formatIndianNumber(formData.propertyValue) : ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      setField('propertyValue', value);
                    }}
                    placeholder="Enter estimated value"
                    className="h-12 rounded-l-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Enter value between ₹1,00,000 to ₹99,99,99,999</p>
              </div>

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
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Information'
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
