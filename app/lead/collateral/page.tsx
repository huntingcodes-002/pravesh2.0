'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Loader, AlertTriangle } from 'lucide-react';
import { useGeolocation } from '@uidotdev/usehooks';
import { lookupPincode, isApiError, getAccessToken } from '@/lib/api';
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
import { cn } from '@/lib/utils';

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
    ownershipType: currentLead?.formData?.step6?.ownershipType || 'self_ownership',
    currency: 'INR',
    propertyValue: currentLead?.formData?.step6?.propertyValue || '',
    description: currentLead?.formData?.step6?.description || '',
    addressLine1: currentLead?.formData?.step6?.addressLine1 || currentLead?.formData?.step6?.location?.address_line_1 || '',
    addressLine2: currentLead?.formData?.step6?.addressLine2 || currentLead?.formData?.step6?.location?.address_line_2 || '',
    addressLine3: currentLead?.formData?.step6?.addressLine3 || currentLead?.formData?.step6?.location?.address_line_3 || '',
    landmark: currentLead?.formData?.step6?.landmark || currentLead?.formData?.step6?.location?.landmark || '',
    pincode: currentLead?.formData?.step6?.pincode || currentLead?.formData?.step6?.location?.pincode || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [pincodeLookupId, setPincodeLookupId] = useState<string | null>(null);
  const [city, setCity] = useState(currentLead?.formData?.step6?.city || '');
  const [stateCode, setStateCode] = useState(currentLead?.formData?.step6?.stateCode || '');
  const [stateName, setStateName] = useState(currentLead?.formData?.step6?.stateName || '');
  
  // Geolocation state
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const suppressModalAutoOpenRef = useRef(false);
  const geolocation = useGeolocation({
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  });

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
    if (currentLead?.formData?.step6) {
      const step6 = currentLead.formData.step6;
      // Handle legacy ownership type values for backward compatibility
      let ownershipType = step6.ownershipType || 'self_ownership';
      if (ownershipType === 'selfOwnership') {
        ownershipType = 'self_ownership';
      } else if (ownershipType === 'jointOwnership') {
        ownershipType = 'joint_ownership';
      }
      
      setFormData({
        collateralType: step6.collateralType || 'property',
        collateralSubType: step6.collateralSubType || '',
        ownershipType: ownershipType,
        currency: 'INR',
        propertyValue: step6.propertyValue || '',
        description: step6.description || '',
        addressLine1: step6.addressLine1 || step6.location?.address_line_1 || '',
        addressLine2: step6.addressLine2 || step6.location?.address_line_2 || '',
        addressLine3: step6.addressLine3 || step6.location?.address_line_3 || '',
        landmark: step6.landmark || step6.location?.landmark || '',
        pincode: step6.pincode || step6.location?.pincode || '',
      });
      setCity(step6.city || '');
      setStateCode(step6.stateCode || '');
      setStateName(step6.stateName || '');
    }
  }, [currentLead]);

  useEffect(() => {
    if (locationStatus !== 'error') {
      lastLocationErrorRef.current = null;
      return;
    }

    const description =
      locationErrorMessage ?? 'Unable to fetch your current location. Please allow access and try again.';

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
  }, [toast]);

  const handlePincodeChange = (rawValue: string) => {
    if (isInteractionDisabled) return;
    const numeric = rawValue.replace(/[^0-9]/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, pincode: numeric }));
    
    if (numeric.length === 6) {
      void performPincodeLookup(numeric);
    } else {
      setCity('');
      setStateCode('');
      setStateName('');
      setPincodeLookupId(null);
    }
  };

  const performPincodeLookup = async (zip: string) => {
    setPincodeLookupId('collateral-pincode');
    try {
      const response = await lookupPincode(zip);
      if (isApiError(response) || !response.success) {
        throw new Error('Zipcode not found');
      }

      const data = response;
      setCity(data.city ?? '');
      setStateCode(data.state_code ?? '');
      setStateName(data.state ?? '');
    } catch {
      setCity('');
      setStateCode('');
      setStateName('');
      toast({
        title: 'Zipcode not found',
        description: 'Please check the pincode and try again.',
        variant: 'destructive',
      });
    } finally {
      setPincodeLookupId(null);
    }
  };

  const setField = (key: string, value: string | number) => {
    if (isInteractionDisabled) return;
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const API_URL = 'https://uatlb.api.saarathifinance.com/api/lead-collection/applications/collateral-details/';

  const handleSave = async () => {
    if (!currentLead || isSaving) return;

    if (!isLocationReady) {
      toast({
        title: 'Location Required',
        description: 'Please allow location access so we can capture your current coordinates.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.propertyValue) {
      toast({
        title: 'Property value required',
        description: 'Please enter the estimated property value.',
        variant: 'destructive',
      });
      return;
    }

    const numericValue = parseFloat(String(formData.propertyValue));
    if (!Number.isFinite(numericValue) || numericValue <= 100000) {
      toast({
        title: 'Invalid property value',
        description: 'Please enter a valid property value greater than ₹1,00,000.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.addressLine1 || !formData.landmark || !formData.pincode || formData.pincode.length !== 6) {
      toast({
        title: 'Incomplete address',
        description: 'Please fill in all required address fields (Address Line 1, Landmark, and Pincode).',
        variant: 'destructive',
      });
      return;
    }

    const token = getAccessToken();
    if (!token) {
      toast({
        title: 'Authentication required',
        description: 'Your session has expired. Please sign in again to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const payload = {
      application_id: currentLead.appId,
      collateral_type: formData.collateralType || 'property',
      ownership_type: formData.ownershipType || 'self_ownership',
      estimated_property_value: String(numericValue),
      collateral_description: formData.description || '',
      location: {
        address_line_1: formData.addressLine1.trim(),
        address_line_2: formData.addressLine2.trim() || '',
        address_line_3: formData.addressLine3.trim() || '',
        landmark: formData.landmark.trim(),
        pincode: formData.pincode.trim(),
        latitude: locationCoords.latitude || '90',
        longitude: locationCoords.longitude || '90',
      },
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
            collateralType: formData.collateralType || 'property',
            ownershipType: formData.ownershipType || 'self_ownership',
            propertyValue: formData.propertyValue,
            description: formData.description,
            addressLine1: formData.addressLine1,
            addressLine2: formData.addressLine2,
            addressLine3: formData.addressLine3,
            landmark: formData.landmark,
            pincode: formData.pincode,
            city,
            stateCode,
            stateName,
            location: {
              address_line_1: formData.addressLine1,
              address_line_2: formData.addressLine2,
              address_line_3: formData.addressLine3,
              landmark: formData.landmark,
              pincode: formData.pincode,
              latitude: locationCoords.latitude,
              longitude: locationCoords.longitude,
            },
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
                  disabled={isInteractionDisabled}
                >
                  <SelectTrigger id="collateralType" className={cn("h-12", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}>
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
                    disabled={isInteractionDisabled}
                  >
                    <SelectTrigger id="collateralSubType" className={cn("h-12", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}>
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
                  disabled={isInteractionDisabled}
                >
                  <SelectTrigger id="ownershipType" className={cn("h-12", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}>
                    <SelectValue placeholder="Select ownership type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self_ownership">Self Ownership</SelectItem>
                    <SelectItem value="joint_ownership">Joint Ownership</SelectItem>
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
                    disabled={isInteractionDisabled}
                    className={cn("h-12 rounded-l-none", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}
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
                  disabled={isInteractionDisabled}
                  className={cn("min-h-[100px]", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}
                />
                <p className="text-xs text-gray-500 mt-1">Optional: Provide additional details about the collateral</p>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-[#003366]">Collateral Location</h3>
                
                <div>
                  <Label htmlFor="addressLine1">
                    Address Line 1 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="addressLine1"
                    type="text"
                    value={formData.addressLine1}
                    onChange={(e) => setField('addressLine1', e.target.value)}
                    placeholder="House/Flat No., Building Name"
                    disabled={isInteractionDisabled}
                    className={cn("h-12", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}
                    maxLength={255}
                  />
                </div>

                <div>
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input
                    id="addressLine2"
                    type="text"
                    value={formData.addressLine2}
                    onChange={(e) => setField('addressLine2', e.target.value)}
                    placeholder="Street Name, Area"
                    disabled={isInteractionDisabled}
                    className={cn("h-12", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}
                    maxLength={255}
                  />
                </div>

                <div>
                  <Label htmlFor="addressLine3">Address Line 3</Label>
                  <Input
                    id="addressLine3"
                    type="text"
                    value={formData.addressLine3}
                    onChange={(e) => setField('addressLine3', e.target.value)}
                    placeholder="Block / Locality"
                    disabled={isInteractionDisabled}
                    className={cn("h-12", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}
                    maxLength={255}
                  />
                </div>

                <div>
                  <Label htmlFor="landmark">
                    Landmark <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="landmark"
                    type="text"
                    value={formData.landmark}
                    onChange={(e) => setField('landmark', e.target.value)}
                    placeholder="Nearby landmark"
                    disabled={isInteractionDisabled}
                    className={cn("h-12", isInteractionDisabled && "bg-gray-50 cursor-not-allowed")}
                    maxLength={255}
                  />
                </div>

                <div>
                  <Label htmlFor="pincode">
                    Postal Code <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="pincode"
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => handlePincodeChange(e.target.value)}
                      placeholder="Enter 6-digit postal code"
                      disabled={isInteractionDisabled}
                      className={cn(
                        'h-12 rounded-lg',
                        (pincodeLookupId || city || stateCode) && 'pr-28',
                        isInteractionDisabled && 'bg-gray-50 cursor-not-allowed'
                      )}
                      maxLength={6}
                    />
                    {(pincodeLookupId || city || stateCode) && (
                      <div className="absolute inset-y-0 right-3 flex items-center gap-2 pointer-events-none">
                        {pincodeLookupId && <Loader className="w-4 h-4 animate-spin text-[#0072CE]" />}
                        {city && stateCode && !pincodeLookupId && (
                          <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                            {city} {stateCode}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={isSaving || !isLocationReady}
              className={cn(
                "flex-1 h-12 rounded-lg font-medium text-white",
                isSaving || !isLocationReady
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-[#0072CE] hover:bg-[#005a9e]"
              )}
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

      <AlertDialog open={isPermissionModalOpen} onOpenChange={setIsPermissionModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
              <AlertDialogTitle>Location Access Required</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Please allow location access in your browser settings to capture your GPS coordinates. This is required to proceed with the collateral details submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetryPermission}>
              Try Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
