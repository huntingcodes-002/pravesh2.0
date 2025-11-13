'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead, CoApplicant } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { isApiError, submitCoApplicantAddressDetails, lookupPincode } from '@/lib/api';
import { Loader } from 'lucide-react';

interface Address {
  id: string;
  addressType: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  landmark: string;
  postalCode: string;
  isPrimary: boolean;
  city: string;
  stateCode: string;
  stateName: string;
}

const createEmptyAddress = (): Address => ({
  id: Date.now().toString(),
  addressType: 'residential',
  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  landmark: '',
  postalCode: '',
  isPrimary: false,
  city: '',
  stateCode: '',
  stateName: '',
});

function CoApplicantAddressDetailsPageContent() {
  const { currentLead, updateCoApplicant } = useLead();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const coApplicantId = searchParams.get('coApplicantId');

  const coApplicant: CoApplicant | undefined = useMemo(() => {
    if (!currentLead || !coApplicantId) return undefined;
    return currentLead.formData?.coApplicants?.find((ca: CoApplicant) => ca.id === coApplicantId);
  }, [currentLead, coApplicantId]);

  const existingAddresses =
    (coApplicant?.data?.addressDetails?.addresses as Address[]) ||
    (coApplicant?.data?.step3?.addresses as Address[]) ||
    [];

  const [addresses, setAddresses] = useState<Address[]>(
    existingAddresses.length > 0
      ? existingAddresses.map(addr => ({ ...createEmptyAddress(), ...addr }))
      : [{ ...createEmptyAddress(), isPrimary: true }]
  );

  const [collapsedAddresses, setCollapsedAddresses] = useState<Set<string>>(new Set());
  const [pincodeLookupId, setPincodeLookupId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentLead || !coApplicant || !coApplicantId) {
      router.replace('/lead/co-applicant-info');
    }
  }, [currentLead, coApplicant, coApplicantId, router]);

  const setPrimaryAddress = (id: string) => {
    setAddresses(prev =>
      prev.map(addr => ({
        ...addr,
        isPrimary: addr.id === id,
      }))
    );
  };

  const handleAddressChange = <K extends keyof Address>(id: string, field: K, value: Address[K]) => {
    setAddresses(prev => prev.map(addr => (addr.id === id ? { ...addr, [field]: value } : addr)));
  };

const handlePostalCodeChange = (id: string, rawValue: string) => {
  const numeric = rawValue.replace(/[^0-9]/g, '').slice(0, 6);
  setAddresses(prev =>
    prev.map(addr =>
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
      prev.map(addr =>
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
      prev.map(addr =>
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

  const handleAddAddress = () => {
    setCollapsedAddresses(new Set(addresses.map((addr: Address) => addr.id)));
    setAddresses(prev => [
      ...prev,
      {
        ...createEmptyAddress(),
        isPrimary: prev.length === 0,
      },
    ]);
  };

  const handleRemoveAddress = (id: string) => {
    setAddresses(prev => {
      const remaining = prev.filter(addr => addr.id !== id);
      if (remaining.length === 0) {
        return [{ ...createEmptyAddress(), isPrimary: true }];
      }
      if (!remaining.some((addr: Address) => addr.isPrimary)) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }
      return remaining;
    });
  };

  const requiredFieldsFilled = addresses.every(
    addr =>
      addr.addressType &&
      addr.addressLine1 &&
      addr.landmark &&
      addr.postalCode &&
      addr.postalCode.length === 6
  );

  const handleSave = async () => {
    if (!currentLead || !coApplicantId || !coApplicant) return;
    if (!requiredFieldsFilled) {
      toast({
        title: 'Missing Information',
        description: 'Please fill required address fields before saving.',
        variant: 'destructive',
      });
      return;
    }

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
    const coApplicantIndex = coApplicants.findIndex(ca => ca.id === coApplicantId);

    if (coApplicantIndex < 0) {
      toast({
        title: 'Co-applicant missing',
        description: 'Could not determine the co-applicant index. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const payloadAddresses = addresses.map(addr => ({
      address_type: addr.addressType || 'residential',
      address_line_1: addr.addressLine1 || '',
      address_line_2: addr.addressLine2 || '',
      address_line_3: addr.addressLine3 || '',
      landmark: addr.landmark || '',
      pincode: addr.postalCode || '',
      latitude: '90',
      longitude: '90',
      is_primary: addr.isPrimary,
      city: addr.city || undefined,
      state_code: addr.stateCode || undefined,
    }));

    setIsSaving(true);
    try {
      const response = await submitCoApplicantAddressDetails({
        application_id: applicationId,
        co_applicant_index: coApplicantIndex,
        addresses: payloadAddresses,
      });

      if (isApiError(response)) {
        throw new Error(response.error || 'Failed to save co-applicant address details.');
      }

      updateCoApplicant(currentLead.id, coApplicantId, {
        relationship: coApplicant.relationship,
        data: {
          ...coApplicant.data,
          addressDetails: {
            ...(coApplicant.data?.addressDetails ?? {}),
            addresses,
          },
        },
      });

      toast({
        title: 'Address details saved',
        description: response.message || 'Co-applicant address details submitted successfully.',
        className: 'bg-green-50 border-green-200',
      });
      router.push('/lead/co-applicant-info');
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

  if (!currentLead || !coApplicant) {
    return null;
  }

  return (
    <DashboardLayout
      title="Co-Applicant Address Details"
      showNotifications={false}
      showExitButton
      onExit={() => router.push('/lead/co-applicant-info')}
    >
      <div className="max-w-2xl mx-auto pb-24">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Co-Applicant</p>
              <h2 className="text-xl font-semibold text-[#003366]">
                {coApplicant?.data?.basicDetails?.fullName ||
                  [coApplicant?.data?.basicDetails?.firstName, coApplicant?.data?.basicDetails?.lastName]
                    .filter(Boolean)
                    .join(' ') ||
                  'Unnamed Co-applicant'}
              </h2>
            </div>
            <Badge variant="outline">{coApplicant.relationship || 'Relation not set'}</Badge>
          </div>

          <div className="space-y-5">
            {addresses.map((address, index) => {
              const isCollapsed = collapsedAddresses.has(address.id);
              return (
                <Card key={address.id} className="border border-gray-200 rounded-xl shadow-sm">
                  <CardContent className="p-0">
                    <button
                      type="button"
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-all text-left rounded-t-xl',
                        isCollapsed ? 'rounded-xl' : 'rounded-t-xl'
                      )}
                      onClick={() => {
                        setCollapsedAddresses(prev => {
                          const next = new Set(prev);
                          if (next.has(address.id)) next.delete(address.id);
                          else next.add(address.id);
                          return next;
                        });
                      }}
                    >
                      <div className="flex flex-col">
                        <p className="text-sm font-semibold text-[#003366]">Address {index + 1}</p>
                        {address.addressLine1 && (
                          <span className="text-xs text-gray-500 truncate max-w-[220px]">
                            {address.addressLine1}, {address.postalCode}
                          </span>
                        )}
                        {address.isPrimary && (
                          <span className="mt-1 text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full w-fit font-medium">
                            Primary
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{isCollapsed ? 'Expand' : 'Collapse'}</span>
                    </button>

                    {!isCollapsed && (
                      <div className="p-5 space-y-4 border-t border-gray-100">
                        <div>
                          <Label className="text-sm font-medium text-[#003366] mb-2 block">
                            Address Type <span className="text-[#DC2626]">*</span>
                          </Label>
                          <Select
                            value={address.addressType}
                            onValueChange={value => handleAddressChange(address.id, 'addressType', value)}
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

                        <div>
                          <Label className="text-sm font-medium text-[#003366] mb-2 block">
                            Address Line 1 <span className="text-[#DC2626]">*</span>
                          </Label>
                          <Input
                            value={address.addressLine1}
                            onChange={e => handleAddressChange(address.id, 'addressLine1', e.target.value)}
                            placeholder="House/Flat No., Building Name"
                            className="h-12 rounded-lg"
                            maxLength={255}
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-[#003366] mb-2 block">Address Line 2</Label>
                          <Input
                            value={address.addressLine2}
                            onChange={e => handleAddressChange(address.id, 'addressLine2', e.target.value)}
                            placeholder="Street Name, Area"
                            className="h-12 rounded-lg"
                            maxLength={255}
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-[#003366] mb-2 block">Address Line 3</Label>
                          <Input
                            value={address.addressLine3}
                            onChange={e => handleAddressChange(address.id, 'addressLine3', e.target.value)}
                            placeholder="Block / Locality"
                            className="h-12 rounded-lg"
                            maxLength={255}
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-[#003366] mb-2 block">
                            Landmark <span className="text-[#DC2626]">*</span>
                          </Label>
                          <Input
                            value={address.landmark}
                            onChange={e => handleAddressChange(address.id, 'landmark', e.target.value)}
                            placeholder="Nearby landmark"
                            className="h-12 rounded-lg"
                            maxLength={255}
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-[#003366] mb-2 block">
                            Postal Code <span className="text-[#DC2626]">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              value={address.postalCode}
                              onChange={(e) => handlePostalCodeChange(address.id, e.target.value)}
                              placeholder="Enter 6-digit postal code"
                              className={cn(
                                'h-12 rounded-lg',
                                (pincodeLookupId === address.id || address.city || address.stateCode) && 'pr-28'
                              )}
                              maxLength={6}
                            />
                            {(pincodeLookupId === address.id || address.city || address.stateCode) && (
                              <div className="absolute inset-y-0 right-3 flex items-center gap-2 pointer-events-none">
                                {pincodeLookupId === address.id && (
                                  <Loader className="w-4 h-4 animate-spin text-[#0072CE]" />
                                )}
                                {address.city && (
                                  <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                                    {address.city} {address.stateCode}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                          <Label className="text-base font-medium">Mark as Primary Address</Label>
                          <Switch checked={address.isPrimary} onCheckedChange={() => setPrimaryAddress(address.id)} />
                        </div>

                        {addresses.length > 1 && (
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              className="w-full h-11 border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => handleRemoveAddress(address.id)}
                            >
                              Remove Address
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full h-12 text-[#0072CE] border-dashed border-[#0072CE]/50 hover:bg-[#E6F0FA] rounded-lg font-medium"
                onClick={handleAddAddress}
              >
                + Add Another Address
              </Button>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={!requiredFieldsFilled || isSaving}
              className="w-full h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] disabled:bg-gray-300 disabled:text-gray-600"
            >
              {isSaving ? 'Saving...' : 'Save Information'}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function CoApplicantAddressDetailsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading...</div>}>
      <CoApplicantAddressDetailsPageContent />
    </Suspense>
  );
}

