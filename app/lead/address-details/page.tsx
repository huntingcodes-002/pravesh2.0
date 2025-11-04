'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { submitAddressDetails, isApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";

interface Address {
  id: string;
  addressType: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
}

export default function Step3Page() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  const { toast } = useToast();

  // Check if this section is already completed
  const isCompleted = currentLead?.step3Completed === true;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [collapsedAddresses, setCollapsedAddresses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentLead?.formData?.step3?.addresses) {
      // Remove isPrimary field if it exists
      const cleanedAddresses = currentLead.formData.step3.addresses.map(({ isPrimary, ...rest }: any) => rest);
      setAddresses(cleanedAddresses);
    } else {
      setAddresses([
        {
          id: Date.now().toString(),
          addressType: 'residential',
          addressLine1: '',
          addressLine2: '',
          postalCode: '',
        },
      ]);
    }
  }, [currentLead]);

  const toggleAddressCollapse = (addressId: string) => {
    const newCollapsed = new Set(collapsedAddresses);
    if (newCollapsed.has(addressId)) newCollapsed.delete(addressId);
    else newCollapsed.add(addressId);
    setCollapsedAddresses(newCollapsed);
  };

  const handleRemoveAddress = (id: string) => {
    if (isCompleted) return; // Prevent removing addresses when completed
    const remainingAddresses = addresses.filter((addr) => addr.id !== id);
    setAddresses(remainingAddresses);
  };

  const handleAddressChange = (id: string, field: keyof Address, value: any) => {
    if (isCompleted) return; // Prevent editing when completed
    setAddresses(
      addresses.map((addr) => (addr.id === id ? { ...addr, [field]: value } : addr))
    );
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

    // Map frontend address format to backend format
    // Remove address_line_3 and landmark - not required by backend
    // Auto-send: city_id, latitude, longitude, is_primary, address_type (from dropdown)
    const backendAddresses = addresses.map((addr, index) => ({
      address_type: addr.addressType || 'residential', // From dropdown
      address_line_1: addr.addressLine1 || '',
      address_line_2: addr.addressLine2 || '',
      pincode: addr.postalCode || '',
      city_id: 1, // Auto-send: default city_id
      latitude: "90", // Auto-send: default latitude
      longitude: "90", // Auto-send: default longitude
      is_primary: index === 0, // Auto-send: first address is primary
    }));

    try {
      // Endpoint 4: Submit address details
      const response = await submitAddressDetails({
        application_id: currentLead.appId,
        addresses: backendAddresses,
      });

      if (isApiError(response)) {
        // On API error, don't mark as completed - allow retry
        if (currentLead) {
          updateLead(currentLead.id, {
            step3Completed: false, // Ensure not marked as completed on error
          });
        }
        
        // Check if error is related to city_id validation
        const errorDetails = (response as any).details?.validation_errors?.addresses;
        let errorMessage = response.error || 'Failed to save address details. Please try again.';
        
        if (errorDetails) {
          const cityError = Object.values(errorDetails).find((err: any) => err?.city_id);
          if (cityError && (cityError as any).city_id) {
            errorMessage = `City ID validation failed: ${(cityError as any).city_id[0]}. Please use a valid city ID from the database.`;
          }
        }
        
        toast({
          title: 'Save Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      // Update local state and mark as completed
      updateLead(currentLead.id, {
        step3Completed: true, // Mark section as completed
        formData: {
          ...currentLead.formData,
          step3: { addresses },
        },
      });

      toast({
        title: 'Success',
        description: 'Address details saved successfully and marked as completed.',
        className: 'bg-green-50 border-green-200',
      });

      router.push('/lead/new-lead-info');
    } catch (error: any) {
      // On error, don't mark as completed - allow retry
      if (currentLead) {
        updateLead(currentLead.id, {
          step3Completed: false, // Ensure not marked as completed on error
        });
      }
      
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save address details. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };

  const canProceed = addresses.every(
    (addr) =>
      addr.addressType &&
      addr.addressLine1 &&
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
            <h2 className="text-xl font-semibold text-[#003366]">
              Address Information
            </h2>
            {isCompleted && (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Completed
              </Badge>
            )}
          </div>

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
                        className={cn(
                          "flex items-start justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 px-4 py-3 transition-all duration-200",
                          isCollapsed ? "rounded-xl" : "rounded-t-xl"
                        )}
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


                          {isCollapsed && address.addressLine1 && (
                            <span className="text-sm text-gray-500 truncate mt-1">
                              {address.addressLine1}, {address.postalCode}
                            </span>
                          )}
                        </div>

                        {/* Right side - Icons (CHANGED HERE) */}
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
                              onChange={(e) =>
                                handleAddressChange(address.id, 'addressLine2', e.target.value)
                              }
                              placeholder="Street Name, Area"
                              disabled={isCompleted}
                              className={cn("h-12 rounded-lg", isCompleted && "bg-gray-50 cursor-not-allowed")}
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
                              disabled={isCompleted}
                              className={cn("h-12 rounded-lg", isCompleted && "bg-gray-50 cursor-not-allowed")}
                              maxLength={6}
                            />
                          </div>

                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}

          </div>
        </div>

        {/* Fixed Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={isCompleted}
              className={cn("flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white", isCompleted && "bg-gray-300 cursor-not-allowed")}
            >
              {isCompleted ? 'Section Completed' : 'Save Information'}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
