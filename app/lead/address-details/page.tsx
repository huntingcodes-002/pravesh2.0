'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { submitAddressDetails, isApiError, getDetailedInfo, lookupPincode } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, ChevronDown, ChevronUp, CheckCircle2, Loader, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";
import { Switch } from '@/components/ui/switch';

interface Address {
  id: string;
  addressType: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  landmark: string;
  isPrimary: boolean;
  city: string;
  stateCode: string;
  stateName: string;
}

export default function Step3Page() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  const { toast } = useToast();

  // Check if this section is already completed
  const isCompleted = currentLead?.step3Completed === true;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [collapsedAddresses, setCollapsedAddresses] = useState<Set<string>>(new Set());
  const [isLoadingOcrData, setIsLoadingOcrData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const hasFetchedOcrData = useRef<string | null>(null);
  const [isAutoFilledViaAadhaar, setIsAutoFilledViaAadhaar] = useState(
    currentLead?.formData?.step3?.autoFilledViaAadhaar || 
    currentLead?.formData?.step3?.addresses?.[0]?.autoFilledViaAadhaar || 
    false
  );
  const [pincodeLookupId, setPincodeLookupId] = useState<string | null>(null);

  useEffect(() => {
    if (currentLead?.formData?.step3?.addresses) {
      const cleanedAddresses = currentLead.formData.step3.addresses.map((addr: any, index: number) => {
        const generatedId = addr.id ? String(addr.id) : `${Date.now()}-${index}`;
        return {
          id: generatedId,
          addressType: addr.addressType || addr.address_type || 'residential',
          addressLine1: addr.addressLine1 || addr.address_line_1 || '',
          addressLine2: addr.addressLine2 || addr.address_line_2 || '',
          postalCode: addr.postalCode || addr.pincode || '',
          landmark: addr.landmark || '',
          isPrimary: typeof addr.isPrimary === 'boolean'
            ? addr.isPrimary
            : typeof addr.is_primary === 'boolean'
              ? addr.is_primary
              : index === 0,
          city: addr.city || addr.city_name || '',
          stateCode: addr.stateCode || addr.state_code || '',
          stateName: addr.stateName || addr.state || '',
        } as Address;
      });

      if (cleanedAddresses.length > 0 && !cleanedAddresses.some((addr: Address) => addr.isPrimary)) {
        cleanedAddresses[0] = { ...cleanedAddresses[0], isPrimary: true };
      }

      setAddresses(cleanedAddresses);
    } else {
      setAddresses([
        {
          id: Date.now().toString(),
          addressType: 'residential',
          addressLine1: '',
          addressLine2: '',
          postalCode: '',
          landmark: '',
          isPrimary: true,
          city: '',
          stateCode: '',
          stateName: '',
        },
      ]);
    }
    // Sync auto-population flag from context
    setIsAutoFilledViaAadhaar(
      currentLead?.formData?.step3?.autoFilledViaAadhaar || 
      currentLead?.formData?.step3?.addresses?.[0]?.autoFilledViaAadhaar || 
      false
    );
  }, [currentLead]);

  // Auto-populate address from Aadhaar OCR data if available (only if page not submitted)
  useEffect(() => {
    const fetchAndPopulateOcrData = async () => {
      // Only auto-populate if:
      // 1. Page was not manually submitted (step3Completed !== true)
      // 2. We have an application ID
      // 3. We're not already loading
      // 4. We haven't already fetched OCR data for this application ID
      const appId = currentLead?.appId;
      if (isCompleted || !appId || isLoadingOcrData || hasFetchedOcrData.current === appId) {
        return;
      }

      setIsLoadingOcrData(true);

      try {
        const response = await getDetailedInfo(appId);

        if (isApiError(response)) {
          toast({
            title: 'Error',
            description: response.error || 'Failed to fetch document data. Please try again.',
            variant: 'destructive',
          });
          setIsLoadingOcrData(false);
          return;
        }

        // Backend response structure: { success: true, application_id, workflow_state: { aadhaar_extracted_address: {...} }, ... }
        // All fields are at top level
        const successResponse = response as any;

        // Check if Aadhaar extracted address exists
        const aadhaarAddress = successResponse.workflow_state?.aadhaar_extracted_address;
        
        if (aadhaarAddress) {
          // Extract address fields
          const addressLine1 = aadhaarAddress.address_line_one || aadhaarAddress.address_line_1 || '';
          const addressLine2 = aadhaarAddress.address_line_two || aadhaarAddress.address_line_2 || '';
          const landmark = aadhaarAddress.landmark || '';
          const pincode = aadhaarAddress.pincode || '';
          // Default to "residential" if address_type is null
          const addressType = aadhaarAddress.address_type || 'residential';

          // Only populate if we have at least address_line_1 or pincode
          if (addressLine1 || pincode) {
            // Ensure we have at least one address, populate the first one (index 0)
            setAddresses(prev => {
              let updatedAddresses: Address[];
              if (prev.length === 0) {
                // Create new address if none exists
                updatedAddresses = [{
                  id: Date.now().toString(),
                  addressType: addressType,
                  addressLine1: addressLine1,
                  addressLine2: addressLine2,
                  postalCode: pincode,
                  landmark: landmark,
                  isPrimary: true,
                  city: '',
                  stateCode: '',
                  stateName: '',
                }];
              } else {
                // Overwrite first address with OCR data
                updatedAddresses = prev.map((addr, index) => 
                  index === 0 ? {
                    ...addr,
                    addressType: addressType,
                    addressLine1: addressLine1 || addr.addressLine1,
                    addressLine2: addressLine2 || addr.addressLine2,
                    postalCode: pincode || addr.postalCode,
                    landmark: landmark || addr.landmark,
                  } : addr
                );
              }

              // Set local state immediately for instant UI update
              setIsAutoFilledViaAadhaar(true);
              
              // Update lead context with auto-population flag
              if (currentLead) {
                // Mark addresses as auto-filled via Aadhaar
                const addressesWithFlag = updatedAddresses.map(addr => ({
                  ...addr,
                  autoFilledViaAadhaar: true,
                }));
                
                updateLead(currentLead.id, {
                  formData: {
                    ...currentLead.formData,
                    step3: { 
                      addresses: addressesWithFlag,
                      autoFilledViaAadhaar: true, // Mark step3 as auto-filled via Aadhaar
                    },
                  },
                });
              }

              return updatedAddresses;
            });

            toast({
              title: 'Auto-populated',
              description: 'Address details have been auto-populated from uploaded Aadhaar document.',
              className: 'bg-blue-50 border-blue-200',
            });
          }
        }
        
        // Mark as fetched for this application ID to prevent re-fetching
        hasFetchedOcrData.current = appId;
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch document data. Please try again.',
          variant: 'destructive',
        });
        // Mark as fetched even on error to prevent infinite retries
        hasFetchedOcrData.current = appId;
      } finally {
        setIsLoadingOcrData(false);
      }
    };

    // Only fetch if we have application ID and page is not completed
    if (currentLead?.appId && !isCompleted) {
      fetchAndPopulateOcrData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLead?.appId, isCompleted]); // Only run when appId changes or completion status changes

  const toggleAddressCollapse = (addressId: string) => {
    const newCollapsed = new Set(collapsedAddresses);
    if (newCollapsed.has(addressId)) newCollapsed.delete(addressId);
    else newCollapsed.add(addressId);
    setCollapsedAddresses(newCollapsed);
  };

  const handleAddAddress = () => {
    if (isCompleted) return;

    setCollapsedAddresses(new Set(addresses.map((addr: Address) => addr.id)));
    setAddresses(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        addressType: 'residential',
        addressLine1: '',
        addressLine2: '',
        postalCode: '',
        landmark: '',
        isPrimary: prev.length === 0,
        city: '',
        stateCode: '',
        stateName: '',
      },
    ]);
  };

  const handleRemoveAddress = (id: string) => {
    if (isCompleted) return; // Prevent removing addresses when completed

    setAddresses(prev => {
      const remainingAddresses = prev.filter((addr) => addr.id !== id);
      if (remainingAddresses.length > 0 && !remainingAddresses.some((addr: Address) => addr.isPrimary)) {
        remainingAddresses[0] = { ...remainingAddresses[0], isPrimary: true };
      }
      return remainingAddresses;
    });

    setCollapsedAddresses(prevSet => {
      const updated = new Set(prevSet);
      updated.delete(id);
      return updated;
    });
  };

  const handleAddressChange = (id: string, field: keyof Address, value: any) => {
    if (isCompleted) return; // Prevent editing when completed
    setAddresses(prev =>
      prev.map((addr) => (addr.id === id ? { ...addr, [field]: value } : addr))
    );
  };

  const handleSetPrimary = (id: string) => {
    if (isCompleted) return;
    setAddresses(prev =>
      prev.map((addr: Address) => ({ ...addr, isPrimary: addr.id === id }))
    );
  };

const handlePostalCodeChange = (id: string, rawValue: string) => {
  if (isCompleted) return;
  const numeric = rawValue.replace(/[^0-9]/g, '').slice(0, 6);

  setAddresses(prev =>
    prev.map((addr) =>
      addr.id === id
        ? {
            ...addr,
            postalCode: numeric,
            city: numeric.length === 6 ? addr.city : '',
            stateCode: numeric.length === 6 ? addr.stateCode : '',
            stateName: numeric.length === 6 ? addr.stateName : '',
          }
        : addr
    )
  );

  if (numeric.length === 6) {
    void performPincodeLookup(id, numeric);
  } else if (pincodeLookupId === id) {
    setPincodeLookupId(null);
  }
};

const performPincodeLookup = async (id: string, zip: string) => {
  setPincodeLookupId(id);
  try {
    const response = await lookupPincode(zip);
    if (isApiError(response) || !response.success) {
      throw new Error('Zipcode not found');
    }

    const data = response;
    setAddresses(prev =>
      prev.map((addr) =>
        addr.id === id
          ? {
              ...addr,
              city: data.city ?? '',
              stateCode: data.state_code ?? '',
              stateName: data.state ?? '',
            }
          : addr
      )
    );
  } catch {
    setAddresses(prev =>
      prev.map((addr) =>
        addr.id === id
          ? {
              ...addr,
              city: '',
              stateCode: '',
              stateName: '',
            }
          : addr
      )
    );
    toast({
      title: 'Zipcode not found',
      description: 'Please check the pincode and try again.',
      variant: 'destructive',
    });
  } finally {
    setPincodeLookupId(null);
  }
};


  const handleSave = async () => {
    if (!currentLead) return;

    if (!currentLead.appId) {
      toast({
        title: 'Error',
        description: 'Application ID not found. Please create a new lead first.',
        variant: 'destructive',
      });
      return;
    }

    if (!canProceed) {
      toast({
        title: 'Incomplete Details',
        description: 'Please fill in all required address fields and ensure a primary address is selected.',
        variant: 'destructive',
      });
      return;
    }

    const normalizedAddresses = addresses.some((addr: Address) => addr.isPrimary)
      ? addresses
      : addresses.map((addr, index) => ({
          ...addr,
          isPrimary: index === 0,
        }));

    const backendAddresses = normalizedAddresses.map((addr) => {
      const addressLine1 = addr.addressLine1?.trim() ?? '';
      const addressLine2 = addr.addressLine2?.trim() ?? '';
      const landmark = addr.landmark?.trim() ?? '';
      const postalCode = addr.postalCode?.trim() ?? '';

      return {
        address_type: addr.addressType || 'residential',
        address_line_1: addressLine1,
        address_line_2: addressLine2,
        address_line_3: '',
        landmark,
        pincode: postalCode,
        latitude: '-90',
        longitude: '90',
        is_primary: Boolean(addr.isPrimary),
      };
    });

    setIsSaving(true);

    try {
      const response = await submitAddressDetails({
        application_id: currentLead.appId,
        addresses: backendAddresses,
      });

      if (isApiError(response)) {
        updateLead(currentLead.id, {
          step3Completed: false,
        });

        toast({
          title: 'Save Failed',
          description: response.error || 'Failed to save address details. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      const finalAddresses = normalizedAddresses.map(addr => ({ ...addr }));
      setAddresses(finalAddresses);

      updateLead(currentLead.id, {
        step3Completed: true,
        formData: {
          ...currentLead.formData,
          step3: { addresses: finalAddresses },
        },
      });

      toast({
        title: 'Success',
        description: 'Address details saved successfully and marked as completed.',
        className: 'bg-green-50 border-green-200',
      });

      router.push('/lead/new-lead-info');
    } catch (error: any) {
      updateLead(currentLead.id, {
        step3Completed: false,
      });

      toast({
        title: 'Save Failed',
        description: error?.message || 'Failed to save address details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };

  const canProceed =
    addresses.length > 0 &&
    addresses.some((addr: Address) => addr.isPrimary) &&
    addresses.every(
      (addr) =>
        addr.addressType &&
        addr.addressLine1 &&
        addr.landmark &&
        addr.postalCode &&
        addr.postalCode.length === 6
    );

  return (
    <DashboardLayout
      title="Address Details"
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-28 px-4">
        {isCompleted && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Address Details section has been completed and submitted. This section is now read-only.
            </p>
          </div>
        )}
        
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-[#003366]">
                Address Information
              </h2>
              {isLoadingOcrData && (
                <Loader className="text-[#0072CE] animate-spin w-5 h-5" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {(isAutoFilledViaAadhaar || currentLead?.formData?.step3?.autoFilledViaAadhaar || currentLead?.formData?.step3?.addresses?.[0]?.autoFilledViaAadhaar) && (
                <Badge className="bg-green-100 text-green-700 text-xs">Verified via Aadhaar</Badge>
              )}
              {isCompleted && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Completed
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {addresses.map((address, index) => {
              const isCollapsed = collapsedAddresses.has(address.id);
              const isLookupActive = pincodeLookupId === address.id;
              const hasLookupValue = Boolean(address.city || address.stateCode);
              const showLookupMeta = isLookupActive || hasLookupValue;

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
                        className={cn(
                          "flex items-start justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 px-4 py-3 transition-all duration-200",
                          isCollapsed ? "rounded-xl" : "rounded-t-xl"
                        )}
                      >
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
                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          {addresses.length > 1 && !isCompleted && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveAddress(address.id);
                              }}
                              className="hover:bg-red-50"
                              disabled={isCompleted}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          <div className="text-gray-500">
                            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="px-4 py-5 space-y-4 bg-white">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">
                              Address Type <span className="text-red-500">*</span>
                            </Label>
                            <Select
                              value={address.addressType}
                              onValueChange={(value) => handleAddressChange(address.id, 'addressType', value)}
                              disabled={isCompleted}
                            >
                              <SelectTrigger className={cn("h-12 rounded-lg", isCompleted && "bg-gray-50 cursor-not-allowed")}>
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

                          <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">
                              Address Line 1 <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="text"
                              value={address.addressLine1}
                              onChange={(e) => handleAddressChange(address.id, 'addressLine1', e.target.value)}
                              placeholder="House/Flat No., Building Name"
                              disabled={isCompleted}
                              className={cn("h-12 rounded-lg", isCompleted && "bg-gray-50 cursor-not-allowed")}
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
                              onChange={(e) => handleAddressChange(address.id, 'addressLine2', e.target.value)}
                              placeholder="Street Name, Area"
                              disabled={isCompleted}
                              className={cn("h-12 rounded-lg", isCompleted && "bg-gray-50 cursor-not-allowed")}
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
                              onChange={(e) => handleAddressChange(address.id, 'landmark', e.target.value)}
                              placeholder="Nearby landmark"
                              disabled={isCompleted}
                              className={cn("h-12 rounded-lg", isCompleted && "bg-gray-50 cursor-not-allowed")}
                              maxLength={255}
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">
                              Postal Code <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                              <Input
                                type="text"
                                value={address.postalCode}
                                onChange={(e) => handlePostalCodeChange(address.id, e.target.value)}
                                placeholder="Enter 6-digit postal code"
                                disabled={isCompleted}
                                className={cn(
                                  'h-12 rounded-lg',
                                  showLookupMeta && 'pr-28',
                                  isCompleted && 'bg-gray-50 cursor-not-allowed'
                                )}
                                maxLength={6}
                              />
                              {showLookupMeta && (
                                <div className="absolute inset-y-0 right-3 flex items-center gap-2 pointer-events-none">
                                  {isLookupActive && <Loader className="w-4 h-4 animate-spin text-[#0072CE]" />}
                                  {hasLookupValue && !isLookupActive && (
                                    <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                                      {address.city} {address.stateCode}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={cn("flex items-center justify-between p-4 bg-gray-50 rounded-lg border", isCompleted && "opacity-60")}>
                            <Label className="text-base font-medium">
                              Mark as Primary Address
                            </Label>
                            <Switch
                              checked={address.isPrimary}
                              onCheckedChange={() => handleSetPrimary(address.id)}
                              disabled={isCompleted}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}

            <div className="pt-2">
              <Button
                variant="outline"
                className={cn(
                  "w-full h-12 text-[#0072CE] border-dashed border-[#0072CE]/50 hover:bg-[#E6F0FA] rounded-lg font-medium",
                  isCompleted && "text-gray-400 border-gray-300 hover:bg-white cursor-not-allowed"
                )}
                onClick={handleAddAddress}
                disabled={isCompleted}
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Another Address
              </Button>
            </div>

          </div>
          
          {/* Auto-filled verification message */}
          {(isAutoFilledViaAadhaar || currentLead?.formData?.step3?.autoFilledViaAadhaar || currentLead?.formData?.step3?.addresses?.[0]?.autoFilledViaAadhaar) && (
            <p className="text-xs text-gray-400 mt-4">Auto-filled and verified via Aadhaar OCR workflow</p>
          )}
        </div>

        {/* Fixed Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={isCompleted || isSaving || !canProceed}
              className={cn(
                "flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white",
                (isCompleted || isSaving || !canProceed) && "opacity-80 cursor-not-allowed"
              )}
            >
              {isCompleted
                ? 'Section Completed'
                : isSaving
                  ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  )
                  : 'Save Information'}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
