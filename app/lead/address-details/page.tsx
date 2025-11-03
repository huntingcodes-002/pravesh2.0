'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from "@/lib/utils";

interface Address {
  id: string;
  addressType: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  landmark: string;
  postalCode: string;
}

export default function Step3Page() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();

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
          addressLine3: '',
          landmark: '',
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
    const remainingAddresses = addresses.filter((addr) => addr.id !== id);
    setAddresses(remainingAddresses);
  };

  const handleAddressChange = (id: string, field: keyof Address, value: any) => {
    setAddresses(
      addresses.map((addr) => (addr.id === id ? { ...addr, [field]: value } : addr))
    );
  };


  const handleSave = () => {
    if (!currentLead) return;

    updateLead(currentLead.id, {
      formData: {
        ...currentLead.formData,
        step3: { addresses },
      },
    });
    
    router.push('/lead/new-lead-info');
  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };

  const canProceed = addresses.every(
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
