'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead, CoApplicant } from '@/contexts/LeadContext';
import { submitCoApplicantAddressDetails, isApiError, lookupPincode } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, CheckCircle2, Loader, AlertTriangle, Edit2, Save, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";
import { useGeolocation } from '@uidotdev/usehooks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Address {
  id: string;
  addressType: 'residential' | 'permanent' | 'correspondence';
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  postalCode: string;
  landmark: string;
  city: string;
  stateCode: string;
  stateName: string;
  latitude: string;
  longitude: string;
  isComplete: boolean;
  sameAs?: 'residential' | 'permanent' | 'correspondence';
}

const INITIAL_ADDRESSES: Address[] = [
  {
    id: 'addr_current',
    addressType: 'residential',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    postalCode: '',
    landmark: '',
    city: '',
    stateCode: '',
    stateName: '',
    latitude: '',
    longitude: '',
    isComplete: false
  },
  {
    id: 'addr_permanent',
    addressType: 'permanent',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    postalCode: '',
    landmark: '',
    city: '',
    stateCode: '',
    stateName: '',
    latitude: '',
    longitude: '',
    isComplete: false
  },
  {
    id: 'addr_correspondence',
    addressType: 'correspondence',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    postalCode: '',
    landmark: '',
    city: '',
    stateCode: '',
    stateName: '',
    latitude: '',
    longitude: '',
    isComplete: false
  }
];

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

  // Check if this section is already completed (checking if addresses exist in co-applicant data)
  const isCompleted = false; // Co-applicant flow usually allows editing until final submission, or we can check a specific flag if needed.

  const [addresses, setAddresses] = useState<Address[]>(INITIAL_ADDRESSES);
  const [expandedAddressId, setExpandedAddressId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pincodeLookupId, setPincodeLookupId] = useState<string | null>(null);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const suppressModalAutoOpenRef = useRef(false);

  const geolocation = useGeolocation({
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  });

  const locationCoords = useMemo(() => {
    const latitude = typeof geolocation.latitude === 'number' ? geolocation.latitude.toFixed(6) : '';
    const longitude = typeof geolocation.longitude === 'number' ? geolocation.longitude.toFixed(6) : '';
    return { latitude, longitude };
  }, [geolocation.latitude, geolocation.longitude]);

  const locationStatus = geolocation.loading ? 'pending' : geolocation.error ? 'error' : locationCoords.latitude ? 'success' : 'pending';
  const isLocationReady = locationStatus === 'success';
  const isInteractionDisabled = isCompleted;

  // Initialize addresses from co-applicant data
  useEffect(() => {
    if (coApplicant?.data?.addressDetails?.addresses) {
      const existingAddresses = coApplicant.data.addressDetails.addresses;
      setAddresses(prev => {
        const newAddresses = [...prev];
        existingAddresses.forEach((apiAddr: any) => {
          let targetType: 'residential' | 'permanent' | 'correspondence' | null = null;
          // Map API types to our types
          if (apiAddr.addressType === 'residential' || apiAddr.addressType === 'current') targetType = 'residential';
          else if (apiAddr.addressType === 'permanent') targetType = 'permanent';
          else if (apiAddr.addressType === 'correspondence') targetType = 'correspondence';

          if (targetType) {
            const index = newAddresses.findIndex(a => a.addressType === targetType);
            if (index !== -1) {
              newAddresses[index] = {
                ...newAddresses[index],
                addressLine1: apiAddr.addressLine1 || '',
                addressLine2: apiAddr.addressLine2 || '',
                addressLine3: apiAddr.addressLine3 || '',
                postalCode: apiAddr.postalCode || '',
                landmark: apiAddr.landmark || '',
                city: apiAddr.city || '',
                stateCode: apiAddr.stateCode || '',
                stateName: apiAddr.stateName || '',
                latitude: apiAddr.latitude || '',
                longitude: apiAddr.longitude || '',
                isComplete: true // Assume fetched addresses are complete
              };
            }
          }
        });
        return newAddresses;
      });
    }
  }, [coApplicant]);

  // Sync addresses when "Same As" source changes
  useEffect(() => {
    setAddresses(prev => {
      let changed = false;
      const newAddresses = prev.map(addr => {
        if (addr.sameAs) {
          const sourceAddr = prev.find(a => a.addressType === addr.sameAs);
          if (sourceAddr) {
            // Check if values are different
            if (
              addr.addressLine1 !== sourceAddr.addressLine1 ||
              addr.addressLine2 !== sourceAddr.addressLine2 ||
              addr.addressLine3 !== sourceAddr.addressLine3 ||
              addr.postalCode !== sourceAddr.postalCode ||
              addr.landmark !== sourceAddr.landmark ||
              addr.city !== sourceAddr.city ||
              addr.stateCode !== sourceAddr.stateCode ||
              addr.stateName !== sourceAddr.stateName
            ) {
              changed = true;
              return {
                ...addr,
                addressLine1: sourceAddr.addressLine1,
                addressLine2: sourceAddr.addressLine2,
                addressLine3: sourceAddr.addressLine3,
                postalCode: sourceAddr.postalCode,
                landmark: sourceAddr.landmark,
                city: sourceAddr.city,
                stateCode: sourceAddr.stateCode,
                stateName: sourceAddr.stateName,
                latitude: sourceAddr.latitude,
                longitude: sourceAddr.longitude,
                isComplete: sourceAddr.isComplete
              };
            }
          }
        }
        return addr;
      });
      return changed ? newAddresses : prev;
    });
  }, [addresses]);

  // Apply location coords to current address if empty
  useEffect(() => {
    if (isLocationReady && !isCompleted) {
      setAddresses(prev => prev.map(addr => {
        if (addr.addressType === 'residential' && !addr.latitude) {
          return { ...addr, latitude: locationCoords.latitude, longitude: locationCoords.longitude };
        }
        return addr;
      }));
    }
  }, [isLocationReady, locationCoords, isCompleted]);

  const handleAddressChange = (id: string, field: keyof Address, value: any) => {
    if (isInteractionDisabled) return;
    setAddresses(prev => prev.map(addr => {
      if (addr.id === id) {
        return { ...addr, [field]: value, isComplete: false };
      }
      return addr;
    }));
  };

  const handlePostalCodeChange = (id: string, rawValue: string) => {
    if (isInteractionDisabled) return;
    const numeric = rawValue.replace(/[^0-9]/g, '').slice(0, 6);

    setAddresses(prev => prev.map(addr => {
      if (addr.id === id) {
        return {
          ...addr,
          postalCode: numeric,
          city: numeric.length === 6 ? addr.city : '',
          stateCode: numeric.length === 6 ? addr.stateCode : '',
          stateName: numeric.length === 6 ? addr.stateName : '',
          isComplete: false
        };
      }
      return addr;
    }));

    if (numeric.length === 6) {
      void performPincodeLookup(id, numeric);
    }
  };

  const performPincodeLookup = async (id: string, zip: string) => {
    setPincodeLookupId(id);
    try {
      const response = await lookupPincode(zip);
      if (isApiError(response) || !response.success) throw new Error('Zipcode not found');

      setAddresses(prev => prev.map(addr => addr.id === id ? {
        ...addr,
        city: response.city ?? '',
        stateCode: response.state_code ?? '',
        stateName: response.state ?? ''
      } : addr));
    } catch {
      toast({ title: 'Zipcode not found', description: 'Please check the pincode and try again.', variant: 'destructive' });
    } finally {
      setPincodeLookupId(null);
    }
  };

  const handleSameAsChange = (id: string, source: string) => {
    if (source === 'none') {
      setAddresses(prev => prev.map(addr => addr.id === id ? { ...addr, sameAs: undefined } : addr));
      return;
    }

    const sourceAddr = addresses.find(a => a.addressType === source);
    if (sourceAddr) {
      setAddresses(prev => prev.map(addr => addr.id === id ? {
        ...addr,
        sameAs: source as any,
        addressLine1: sourceAddr.addressLine1,
        addressLine2: sourceAddr.addressLine2,
        addressLine3: sourceAddr.addressLine3,
        postalCode: sourceAddr.postalCode,
        landmark: sourceAddr.landmark,
        city: sourceAddr.city,
        stateCode: sourceAddr.stateCode,
        stateName: sourceAddr.stateName,
        latitude: sourceAddr.latitude,
        longitude: sourceAddr.longitude,
        isComplete: sourceAddr.isComplete
      } : addr));
    }
  };

  const handleSaveAddress = (id: string) => {
    const address = addresses.find(a => a.id === id);
    if (!address) return;

    // Validation
    if (!address.addressLine1 || !address.postalCode || !address.city || !address.stateCode || !address.landmark) {
      toast({ title: 'Missing Fields', description: 'Please fill all required fields (Address Line 1, Pincode, Landmark).', variant: 'destructive' });
      return;
    }

    setAddresses(prev => prev.map(addr => addr.id === id ? { ...addr, isComplete: true } : addr));
    setExpandedAddressId(null); // Collapse after save
    toast({ title: 'Address Saved', description: 'Address details saved locally.', className: 'bg-green-50 border-green-200' });
  };

  const handleSaveInformation = async () => {
    if (!currentLead?.appId || !coApplicantId || !coApplicant) return;
    if (!isLocationReady) {
      toast({ title: 'Location Required', description: 'Please allow location access.', variant: 'destructive' });
      return;
    }

    const allComplete = addresses.every(a => a.isComplete);
    if (!allComplete) {
      toast({ title: 'Incomplete', description: 'Please complete and save all 3 addresses.', variant: 'destructive' });
      return;
    }

    const coApplicants = currentLead.formData?.coApplicants ?? [];
    const coApplicantIndex = coApplicants.findIndex(ca => ca.id === coApplicantId);

    if (coApplicantIndex < 0) {
      toast({ title: 'Co-applicant missing', description: 'Could not determine the co-applicant index.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const backendAddresses = addresses.map(addr => ({
        address_type: addr.addressType,
        address_line_1: addr.addressLine1,
        address_line_2: addr.addressLine2,
        address_line_3: addr.addressLine3,
        landmark: addr.landmark,
        pincode: addr.postalCode,
        latitude: addr.latitude || locationCoords.latitude || '-90',
        longitude: addr.longitude || locationCoords.longitude || '90',
        city: addr.city,
        state: addr.stateName,
        state_code: addr.stateCode,
        is_primary: addr.addressType === 'residential'
      }));

      const response = await submitCoApplicantAddressDetails({
        application_id: currentLead.appId,
        co_applicant_index: coApplicantIndex,
        addresses: backendAddresses,
      });

      if (isApiError(response)) throw new Error(response.error);

      updateCoApplicant(currentLead.id, coApplicantId, {
        relationship: coApplicant.relationship,
        data: {
          ...coApplicant.data,
          addressDetails: {
            ...(coApplicant.data?.addressDetails ?? {}),
            addresses: addresses
          },
        },
      });

      toast({ title: 'Success', description: 'Co-applicant address details saved successfully.', className: 'bg-green-50 border-green-200' });
      router.push('/lead/co-applicant-info');
    } catch (error: any) {
      toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const getAddressTitle = (type: string) => {
    switch (type) {
      case 'residential': return 'Current Address';
      case 'permanent': return 'Permanent Address';
      case 'correspondence': return 'Correspondence Address';
      default: return type;
    }
  };

  const isAddressEditable = (type: string) => {
    if (type === 'residential') return true;
    const currentAddr = addresses.find(a => a.addressType === 'residential');
    return currentAddr?.isComplete;
  };

  const getAddressSummary = (address: Address) => {
    if (!address.addressLine1) return "No Address added Yet";
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.addressLine3,
      address.landmark,
      address.city,
      address.stateName,
      address.postalCode
    ].filter(Boolean);
    return parts.join(', ');
  };

  if (!currentLead || !coApplicant) {
    return null;
  }

  return (
    <DashboardLayout
      title="Co-Applicant Address Details"
      showNotifications={false}
      showExitButton={true}
      onExit={() => router.push('/lead/co-applicant-info')}
    >
      <div className="max-w-2xl mx-auto pb-28 px-4">
        <div className="space-y-4">
          {addresses.map((address) => {
            const isExpanded = expandedAddressId === address.id;
            const isEditable = isAddressEditable(address.addressType);
            const isLocked = address.sameAs !== undefined;

            let statusText = 'No Data';
            let statusColor = 'bg-gray-100 text-gray-600 border-gray-200';

            if (address.isComplete) {
              statusText = 'Completed';
              statusColor = 'bg-green-50 text-green-700 border-green-200';
            } else if (address.addressLine1) {
              statusText = 'In Progress';
              statusColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
            }

            return (
              <div key={address.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4">
                  {/* Row 1: Icon, Title, Badge, Edit Button */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 text-gray-500">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <h3 className="font-medium text-gray-900">{getAddressTitle(address.addressType)}</h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn("text-[10px] h-6 px-2", statusColor)}>
                        {statusText}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!isEditable || isCompleted}
                        onClick={() => setExpandedAddressId(isExpanded ? null : address.id)}
                        className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Row 2: Address Summary (only if collapsed) */}
                  {!isExpanded && (
                    <div className="pl-8">
                      <p className="text-sm text-gray-500">
                        {getAddressSummary(address)}
                      </p>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-gray-100 space-y-4">
                    {/* Same As Dropdown */}
                    {address.addressType !== 'residential' && (
                      <div className="mb-4">
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">Same As</Label>
                        <Select
                          value={address.sameAs || 'none'}
                          onValueChange={(val) => handleSameAsChange(address.id, val)}
                          disabled={isCompleted}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select address to copy" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (Enter manually)</SelectItem>
                            <SelectItem value="residential">Current Address</SelectItem>
                            {address.addressType === 'permanent' && addresses.find(a => a.addressType === 'correspondence')?.isComplete && (
                              <SelectItem value="correspondence">Correspondence Address</SelectItem>
                            )}
                            {address.addressType === 'correspondence' && addresses.find(a => a.addressType === 'permanent')?.isComplete && (
                              <SelectItem value="permanent">Permanent Address</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-[#003366] mb-2 block">Address Line 1 *</Label>
                        <Input
                          value={address.addressLine1}
                          onChange={(e) => handleAddressChange(address.id, 'addressLine1', e.target.value)}
                          placeholder="House No., Building Name"
                          disabled={isLocked || isCompleted}
                          className={cn(isLocked && "bg-gray-50")}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-[#003366] mb-2 block">Address Line 2</Label>
                        <Input
                          value={address.addressLine2}
                          onChange={(e) => handleAddressChange(address.id, 'addressLine2', e.target.value)}
                          placeholder="Street, Area"
                          disabled={isLocked || isCompleted}
                          className={cn(isLocked && "bg-gray-50")}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-[#003366] mb-2 block">Address Line 3</Label>
                        <Input
                          value={address.addressLine3}
                          onChange={(e) => handleAddressChange(address.id, 'addressLine3', e.target.value)}
                          placeholder="Additional details"
                          disabled={isLocked || isCompleted}
                          className={cn(isLocked && "bg-gray-50")}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-[#003366] mb-2 block">Landmark *</Label>
                        <Input
                          value={address.landmark}
                          onChange={(e) => handleAddressChange(address.id, 'landmark', e.target.value)}
                          placeholder="Near..."
                          disabled={isLocked || isCompleted}
                          className={cn(isLocked && "bg-gray-50")}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-[#003366] mb-2 block">Pincode *</Label>
                        <div className={cn(
                          "flex items-center h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent transition-all",
                          (isLocked || isCompleted) && "bg-gray-50 opacity-50 cursor-not-allowed"
                        )}>
                          <input
                            value={address.postalCode}
                            onChange={(e) => handlePostalCodeChange(address.id, e.target.value)}
                            placeholder="000000"
                            maxLength={6}
                            disabled={isLocked || isCompleted}
                            className="flex-1 bg-transparent border-none outline-none placeholder:text-gray-400 w-full min-w-0"
                          />
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {pincodeLookupId === address.id && (
                              <Loader className="w-4 h-4 animate-spin text-blue-600" />
                            )}
                            {(address.city || address.stateCode) && (
                              <span className="text-green-600 font-medium whitespace-nowrap">
                                {address.city}, {address.stateCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button
                        onClick={() => handleSaveAddress(address.id)}
                        disabled={isLocked || isCompleted}
                        className="w-full bg-[#0072CE] hover:bg-[#005a9e]"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Address
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-10">
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={handleSaveInformation}
            disabled={!addresses.every(a => a.isComplete) || isSaving || isCompleted}
            className="w-full h-12 rounded-xl bg-[#0072CE] hover:bg-[#005a9e] text-white font-semibold shadow-lg shadow-blue-200 disabled:shadow-none"
          >
            {isSaving ? (
              <>
                <Loader className="w-5 h-5 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Information'
            )}
          </Button>
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
