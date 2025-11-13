'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertTriangle, Loader, Edit, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { submitPersonalInfo, isApiError, getDetailedInfo, type PersonalInfoResponse } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { CheckCircle2 } from 'lucide-react';
import { MaskedDateInput } from '@/components/MaskedDateInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ValidationStatus = 'pending' | 'valid' | 'invalid' | 'mismatch';

function NameEditDialog({ 
    isOpen, 
    setIsOpen, 
    currentFirstName, 
    currentLastName, 
    currentMismatchReason,
    onSave 
}: { 
    isOpen: boolean, 
    setIsOpen: (open: boolean) => void, 
    currentFirstName: string, 
    currentLastName: string, 
    currentMismatchReason: string,
    onSave: (newFirstName: string, newLastName: string, mismatchReason: string) => void 
}) {
    const [firstName, setFirstName] = useState(currentFirstName);
    const [lastName, setLastName] = useState(currentLastName);
    const [mismatchReason, setMismatchReason] = useState(currentMismatchReason);
    
    useEffect(() => {
        setFirstName(currentFirstName);
        setLastName(currentLastName);
        setMismatchReason(currentMismatchReason);
    }, [currentFirstName, currentLastName, currentMismatchReason, isOpen]);
    
    const handleCancel = () => {
        setFirstName(currentFirstName);
        setLastName(currentLastName);
        setMismatchReason(currentMismatchReason);
        setIsOpen(false);
    };

    const handleSave = () => {
        const reason = mismatchReason.trim();
        onSave(firstName, lastName, reason);
        setIsOpen(false);
    };

    const isNameChanged = firstName !== currentFirstName || lastName !== currentLastName;
    const isReasonChanged = mismatchReason.trim() !== currentMismatchReason.trim();
    const canSave = isNameChanged || isReasonChanged;

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center text-[#003366]">
                       <Edit className="w-5 h-5 mr-2" /> Update Customer Name
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Update the customer&apos;s name. If a PAN mismatch occurs, you can optionally provide a reason.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                         <div>
                            <Label htmlFor="edit-first-name" className="text-sm font-medium text-[#003366] mb-2 block">First Name</Label>
                            <Input 
                                id="edit-first-name" 
                                value={firstName} 
                                onChange={e => setFirstName(e.target.value)} 
                                placeholder="Enter First Name" 
                                className="h-10 rounded-lg"
                                maxLength={100}
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-last-name" className="text-sm font-medium text-[#003366] mb-2 block">Last Name</Label>
                            <Input 
                                id="edit-last-name" 
                                value={lastName} 
                                onChange={e => setLastName(e.target.value)} 
                                placeholder="Enter Last Name" 
                                className="h-10 rounded-lg"
                                maxLength={50}
                            />
                        </div>
                    </div>
                    
                    <div className="pt-2">
                        <Label htmlFor="mismatch-reason" className="text-sm font-medium text-[#003366] mb-2 block">Reason for Name Difference (Optional)</Label>
                        <Textarea 
                            id="mismatch-reason" 
                            value={mismatchReason} 
                            onChange={e => setMismatchReason(e.target.value)} 
                            placeholder="e.g., Name change post marriage, short name usage..." 
                            rows={2} 
                            className="rounded-lg"
                            maxLength={255}
                        />
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel asChild><Button variant="outline" onClick={handleCancel}>Cancel</Button></AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button 
                            onClick={handleSave} 
                            disabled={!canSave}
                            className={cn(canSave ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300')}
                        >
                            Save Changes
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function Step2Page() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  const { toast } = useToast();
  
  // Check if this section is already completed
  const isCompleted = currentLead?.step2Completed === true;
  
  const [formData, setFormData] = useState({
    customerType: 'individual',
    hasPan: currentLead?.formData?.step2?.hasPan || 'yes',
    pan: currentLead?.panNumber || '',
    panUnavailabilityReason: currentLead?.formData?.step2?.panUnavailabilityReason || '',
    panUnavailabilityNotes: currentLead?.formData?.step2?.panUnavailabilityNotes || '',
    alternateIdType: currentLead?.formData?.step2?.alternateIdType || '',
    documentNumber: currentLead?.formData?.step2?.documentNumber || '',
    dob: currentLead?.dob || '',
    age: currentLead?.age || 0,
    gender: currentLead?.gender || '',
    email: currentLead?.formData?.step2?.email || '',
    maritalStatus: currentLead?.formData?.step2?.maritalStatus || '',
  });

  // Helper function to convert YYYY-MM-DD to DD/MM/YYYY format
  const convertISOToDDMMYYYY = (dobString: string): string => {
    if (!dobString) return '';
    try {
      const date = new Date(dobString);
      if (isNaN(date.getTime())) return '';
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  // Helper function to convert DD/MM/YYYY to YYYY-MM-DD format
  const convertDDMMYYYYToISO = (dateStr: string): string => {
    if (!dateStr) return '';
    
    // If already in ISO format (YYYY-MM-DD), return as is
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    // If in DD/MM/YYYY format (e.g., "24/08/2002"), convert to YYYY-MM-DD
    const slashMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return `${year}-${month}-${day}`;
    }
    
    return dateStr; // Return as-is if conversion fails
  };

  // State for formatted DOB input in DD/MM/YYYY format
  const [dobFormatted, setDobFormatted] = useState(convertISOToDDMMYYYY(currentLead?.dob || ''));

  const [panValidationStatus, setPanValidationStatus] = useState<ValidationStatus>('pending');
  const [panApiName, setPanApiName] = useState('');
  const [nameMismatchReason, setNameMismatchReason] = useState(currentLead?.formData?.step2?.nameMismatchReason || '');
  const [isPanTouched, setIsPanTouched] = useState(false);
  const [isVerifyingPan, setIsVerifyingPan] = useState(false);
  const [panValidationError, setPanValidationError] = useState('');
  const [dobMismatch, setDobMismatch] = useState(false);
  const [nameMismatch, setNameMismatch] = useState(false);
  const [isPanValidated, setIsPanValidated] = useState(currentLead?.step2Completed === true);
  const [panValidationMessage, setPanValidationMessage] = useState('');
  const [lastValidationResponse, setLastValidationResponse] = useState<PersonalInfoResponse['data'] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isNameEditOpen, setIsNameEditOpen] = useState(false);
  const [localFirstName, setLocalFirstName] = useState(currentLead?.customerFirstName || '');
  const [localLastName, setLocalLastName] = useState(currentLead?.customerLastName || '');
  const [isLoadingOcrData, setIsLoadingOcrData] = useState(false);
  const hasFetchedOcrData = useRef<string | null>(null);
  const [isAutoFilledViaPAN, setIsAutoFilledViaPAN] = useState(currentLead?.formData?.step2?.autoFilledViaPAN || false);
  const [isAutoFilledViaAadhaar, setIsAutoFilledViaAadhaar] = useState(currentLead?.formData?.step2?.autoFilledViaAadhaar || false);

  const isReadOnly = isCompleted || (formData.hasPan === 'yes' && isPanValidated);


  // Helper function to update DOB and calculate age from DD/MM/YYYY format
  const updateDOBFromFormatted = (formattedDate: string) => {
    const isoDate = convertDDMMYYYYToISO(formattedDate);
    if (isoDate && isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      try {
        const date = new Date(isoDate);
        if (!isNaN(date.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - date.getFullYear();
          const m = today.getMonth() - date.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
            age--;
          }
          setFormData(prev => ({ ...prev, dob: isoDate, age: age }));
          return true;
        }
      } catch (e) {
        // Invalid date, don't update
      }
    }
    return false;
  };

  useEffect(() => {
    if (currentLead) {
        const step2Data = currentLead.formData?.step2 || {};
        const newPan = currentLead.panNumber || '';
        const panChanged = newPan !== formData.pan;
        
        setFormData(prev => ({
            ...prev,
            customerType: 'individual',
            hasPan: step2Data.hasPan || 'yes',
            pan: newPan,
            panUnavailabilityReason: step2Data.panUnavailabilityReason || '',
            panUnavailabilityNotes: step2Data.panUnavailabilityNotes || '',
            alternateIdType: step2Data.alternateIdType || '',
            documentNumber: step2Data.documentNumber || '',
            dob: currentLead.dob || '',
            age: currentLead.age || 0,
            gender: currentLead.gender || '',
            email: currentLead.formData?.step2?.email || '',
            maritalStatus: step2Data.maritalStatus || '',
        }));
        
        // Update formatted DOB when currentLead changes
        setDobFormatted(convertISOToDDMMYYYY(currentLead.dob || ''));
        
        setLocalFirstName(currentLead.customerFirstName || '');
        setLocalLastName(currentLead.customerLastName || '');
        setNameMismatchReason(step2Data.nameMismatchReason || '');
        // Sync auto-population flags from context
        setIsAutoFilledViaPAN(step2Data.autoFilledViaPAN || false);
        setIsAutoFilledViaAadhaar(step2Data.autoFilledViaAadhaar || false);
        
        if (currentLead.panNumber) {
            setIsPanTouched(true);
        }

        const wasCompleted = currentLead.step2Completed === true;
        setIsPanValidated(wasCompleted);
        if (wasCompleted) {
            setPanValidationStatus('valid');
            setPanValidationMessage('PAN already validated for this lead.');
        } else if (!isVerifyingPan && !panChanged) {
            setPanValidationStatus('pending');
            setPanValidationMessage('');
        }

        // Only reset validation status if PAN actually changed and we're not in the middle of saving
        // Don't reset if validation is already 'valid' and PAN hasn't changed
        if (panChanged && panValidationStatus === 'valid' && !isVerifyingPan) {
            // If PAN changed from a validated state, reset to pending
            setPanValidationStatus('pending');
            setIsPanValidated(false);
            setPanValidationMessage('');
            setPanValidationError('');
            setLastValidationResponse(null);
        }
        // If PAN hasn't changed and is already validated, keep it as 'valid'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLead]);

  // Auto-populate PAN and DOB from OCR data if available (only if page not submitted)
  useEffect(() => {
    const fetchAndPopulateOcrData = async () => {
      // Only auto-populate if:
      // 1. Page was not manually submitted (step2Completed !== true)
      // 2. We have an application ID
      // 3. We're not already loading
      // 4. We haven't already fetched OCR data for this application ID
      const appId = currentLead?.appId;
      if (isCompleted || !appId || isLoadingOcrData || hasFetchedOcrData.current === appId) {
        return;
      }

      setIsLoadingOcrData(true);

      try {
        const response = await getDetailedInfo(currentLead.appId);

        if (isApiError(response)) {
          toast({
            title: 'Error',
            description: response.error || 'Failed to fetch document data. Please try again.',
            variant: 'destructive',
          });
          setIsLoadingOcrData(false);
          return;
        }

        // Backend response structure: { success: true, application_id, workflow_state: { pan_ocr_data: {...} }, ... }
        // All fields are at top level
        const successResponse = response as any;

        // Check if PAN OCR data exists for PAN and DOB
        const panExtractedFields = successResponse.workflow_state?.pan_ocr_data?.extracted_fields;
        
        // Check if Aadhaar OCR data exists for gender
        const aadhaarExtractedFields = successResponse.workflow_state?.aadhaar_ocr_data?.extracted_fields;
        
        // Process PAN data if available
        if (panExtractedFields) {
          // Extract PAN number
          let panNumber: string | null = null;
          if (panExtractedFields.pan_number) {
            const panValue = String(panExtractedFields.pan_number).trim();
            if (panValue && panValue.length > 0) {
              panNumber = panValue;
            }
          }

          // Extract date of birth and convert from DD/MM/YYYY to YYYY-MM-DD
          let dateOfBirth: string | null = null;
          if (panExtractedFields.date_of_birth) {
            const dobValue = String(panExtractedFields.date_of_birth).trim();
            if (dobValue && dobValue.length > 0) {
              dateOfBirth = convertDDMMYYYYToISO(dobValue);
            }
          }

          // Only populate if we have at least one field
          if (panNumber || dateOfBirth) {
            // Calculate age if DOB is available
            let calculatedAge = 0;
            if (dateOfBirth) {
              try {
                const today = new Date();
                const birthDate = new Date(dateOfBirth);
                if (!isNaN(birthDate.getTime())) {
                  calculatedAge = today.getFullYear() - birthDate.getFullYear();
                  const m = today.getMonth() - birthDate.getMonth();
                  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    calculatedAge--;
                  }
                }
              } catch (e) {
                console.error('Error calculating age:', e);
              }
            }

            // Overwrite existing values with OCR data
            setFormData(prev => ({
              ...prev,
              pan: panNumber || prev.pan,
              dob: dateOfBirth || prev.dob,
              age: calculatedAge || prev.age,
            }));

            // Update formatted DOB when auto-populated (convert YYYY-MM-DD to DD/MM/YYYY)
            if (dateOfBirth) {
              setDobFormatted(convertISOToDDMMYYYY(dateOfBirth));
            }

            // Set local state immediately for instant UI update
            setIsAutoFilledViaPAN(true);
            
            // Update lead context with auto-population flag
            if (currentLead) {
              updateLead(currentLead.id, {
                panNumber: panNumber || currentLead.panNumber || '',
                dob: dateOfBirth || currentLead.dob || '',
                age: calculatedAge || currentLead.age || 0,
                formData: {
                  ...currentLead.formData,
                  step2: {
                    ...currentLead.formData?.step2,
                    pan: panNumber || currentLead.formData?.step2?.pan || '',
                    dob: dateOfBirth || currentLead.formData?.step2?.dob || '',
                    age: calculatedAge || currentLead.formData?.step2?.age || 0,
                    autoFilledViaPAN: true, // Mark as auto-filled via PAN
                  },
                },
              });
            }

            toast({
              title: 'Auto-populated',
              description: 'PAN number and Date of Birth have been auto-populated from uploaded document.',
              className: 'bg-blue-50 border-blue-200',
            });
          }
        }

        // Process Aadhaar data if available (for gender)
        let genderValue: string | null = null;
        if (aadhaarExtractedFields?.gender) {
          const gender = String(aadhaarExtractedFields.gender).trim().toLowerCase();
          // Map common gender values to form values
          if (gender === 'male' || gender === 'm') {
            genderValue = 'male';
          } else if (gender === 'female' || gender === 'f') {
            genderValue = 'female';
          } else if (gender === 'other' || gender === 'o') {
            genderValue = 'other';
          } else if (gender === 'not-specified' || gender === 'not specified') {
            genderValue = 'not-specified';
          }
        }

        // Populate gender if available
        if (genderValue) {
          setFormData(prev => ({
            ...prev,
            gender: genderValue as string,
          }));

          // Set local state immediately for instant UI update
          setIsAutoFilledViaAadhaar(true);
          
          // Update lead context with auto-population flag for gender
          if (currentLead) {
            updateLead(currentLead.id, {
              gender: genderValue,
              formData: {
                ...currentLead.formData,
                step2: {
                  ...currentLead.formData?.step2,
                  gender: genderValue,
                  autoFilledViaAadhaar: true, // Mark gender as auto-filled via Aadhaar
                },
              },
            });
          }

          toast({
            title: 'Auto-populated',
            description: 'Gender has been auto-populated from uploaded Aadhaar document.',
            className: 'bg-blue-50 border-blue-200',
          });
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

  // Removed: PAN validation should only trigger after DOB is set, not on PAN input change
  
  const handlePanInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const newPan = e.target.value.toUpperCase();
    if (newPan !== formData.pan || panValidationStatus === 'pending') {
         setFormData(prev => ({...prev, pan: newPan}));
    }
  };

  const handleNameSave = (newFirstName: string, newLastName: string, mismatchReason: string) => {
    setLocalFirstName(newFirstName);
    setLocalLastName(newLastName);
    setNameMismatchReason(mismatchReason);
    
    // PAN validation now only happens via API when user clicks "Validate Pan"
    // Reset validation status if name is changed after validation
    if (panValidationStatus === 'valid' || panValidationStatus === 'mismatch') {
      setPanValidationStatus('pending');
      setIsPanValidated(false);
      setPanValidationMessage('');
      setPanValidationError('');
      setLastValidationResponse(null);
    }
  };

  // Handler for MaskedDateInput (DD/MM/YYYY format)
  const handleDOBChange = (value: string) => {
    if (isReadOnly) return;
    
    if (isPanValidated) {
      setIsPanValidated(false);
      setPanValidationStatus('pending');
      setPanValidationMessage('');
      setLastValidationResponse(null);
    }
    
    // Update the formatted display value
    setDobFormatted(value);
    
    // Convert to ISO format and update formData when complete (10 chars: DD/MM/YYYY)
    if (value.length === 10) {
      const isoDate = convertDDMMYYYYToISO(value);
      if (isoDate && isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        try {
          const date = new Date(isoDate);
          if (!isNaN(date.getTime())) {
            const today = new Date();
            let age = today.getFullYear() - date.getFullYear();
            const m = today.getMonth() - date.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
              age--;
            }
            setFormData(prev => ({ ...prev, dob: isoDate, age: age }));
          }
        } catch (e) {
          // Invalid date, don't update
        }
      }
    } else {
      // Incomplete date, clear the ISO value but keep formatted for display
      setFormData(prev => ({ ...prev, dob: '', age: 0 }));
    }
  };

  const handleValidatePan = async () => {
    if (!currentLead) {
      toast({
        title: 'Lead Not Found',
        description: 'Unable to validate PAN because lead details are missing.',
        variant: 'destructive',
      });
      return;
    }

    if (isCompleted) {
      toast({
        title: 'Section Completed',
        description: 'This section has already been completed and submitted. It is now read-only.',
        variant: 'default',
      });
      return;
    }

    if (formData.hasPan !== 'yes') {
      toast({
        title: 'PAN Required',
        description: 'Select that the customer has a PAN before validating.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentLead.appId) {
      toast({
        title: 'Application Missing',
        description: 'Application ID not found. Please create a new lead first.',
        variant: 'destructive',
      });
      return;
    }

    if (
      formData.pan.length !== 10 ||
      !formData.dob ||
      !formData.gender ||
      !formData.maritalStatus
    ) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in PAN, Date of Birth, Gender, and Marital Status before validating.',
        variant: 'destructive',
      });
      return;
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(formData.pan)) {
      setPanValidationStatus('invalid');
      setPanValidationError('Invalid PAN format. Expected format: ABCDE1234F');
      toast({
        title: 'Validation Failed',
        description: 'Invalid PAN format. Expected format: ABCDE1234F',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifyingPan(true);
    setPanValidationStatus('pending');
    setPanValidationError('');
    setPanValidationMessage('');
    setDobMismatch(false);
    setNameMismatch(false);
    setIsPanValidated(false);
    setLastValidationResponse(null);

    try {
      const response = await submitPersonalInfo({
        application_id: currentLead.appId,
        customer_type: 'individual',
        pan_number: formData.pan,
        date_of_birth: formData.dob,
        gender: formData.gender,
        email: formData.email || undefined,
      });

      if (isApiError(response)) {
        const errorMessage = response.error || 'Failed to validate PAN. Please try again.';
        const lowerError = errorMessage.toLowerCase();

        const isNameMismatchError = lowerError.includes('name');
        const isDobMismatchError = lowerError.includes('date of birth') || lowerError.includes('dob');
        const isMismatchError = isNameMismatchError || isDobMismatchError;

        setPanValidationStatus(isMismatchError ? 'mismatch' : 'invalid');
        setPanValidationError(isMismatchError ? '' : errorMessage);
        setPanApiName('');
        setIsPanValidated(false);
        setLastValidationResponse(null);
        setNameMismatch(isNameMismatchError);
        setDobMismatch(isDobMismatchError);

        toast({
          title: 'Validation Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      const personalInfoResponse = (response as any).data;
      const responseData: PersonalInfoResponse['data'] | null =
        personalInfoResponse?.data || personalInfoResponse || null;

      setPanValidationStatus('valid');
      setPanApiName(responseData?.pan_verification_status || 'Verified');
      setPanValidationError('');
      setIsPanValidated(true);
      setLastValidationResponse(responseData);

      if (responseData?.date_of_birth) {
        setFormData(prev => ({
          ...prev,
          dob: responseData.date_of_birth,
        }));
        setDobFormatted(convertISOToDDMMYYYY(responseData.date_of_birth));

        try {
          const birthDate = new Date(responseData.date_of_birth);
          if (!isNaN(birthDate.getTime())) {
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            setFormData(prev => ({ ...prev, age }));
          }
        } catch (error) {
          console.error('Error calculating age from validation response', error);
        }
      }

      if (responseData?.gender) {
        setFormData(prev => ({ ...prev, gender: responseData.gender as string }));
      }

      if (responseData?.email) {
        setFormData(prev => ({ ...prev, email: responseData.email || prev.email }));
      }

      setPanValidationMessage(response.message || 'PAN validated successfully.');

      toast({
        title: 'PAN Validated',
        description: response.message || 'PAN validated successfully.',
        className: 'bg-green-50 border-green-200',
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to validate PAN. Please try again.';
      setPanValidationStatus('invalid');
      setPanValidationError(errorMessage);
      setIsPanValidated(false);
      setLastValidationResponse(null);

      toast({
        title: 'Validation Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingPan(false);
    }
  };

  const handleSave = async () => {
    if (!currentLead) return;

    if (isCompleted) {
      router.push('/lead/new-lead-info');
      return;
    }
    
    if (formData.hasPan === 'yes' && !isPanValidated) {
      toast({
        title: 'Validation Required',
        description: 'Please validate PAN first before saving.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.hasPan === 'no' && !noPanRequirementsMet) {
      toast({
        title: 'Missing Information',
        description: 'Please fill all required alternate ID details before saving.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const performLocalSave = (payload: { dob: string; gender: string; email?: string; panNumber?: string }) => {
      updateLead(currentLead.id, {
        customerFirstName: localFirstName,
        customerLastName: localLastName,
        panNumber: payload.panNumber ?? (formData.hasPan === 'yes' ? formData.pan : ''),
        dob: payload.dob,
        age: formData.age,
        gender: payload.gender,
        step2Completed: true,
        formData: { 
          ...currentLead.formData, 
          step2: { 
            ...formData, 
            nameMismatchReason,
            email: payload.email ?? formData.email,
            panValidationStatus: isPanValidated ? 'valid' : 'pending',
          },
        },
      });

      toast({
        title: 'Success',
        description: 'Personal information saved successfully.',
        className: 'bg-green-50 border-green-200',
      });

      router.push('/lead/new-lead-info');
    };

    if (formData.hasPan === 'no') {
      performLocalSave({ dob: formData.dob, gender: formData.gender, email: formData.email, panNumber: '' });
      setIsSaving(false);
      return;
    }

    const resolvedDob = lastValidationResponse?.date_of_birth || formData.dob;
    const resolvedGender = lastValidationResponse?.gender || formData.gender;
    const resolvedEmail = lastValidationResponse?.email || formData.email;

    performLocalSave({
      dob: resolvedDob,
      gender: resolvedGender,
      email: resolvedEmail,
      panNumber: formData.pan,
    });

    setIsSaving(false);
  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };
  
  // Check if PAN validation needs to be done - show "Validate Pan" button if not already validated
  const noPanRequirementsMet = formData.hasPan === 'no' &&
    formData.panUnavailabilityReason &&
    formData.alternateIdType &&
    formData.documentNumber &&
    formData.dob &&
    formData.gender &&
    formData.maritalStatus &&
    !dobMismatch;

  const canAttemptValidation = formData.hasPan === 'yes' &&
    formData.pan.length === 10 &&
    formData.dob &&
    formData.gender &&
    formData.maritalStatus &&
    !dobMismatch;

  const canSave = formData.hasPan === 'yes'
    ? isPanValidated
    : noPanRequirementsMet;

  const showValidateButton = formData.hasPan === 'yes' && !isCompleted && !isPanValidated;
  const showSaveButton = (!isCompleted && ((formData.hasPan === 'yes' && isPanValidated) || formData.hasPan === 'no')) || isCompleted;

  return (
    <DashboardLayout title="Customer Details" showNotifications={false} showExitButton={true} onExit={handleExit}>
      <NameEditDialog
        isOpen={isNameEditOpen}
        setIsOpen={setIsNameEditOpen}
        currentFirstName={localFirstName}
        currentLastName={localLastName}
        currentMismatchReason={nameMismatchReason}
        onSave={handleNameSave}
      />
        
      <div className="max-w-2xl mx-auto pb-24">
        {isCompleted && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Customer Details section has been completed and submitted. This section is now read-only.
            </p>
          </div>
        )}
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
            <div className="space-y-4 flex items-center justify-between">
                 <div>
                    <Label className="block text-xs font-medium text-neutral mb-1">Customer Type</Label>
                    <p className="text-sm font-medium text-[#003366]">Individual</p>
                </div>
                {isCompleted && (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Completed
                  </Badge>
                )}
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6 mb-4">
            <div className="border-b border-gray-100 pb-2 mb-6 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#003366]">Identity Verification</h3>
                <div className="flex items-center gap-2">
                  {(isAutoFilledViaPAN || currentLead?.formData?.step2?.autoFilledViaPAN) && (
                    <Badge className="bg-green-100 text-green-700 text-xs">Verified via PAN</Badge>
                  )}
                </div>
            </div>
          
            <div className="space-y-6">
                <div>
                    <Label className="block text-sm font-medium text-[#003366] mb-3">Does the customer have a PAN? *</Label>
                    <RadioGroup
                      value={formData.hasPan}
                      onValueChange={(value) => {
                        if (isReadOnly) return;
                        setFormData({
                          ...formData,
                          hasPan: value,
                          pan: '',
                          panUnavailabilityReason: '',
                          panUnavailabilityNotes: '',
                          alternateIdType: '',
                          documentNumber: '',
                        });
                        setPanValidationStatus('pending');
                        setPanApiName('');
                        setPanValidationError('');
                        setNameMismatch(false);
                        setDobMismatch(false);
                        setPanValidationMessage('');
                        setIsPanValidated(false);
                        setLastValidationResponse(null);
                      }}
                      className="flex gap-4"
                      disabled={isReadOnly}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="pan-yes" disabled={isReadOnly} />
                        <Label htmlFor="pan-yes" className={cn('font-normal', isReadOnly && 'cursor-not-allowed opacity-60')}>Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="pan-no" disabled={isReadOnly} />
                        <Label htmlFor="pan-no" className={cn('font-normal', isReadOnly && 'cursor-not-allowed opacity-60')}>No</Label>
                      </div>
                    </RadioGroup>
                </div>
                {formData.hasPan === 'yes' && (
                  <div>
                      <Label htmlFor="pan-input" className="text-sm font-medium text-[#003366] mb-2 block">PAN Number *</Label>
                      <div className="relative flex items-center">
                          <Input 
                              id="pan-input" 
                              maxLength={10} 
                              placeholder="ABCDE1234F" 
                              value={formData.pan} 
                              onChange={e => {
                                  if (isReadOnly) return; // Prevent editing when completed or locked after validation
                                  setIsPanTouched(true);
                                  const newPan = e.target.value.toUpperCase();
                                  const panChanged = newPan !== formData.pan;
                                  setFormData(prev => ({...prev, pan: newPan}));
                                  
                                  // Only reset validation status if PAN actually changed
                                  if (!panChanged && panValidationStatus === 'valid') {
                                      return; // Don't reset validation if PAN hasn't changed and is already validated
                                  }
                                  
                                  setPanValidationMessage('');
                                  setIsPanValidated(false);
                                  setLastValidationResponse(null);
                                  
                                  // Check format validation immediately when 10 characters entered
                                  if (newPan.length === 10) {
                                      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
                                      if (!panRegex.test(newPan)) {
                                          setPanValidationError('Invalid PAN format. Expected format: ABCDE1234F');
                                          setPanValidationStatus('invalid');
                                          setNameMismatch(false);
                                          setDobMismatch(false);
                                      } else {
                                          setPanValidationError('');
                                          // Only reset validation status if PAN changed or not yet validated
                                          if (panChanged || panValidationStatus !== 'valid') {
                                              setPanValidationStatus('pending');
                                          }
                                          setNameMismatch(false);
                                          setDobMismatch(false);
                                      }
                                  } else {
                                      setPanValidationError('');
                                      // Only reset validation status if PAN changed or not yet validated
                                      if (panChanged || panValidationStatus !== 'valid') {
                                          setPanValidationStatus('pending');
                                      }
                                      setNameMismatch(false);
                                      setDobMismatch(false);
                                  }
                              }}
                              onBlur={handlePanInputBlur} 
                              disabled={isReadOnly}
                              className={cn("w-full h-12 px-4 py-3 border-gray-300 rounded-xl uppercase tracking-wider", panValidationStatus === 'invalid' && 'border-red-500', isReadOnly && 'bg-gray-50 cursor-not-allowed')}
                          />
                          <div className="absolute right-3 h-full flex items-center">
                              {(isVerifyingPan || isLoadingOcrData) && <Loader className="text-[#0072CE] animate-spin w-5 h-5" />}
                              {!isVerifyingPan && !isLoadingOcrData && panValidationStatus === 'valid' && <CheckCircle className="text-[#16A34A] w-5 h-5" />}
                              {!isVerifyingPan && !isLoadingOcrData && panValidationStatus === 'invalid' && <X className="text-[#DC2626] w-5 h-5" />}
                              {!isVerifyingPan && !isLoadingOcrData && panValidationStatus === 'mismatch' && <AlertTriangle className="text-yellow-600 w-5 h-5" />}
                          </div>
                       </div>
                      {panValidationError && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <X className="w-4 h-4" /> {panValidationError}
                          </p>
                       )}
                       {panValidationStatus === 'invalid' && !panValidationError && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <X className="w-4 h-4" /> PAN doesn&apos;t exist
                          </p>
                       )}
                       {panValidationStatus === 'mismatch' && !panValidationError && (
                          <div className="mt-1 space-y-1">
                              {nameMismatch && (
                                  <p className="text-xs text-red-600 flex items-center gap-1">
                                      <AlertTriangle className="w-4 h-4" /> Name mismatch with PAN records
                                  </p>
                              )}
                              {dobMismatch && formData.dob && (
                                  <p className="text-xs text-red-600 flex items-center gap-1">
                                      <AlertTriangle className="w-4 h-4" /> Date of birth mismatch with PAN records
                                  </p>
                              )}
                          </div>
                       )}

                      {panValidationStatus === 'valid' && !isVerifyingPan && (
                           <div className="bg-[#16A34A]/5 border border-[#16A34A]/20 rounded-xl p-4 mt-4">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                      <CheckCircle className="text-[#16A34A] w-5 h-5" />
                                      <span className="text-sm font-medium text-[#16A34A]">PAN Verified</span>
                                  </div>
                              </div>
                              {panValidationMessage && (
                                <p className="text-xs text-[#166534] mt-2">{panValidationMessage}</p>
                              )}
                          </div>
                      )}
                      {(isAutoFilledViaPAN || currentLead?.formData?.step2?.autoFilledViaPAN) && (
                        <p className="text-xs text-gray-400 mt-2">Auto-filled and verified via PAN & NSDL workflow</p>
                      )}
                  </div>
                )}
                {formData.hasPan === 'no' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-[#003366] mb-2 block">PAN Unavailability Reason *</Label>
                      <Select
                        value={formData.panUnavailabilityReason}
                        onValueChange={(value: string) => {
                          if (isReadOnly) return;
                          setFormData({ ...formData, panUnavailabilityReason: value });
                        }}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className={cn('h-12 rounded-xl', isReadOnly && 'bg-gray-50 cursor-not-allowed')}>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not-handy">Not handy</SelectItem>
                          <SelectItem value="not-allotted">Not allotted</SelectItem>
                          <SelectItem value="name-change">Name change in progress</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(formData.panUnavailabilityReason === 'other' || formData.panUnavailabilityReason === 'name-change') && (
                      <div>
                        <Label className="text-sm font-medium text-[#003366] mb-2 block">Notes</Label>
                        <Textarea
                          value={formData.panUnavailabilityNotes}
                          onChange={(e) => {
                            if (isReadOnly) return;
                            setFormData({ ...formData, panUnavailabilityNotes: e.target.value });
                          }}
                          placeholder="Please provide additional details..."
                          className={cn('rounded-xl', isReadOnly && 'bg-gray-50 cursor-not-allowed')}
                          disabled={isReadOnly}
                        />
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-medium text-[#003366] mb-2 block">Alternate Primary ID Type *</Label>
                      <Select
                        value={formData.alternateIdType}
                        onValueChange={(value: string) => {
                          if (isReadOnly) return;
                          setFormData({ ...formData, alternateIdType: value });
                        }}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className={cn('h-12 rounded-xl', isReadOnly && 'bg-gray-50 cursor-not-allowed')}>
                          <SelectValue placeholder="Select ID Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Passport">Passport</SelectItem>
                          <SelectItem value="Voter ID">Voter ID</SelectItem>
                          <SelectItem value="Driving License">Driving License</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-[#003366] mb-2 block">Document Number *</Label>
                      <Input
                        value={formData.documentNumber}
                        onChange={(e) => {
                          if (isReadOnly) return;
                          setFormData({ ...formData, documentNumber: e.target.value });
                        }}
                        placeholder="Enter document number"
                        className={cn('h-12 rounded-xl', isReadOnly && 'bg-gray-50 cursor-not-allowed')}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                )}
            </div>

            <div className="border-t border-gray-100 pt-6 mt-6 space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#003366]">Personal Details</h3>
                 </div>
                 <div>
                    <Label className="text-sm font-medium text-[#003366] mb-2 block flex items-center gap-2">
                        Date of Birth *
                        {dobMismatch && formData.dob && <AlertTriangle className="text-yellow-600 w-4 h-4" />}
                    </Label>
                    <MaskedDateInput
                      id="dob-input"
                      value={dobFormatted}
                      onChange={handleDOBChange}
                      placeholder="DD/MM/YYYY"
                      disabled={isReadOnly}
                      className={cn(
                        isReadOnly && "bg-gray-50 cursor-not-allowed"
                      )}
                    />
                    {formData.age > 0 && <div className="mt-3"><Badge className="bg-[#E6F0FA] text-[#0072CE]">Age: {formData.age} years</Badge></div>}
                </div>
                 <div>
                    <Label className="block text-sm font-medium text-[#003366] mb-3">Gender *</Label>
                     <RadioGroup 
                        value={formData.gender} 
                        onValueChange={(value) => {
                          if (!isReadOnly) {
                            setFormData({ ...formData, gender: value });
                          }
                        }}
                        disabled={isReadOnly}
                        className="grid grid-cols-2 gap-2"
                      >
                        <Label htmlFor="g-male" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.gender === 'male' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="male" id="g-male" className="sr-only" disabled={isReadOnly} /><span className="text-lg"></span>Male</Label>
                        <Label htmlFor="g-female" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.gender === 'female' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="female" id="g-female" className="sr-only" disabled={isReadOnly} />Female</Label>
                        <Label htmlFor="g-other" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.gender === 'other' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="other" id="g-other" className="sr-only" disabled={isReadOnly} />Other</Label>
                        <Label htmlFor="g-not-specified" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.gender === 'not-specified' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="not-specified" id="g-not-specified" className="sr-only" disabled={isReadOnly} />Not Specified</Label>
                    </RadioGroup>
                    {(isAutoFilledViaAadhaar || currentLead?.formData?.step2?.autoFilledViaAadhaar) && (
                      <p className="text-xs text-gray-400 mt-2">Auto-filled and verified via Aadhaar OCR workflow</p>
                    )}
                </div>
                <div>
                    <Label className="block text-sm font-medium text-[#003366] mb-3">Marital Status *</Label>
                     <RadioGroup 
                        value={formData.maritalStatus} 
                        onValueChange={(value) => {
                          if (!isReadOnly) {
                            setFormData({ ...formData, maritalStatus: value });
                          }
                        }}
                        className="grid grid-cols-3 gap-2"
                        disabled={isReadOnly}
                    >
                        <Label htmlFor="m-single" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.maritalStatus === 'single' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="single" id="m-single" className="sr-only" disabled={isReadOnly} />Single</Label>
                        <Label htmlFor="m-married" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.maritalStatus === 'married' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="married" id="m-married" className="sr-only" disabled={isReadOnly} />Married</Label>
                        <Label htmlFor="m-divorced" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.maritalStatus === 'divorced' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="divorced" id="m-divorced" className="sr-only" disabled={isReadOnly} />Divorced</Label>
                    </RadioGroup>
                </div>
                 <div>
                    <Label htmlFor="email-input" className="text-sm font-medium text-[#003366] mb-2 block">Email</Label>
                    <Input 
                        id="email-input" 
                        type="email"
                        placeholder="example@email.com" 
                        value={formData.email} 
                        onChange={(e) => {
                          if (!isReadOnly) {
                            setFormData({ ...formData, email: e.target.value });
                          }
                        }}
                        disabled={isReadOnly}
                        className={cn("w-full h-12 px-4 py-3 border-gray-300 rounded-xl", isReadOnly && "bg-gray-50 cursor-not-allowed")}
                    />
                </div>
            </div>
            
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
        <div className="flex gap-3 max-w-2xl mx-auto">
          {showValidateButton && (
            <Button 
              onClick={handleValidatePan} 
              disabled={!canAttemptValidation || isVerifyingPan}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isVerifyingPan ? 'Validating...' : 'Validate PAN'}
            </Button>
          )}
          {showSaveButton && (
            <Button 
              onClick={handleSave} 
              disabled={isCompleted || !canSave || isSaving}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Information'}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}