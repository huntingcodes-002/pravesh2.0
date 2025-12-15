'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressBar from '@/components/ProgressBar';
import { useLead, CoApplicant } from '@/contexts/LeadContext'; // Import CoApplicant
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ArrowLeft, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/api';

interface Address {
  id: string;
  addressType: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  landmark: string;
  postalCode: string;
  isPrimary: boolean;
}

function CoApplicantStep3PageContent() {
  const { currentLead, updateCoApplicant } = useLead();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Get coApplicantId from URL params
  const coApplicantId = searchParams.get('coApplicantId');

  // Explicitly type 'ca' here to resolve TS7006
  const coApplicant: CoApplicant | undefined = currentLead?.formData.coApplicants?.find((ca: CoApplicant) => ca.id === coApplicantId);
  const coApplicantData = coApplicant?.data?.step3 || {};

  // Redirect if no lead or co-applicant ID is found
  useEffect(() => {
    if (!currentLead || !coApplicantId || !coApplicant) {
      router.replace('/lead/step5');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLead, coApplicantId]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [collapsedAddresses, setCollapsedAddresses] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const API_BASE_URL = 'https://uatlb.api.saarathifinance.com/api/lead-collection/applications';

  useEffect(() => {
    if (coApplicantData.addresses) {
      setAddresses(coApplicantData.addresses);
    } else {
      setAddresses([
        {
          id: Date.now().toString(),
          addressType: 'residential',
          addressLine1: '',
          addressLine2: '',
          addressLine3: '',
          landmark: '',
          postalCode: '',
          isPrimary: true,
        },
      ]);
    }
  }, [coApplicantData.addresses]);

  const handleAddAddress = () => {
    // Collapse all existing addresses when adding a new one
    const newCollapsed = new Set(addresses.map(addr => addr.id));
    setCollapsedAddresses(newCollapsed);

    setAddresses([
      ...addresses,
      {
        id: Date.now().toString(),
        addressType: 'residential',
        addressLine1: '',
        addressLine2: '',
        addressLine3: '',
        landmark: '',
        postalCode: '',
        isPrimary: addresses.length === 0,
      },
    ]);
  };

  const toggleAddressCollapse = (addressId: string) => {
    const newCollapsed = new Set(collapsedAddresses);
    if (newCollapsed.has(addressId)) {
      newCollapsed.delete(addressId);
    } else {
      newCollapsed.add(addressId);
    }
    setCollapsedAddresses(newCollapsed);
  };

  const handleRemoveAddress = (id: string) => {
    const remainingAddresses = addresses.filter((addr) => addr.id !== id);
    if (remainingAddresses.length > 0 && !remainingAddresses.some(a => a.isPrimary)) {
      remainingAddresses[0].isPrimary = true;
    }
    setAddresses(remainingAddresses);
  };

  const handleAddressChange = (id: string, field: keyof Address, value: any) => {
    setAddresses(
      addresses.map((addr) => (addr.id === id ? { ...addr, [field]: value } : addr))
    );
  };

  const handleSetPrimary = (id: string) => {
    setAddresses(
      addresses.map((addr) => ({
        ...addr,
        isPrimary: addr.id === id,
      }))
    );
  };

  const handleExit = () => {
    if (!currentLead || !coApplicantId) return;

    // Save current step data (Rule c)
    updateCoApplicant(currentLead.id, coApplicantId, {
      currentStep: 3,
      data: {
        ...coApplicant?.data,
        step3: { addresses },
      }
    });

    // Back to co-applicants should go to main step 5
    router.push('/lead/step5');
  };


  const handleNext = async () => {
    if (!currentLead || !coApplicantId || !coApplicant) return;

    const applicationId = currentLead.appId;
    if (!applicationId) {
      toast({
        title: 'Application not found',
        description: 'Unable to determine the application ID. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const coApplicants = currentLead.formData?.coApplicants ?? [];
    const coApplicantIndex = coApplicants.findIndex((entry) => entry.id === coApplicantId);
    if (coApplicantIndex < 0) {
      toast({
        title: 'Co-applicant missing',
        description: 'Could not determine the co-applicant index. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const token = getAuthToken();
    if (!token) {
      toast({
        title: 'Authentication required',
        description: 'Your session has expired. Please sign in again to continue.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      addresses: addresses.map((addr) => ({
        address_type: addr.addressType || 'residential',
        address_line_1: addr.addressLine1 || '',
        address_line_2: addr.addressLine2 || '',
        address_line_3: addr.addressLine3 || '',
        landmark: addr.landmark || '',
        pincode: addr.postalCode || '',
        latitude: '90',
        longitude: '90',
        is_primary: addr.isPrimary,
      })),
    };

    setIsSaving(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/${encodeURIComponent(applicationId)}/co-applicant-address-details/${coApplicantIndex}/`,
        {
          method: 'POST',
          headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to save co-applicant address details.');
      }

      const result = await response.json();

      updateCoApplicant(currentLead.id, coApplicantId, {
        currentStep: 4,
        isComplete: true,
        data: {
          ...coApplicant?.data,
          step3: { addresses },
          step4: {
            ...coApplicant?.data?.step4,
            occupationType: 'Others',
            natureOfOccupation: 'Others',
          },
        },
      });

      toast({
        title: 'Address details saved',
        description: result?.message || 'Co-applicant address details submitted successfully.',
        className: 'bg-green-50 border-green-200',
      });

      router.push('/lead/step5');
    } catch (error: any) {
      toast({
        title: 'Failed to save address details',
        description: error?.message || 'Something went wrong while saving address information. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrevious = () => {
    // Previous should go to co-applicant step 2
    if (coApplicantId) {
      router.push(`/lead/step5/coapplicant/step2?coApplicantId=${coApplicantId}`);
    }
  };

  const canProceed = addresses.every(
    (addr) => addr.addressType && addr.addressLine1 && addr.landmark && addr.postalCode && addr.postalCode.length === 6
  );

  const progressBarText = 'Co-Applicant Details';

  if (!coApplicant) {
    return null;
  }

  return (
    <DashboardLayout
      title={progressBarText}
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-28 px-4">
        <ProgressBar currentStep={3} totalSteps={3} />

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-[#003366] mb-6">
            Address Information
          </h2>

          <div className="space-y-5">
            {addresses.map((address, index) => {
              const isCollapsed = collapsedAddresses.has(address.id);

              return (
                <Card
                  key={address.id}
                  className="border-gray-200 shadow-sm rounded-xl overflow-hidden transition-all duration-200"
                >
                  <Collapsible
                    open={!isCollapsed}
                    onOpenChange={() => toggleAddressCollapse(address.id)}
                  >

                    <CollapsibleTrigger asChild>
                      <div
                        className={`flex items-start justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 px-4 py-3 transition-all duration-200 ${isCollapsed ? "rounded-xl" : "rounded-t-xl"
                          }`}
                      >
                        {/* Left side - Address info */}
                        <div className="flex flex-col min-w-0">
                          <h3 className="font-semibold text-[1.05rem] text-[#003366] flex items-center gap-1">
                            <span>Address {index + 1}</span>
                            {address.addressType && (
                              <span className="text-sm font-medium text-gray-500">
                                ({address.addressType})
                              </span>
                            )}
                          </h3>

                          {address.isPrimary && (
                            <span className="mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-medium w-fit">
                              Primary
                            </span>
                          )}

                          {isCollapsed && address.addressLine1 && (
                            <span className="text-sm text-gray-500 truncate mt-1">
                              {address.addressLine1}, {address.postalCode}
                            </span>
                          )}
                        </div>

                        {/* Right side - Icons */}
                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          {addresses.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveAddress(address.id);
                              }}
                              className="hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          <div className="text-gray-500">
                            {isCollapsed ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="px-4 py-5 space-y-4 bg-white">
                        <div className="space-y-4">
                          {/* Address Type */}
                          <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">
                              Address Type <span className="text-red-500">*</span>
                            </Label>
                            <Select
                              value={address.addressType}
                              onValueChange={(value) =>
                                handleAddressChange(address.id, 'addressType', value)
                              }
                            >
                              <SelectTrigger className="h-12 rounded-lg">
                                <SelectValue placeholder="Select address type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="residential">Residential</SelectItem>
                                <SelectItem value="office">Office</SelectItem>
                                <SelectItem value="permanent">Permanent</SelectItem>
                                <SelectItem value="additional">Additional</SelectItem>
                                <SelectItem value="property">Property</SelectItem>
                                <SelectItem value="current">Current</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Address Lines */}
                          <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">
                              Address Line 1 <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="text"
                              value={address.addressLine1}
                              onChange={(e) =>
                                handleAddressChange(address.id, 'addressLine1', e.target.value)
                              }
                              placeholder="House/Flat No., Building Name"
                              className="h-12 rounded-lg"
                              maxLength={255}
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">
                              Address Line 2
                            </Label>
                            <Input
                              type="text"
                              value={address.addressLine2}
                              onChange={(e) =>
                                handleAddressChange(address.id, 'addressLine2', e.target.value)
                              }
                              placeholder="Street Name, Area"
                              className="h-12 rounded-lg"
                              maxLength={255}
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">
                              Address Line 3
                            </Label>
                            <Input
                              type="text"
                              value={address.addressLine3}
                              onChange={(e) =>
                                handleAddressChange(address.id, 'addressLine3', e.target.value)
                              }
                              placeholder="Additional Info"
                              className="h-12 rounded-lg"
                              maxLength={255}
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">
                              Landmark <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="text"
                              value={address.landmark}
                              onChange={(e) =>
                                handleAddressChange(address.id, 'landmark', e.target.value)
                              }
                              placeholder="Nearby landmark"
                              className="h-12 rounded-lg"
                              maxLength={255}
                            />
                          </div>

                          {/* Postal Code */}
                          <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">
                              Postal Code <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="text"
                              value={address.postalCode}
                              onChange={(e) =>
                                handleAddressChange(address.id, 'postalCode', e.target.value.replace(/[^0-9]/g, ''))
                              }
                              placeholder="Enter 6-digit postal code"
                              className="h-12 rounded-lg"
                              maxLength={6}
                            />
                          </div>

                          {/* Primary Address */}
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                            <Label className="text-base font-medium">
                              Mark as Primary Address
                            </Label>
                            <Switch
                              checked={address.isPrimary}
                              onCheckedChange={() => handleSetPrimary(address.id)}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}

            {/* Add Another Address */}
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full h-12 text-[#0072CE] border-dashed border-[#0072CE]/50 hover:bg-[#E6F0FA] rounded-lg font-medium"
                onClick={handleAddAddress}
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Another Address
              </Button>
            </div>
          </div>

        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button onClick={handlePrevious} variant="outline" className="flex-1 h-12 rounded-lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed || isSaving}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] disabled:opacity-80"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save & Add Co-Applicant'
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function CoApplicantStep3Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <CoApplicantStep3PageContent />
    </Suspense>
  );
}