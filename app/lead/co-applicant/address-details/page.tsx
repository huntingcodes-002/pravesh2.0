'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Loader, AlertTriangle } from 'lucide-react';
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
  latitude: string;
  longitude: string;
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
  latitude: '',
  longitude: '',
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
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const geolocation = useGeolocation({
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  });
  const suppressModalAutoOpenRef = useRef(false);

  const locationCoords = useMemo(() => {
    const latitude =
      typeof geolocation.latitude === 'number' ? geolocation.latitude.toFixed(6) : '';
    const longitude =
      typeof geolocation.longitude === 'number' ? geolocation.longitude.toFixed(6) : '';

    return { latitude, longitude };
  }, [geolocation.latitude, geolocation.longitude]);

  const locationErrorMessage = useMemo(() => {
    if (!geolocation.error) return null;

    if (typeof geolocation.error === 'string') {
      return geolocation.error;
    }

    if (
      typeof geolocation.error === 'object' &&
      geolocation.error !== null &&
      'message' in geolocation.error &&
      typeof (geolocation.error as { message?: string }).message === 'string'
    ) {
      return (geolocation.error as { message: string }).message;
    }

    if (
      typeof geolocation.error === 'object' &&
      geolocation.error !== null &&
      'code' in geolocation.error &&
      typeof (geolocation.error as { code?: number }).code === 'number'
    ) {
      const code = (geolocation.error as { code: number }).code;
      switch (code) {
        case 1:
          return 'Location permission is required. Please allow access from your browser settings.';
        case 2:
          return 'Location information is unavailable. Please ensure GPS or precise location is enabled.';
        case 3:
          return 'Fetching location timed out. Please try again.';
        default:
          break;
      }
    }

    return 'Unable to fetch your current location. Please allow access and try again.';
  }, [geolocation.error]);

  const applyCoordsToAddresses = useCallback((latitude: string, longitude: string) => {
    if (!latitude || !longitude) return;

    setAddresses(prev => {
      let changed = false;

      const updated = prev.map(addr => {
        if (addr.latitude === latitude && addr.longitude === longitude) {
          return addr;
        }

        changed = true;
        return {
          ...addr,
          latitude,
          longitude,
        };
      });

      return changed ? updated : prev;
    });
  }, []);

  const locationStatus = geolocation.loading
    ? 'pending'
    : geolocation.error
      ? 'error'
      : locationCoords.latitude && locationCoords.longitude
        ? 'success'
        : 'pending';

  const isLocationReady = locationStatus === 'success';
  const isInteractionDisabled = !isLocationReady;
  const lastLocationErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentLead || !coApplicant || !coApplicantId) {
      router.replace('/lead/co-applicant-info');
    }
  }, [currentLead, coApplicant, coApplicantId, router]);

  useEffect(() => {
    if (locationStatus !== 'error') {
      lastLocationErrorRef.current = null;
      return;
    }

    const description =
      locationErrorMessage ?? 'Unable to fetch your current location. Please allow access to continue.';

    if (lastLocationErrorRef.current === description) {
      return;
    }

    toast({
      title: 'Location Required',
      description,
      variant: 'destructive',
    });

    lastLocationErrorRef.current = description;
  }, [locationStatus, locationErrorMessage, toast]);

  useEffect(() => {
    if (locationStatus === 'error') {
      if (!suppressModalAutoOpenRef.current) {
        setIsPermissionModalOpen(true);
      }
    } else {
      setIsPermissionModalOpen(false);
      suppressModalAutoOpenRef.current = false;
    }
  }, [locationStatus]);

  useEffect(() => {
    if (!isLocationReady) {
      return;
    }

    applyCoordsToAddresses(locationCoords.latitude, locationCoords.longitude);
  }, [isLocationReady, locationCoords.latitude, locationCoords.longitude, applyCoordsToAddresses]);

  const setPrimaryAddress = (id: string) => {
    if (isInteractionDisabled) return;
    setAddresses(prev =>
      prev.map(addr => ({
        ...addr,
        isPrimary: addr.id === id,
      }))
    );
  };

  const handleAddressChange = <K extends keyof Address>(id: string, field: K, value: Address[K]) => {
    if (isInteractionDisabled) return;
    setAddresses(prev => prev.map(addr => (addr.id === id ? { ...addr, [field]: value } : addr)));
  };

const handlePostalCodeChange = (id: string, rawValue: string) => {
  if (isInteractionDisabled) return;
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
    if (isInteractionDisabled) return;
    setCollapsedAddresses(new Set(addresses.map((addr: Address) => addr.id)));
    setAddresses(prev => [
      ...prev,
      {
        ...createEmptyAddress(),
        isPrimary: prev.length === 0,
        latitude: locationCoords.latitude || '',
        longitude: locationCoords.longitude || '',
      },
    ]);
  };

  const handleRetryPermission = useCallback(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      toast({
        title: 'Location Unsupported',
        description: 'Geolocation is not supported on this device. Please try a different browser or device.',
        variant: 'destructive',
      });
      return;
    }

    suppressModalAutoOpenRef.current = true;
    setIsPermissionModalOpen(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = typeof position.coords.latitude === 'number' ? position.coords.latitude.toFixed(6) : '';
        const longitude = typeof position.coords.longitude === 'number' ? position.coords.longitude.toFixed(6) : '';

        applyCoordsToAddresses(latitude, longitude);
        suppressModalAutoOpenRef.current = false;
      },
      (error) => {
        suppressModalAutoOpenRef.current = false;

        const description =
          error?.message || 'Unable to fetch your current location. Please allow access in your browser settings.';

        toast({
          title: 'Location Required',
          description,
          variant: 'destructive',
        });

        setIsPermissionModalOpen(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  }, [applyCoordsToAddresses, toast]);

  const handleRemoveAddress = (id: string) => {
    if (isInteractionDisabled) return;
    setAddresses(prev => {
      const remaining = prev.filter(addr => addr.id !== id);
      if (remaining.length === 0) {
        return [{ ...createEmptyAddress(), isPrimary: true, latitude: locationCoords.latitude || '', longitude: locationCoords.longitude || '' }];
      }
      if (!remaining.some((addr: Address) => addr.isPrimary)) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }
      return remaining;
    });
  };

  const requiredFieldsFilled = isLocationReady && addresses.every(
    addr =>
      addr.addressType &&
      addr.addressLine1 &&
      addr.landmark &&
      addr.postalCode &&
      addr.postalCode.length === 6
  );

  const handleSave = async () => {
    if (!currentLead || !coApplicantId || !coApplicant) return;
    if (!isLocationReady) {
      toast({
        title: 'Location Required',
        description: 'Please allow location access so we can capture your current coordinates.',
        variant: 'destructive',
      });
      return;
    }
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
      latitude: addr.latitude || locationCoords.latitude || '90',
      longitude: addr.longitude || locationCoords.longitude || '90',
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
            addresses: addresses.map(({ latitude, longitude, ...rest }) => rest),
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

  const handlePermissionModalChange = useCallback(
    (open: boolean) => {
      if (!open && locationStatus === 'error' && !suppressModalAutoOpenRef.current) {
        setIsPermissionModalOpen(true);
        return;
      }

      setIsPermissionModalOpen(open);
    },
    [locationStatus]
  );

  return (
    <DashboardLayout
      title="Co-Applicant Address Details"
      showNotifications={false}
      showExitButton
      onExit={() => router.push('/lead/co-applicant-info')}
    >
      <AlertDialog open={isPermissionModalOpen} onOpenChange={handlePermissionModalChange}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[#003366]">
              <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
              Location Access Required
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#4B5563]">
              Please allow location access in your browser settings so we can capture accurate address coordinates for this co-applicant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-3">
            <AlertDialogAction
              onClick={handleRetryPermission}
              className="w-full sm:w-auto bg-[#0072CE] hover:bg-[#005a9e]"
            >
              Try Again
            </AlertDialogAction>
            <AlertDialogCancel className="w-full sm:w-auto">
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-2xl mx-auto pb-24">
        <div
          className={cn(
            'mb-4 p-4 rounded-xl border transition-colors',
            locationStatus === 'pending' && 'bg-blue-50 border-blue-200',
            locationStatus === 'success' && 'bg-emerald-50 border-emerald-200',
            locationStatus === 'error' && 'bg-red-50 border-red-200'
          )}
        >
          <p className="text-sm font-semibold text-[#003366]">Location Access Required</p>
          {locationStatus === 'pending' && (
            <p className="mt-1 text-sm text-[#003366]">
              Requesting your current GPS coordinates. Please allow location access in the popup to continue.
            </p>
          )}
          {locationStatus === 'success' && (
            <>
              <p className="mt-1 text-sm text-[#003366]">
                Location captured successfully. You can now fill in the co-applicant address details.
              </p>
              <p className="mt-2 text-xs text-gray-600">
                Latitude: <span className="font-mono">{locationCoords.latitude}</span> · Longitude:{' '}
                <span className="font-mono">{locationCoords.longitude}</span>
              </p>
            </>
          )}
          {locationStatus === 'error' && (
            <>
              <p className="mt-1 text-sm text-[#8B0000]">
                We need location permission to proceed. Please allow access when prompted.
              </p>
              {locationErrorMessage && (
                <p className="mt-2 text-xs text-[#8B0000]">
                  {locationErrorMessage} If you previously denied the request, enable location access in your browser settings and we
                  will keep asking.
                </p>
              )}
            </>
          )}
        </div>

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
                            disabled={isInteractionDisabled}
                          >
                            <SelectTrigger className={cn("h-12 rounded-lg", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}>
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
                            disabled={isInteractionDisabled}
                            className={cn("h-12 rounded-lg", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}
                            maxLength={255}
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-[#003366] mb-2 block">Address Line 2</Label>
                          <Input
                            value={address.addressLine2}
                            onChange={e => handleAddressChange(address.id, 'addressLine2', e.target.value)}
                            placeholder="Street Name, Area"
                            disabled={isInteractionDisabled}
                            className={cn("h-12 rounded-lg", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}
                            maxLength={255}
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-[#003366] mb-2 block">Address Line 3</Label>
                          <Input
                            value={address.addressLine3}
                            onChange={e => handleAddressChange(address.id, 'addressLine3', e.target.value)}
                            placeholder="Block / Locality"
                            disabled={isInteractionDisabled}
                            className={cn("h-12 rounded-lg", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}
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
                            disabled={isInteractionDisabled}
                            className={cn("h-12 rounded-lg", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}
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
                              disabled={isInteractionDisabled}
                              className={cn(
                                'h-12 rounded-lg',
                                (pincodeLookupId === address.id || address.city || address.stateCode) && 'pr-28',
                                isInteractionDisabled && 'bg-gray-50 cursor-not-allowed'
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

                        <div className={cn("flex items-center justify-between p-4 bg-gray-50 rounded-lg border", isInteractionDisabled && "opacity-60")}>
                          <Label className="text-base font-medium">Mark as Primary Address</Label>
                          <Switch checked={address.isPrimary} onCheckedChange={() => setPrimaryAddress(address.id)} disabled={isInteractionDisabled} />
                        </div>

                        {addresses.length > 1 && !isInteractionDisabled && (
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
              className={cn(
                "w-full h-12 text-[#0072CE] border-dashed border-[#0072CE]/50 hover:bg-[#E6F0FA] rounded-lg font-medium",
                isInteractionDisabled && "text-gray-400 border-gray-300 hover:bg-white cursor-not-allowed"
              )}
                onClick={handleAddAddress}
              disabled={isInteractionDisabled}
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
              disabled={isInteractionDisabled || !requiredFieldsFilled || isSaving}
              className={cn(
                "w-full h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white",
                (isInteractionDisabled || !requiredFieldsFilled || isSaving) && "opacity-80 cursor-not-allowed"
              )}
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

