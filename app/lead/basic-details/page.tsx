'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertTriangle, Loader, Edit, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { submitPersonalInfo, isApiError, getDetailedInfo } from '@/lib/api';
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
    pan: currentLead?.panNumber || '',
    dob: currentLead?.dob || '',
    age: currentLead?.age || 0,
    gender: currentLead?.gender || '',
    email: currentLead?.formData?.step2?.email || '',
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
  const [panFormatError, setPanFormatError] = useState('');
  const [dobMismatch, setDobMismatch] = useState(false);
  const [nameMismatch, setNameMismatch] = useState(false);
  
  const [isNameEditOpen, setIsNameEditOpen] = useState(false);
  const [localFirstName, setLocalFirstName] = useState(currentLead?.customerFirstName || '');
  const [localLastName, setLocalLastName] = useState(currentLead?.customerLastName || '');
  const [isLoadingOcrData, setIsLoadingOcrData] = useState(false);
  const hasFetchedOcrData = useRef<string | null>(null);
  const [isAutoFilledViaPAN, setIsAutoFilledViaPAN] = useState(currentLead?.formData?.step2?.autoFilledViaPAN || false);
  const [isAutoFilledViaAadhaar, setIsAutoFilledViaAadhaar] = useState(currentLead?.formData?.step2?.autoFilledViaAadhaar || false);


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

  // Helper function to get dynamic placeholder based on current input
  const getDynamicPlaceholder = (value: string): string => {
    const digitsOnly = value.replace(/\//g, '');
    const length = digitsOnly.length;
    
    if (length === 0) return 'DD/MM/YYYY';
    if (length <= 2) {
      // User has entered day, show remaining parts
      const dayPart = digitsOnly.padEnd(2, 'D');
      return `${dayPart}/MM/YYYY`;
    }
    if (length <= 4) {
      // User has entered day and month, show remaining parts
      const dayPart = digitsOnly.slice(0, 2);
      const monthPart = digitsOnly.slice(2, 4).padEnd(2, 'M');
      return `${dayPart}/${monthPart}/YYYY`;
    }
    if (length <= 8) {
      // User has entered day, month, and partial year
      const dayPart = digitsOnly.slice(0, 2);
      const monthPart = digitsOnly.slice(2, 4);
      const yearPart = digitsOnly.slice(4, 8).padEnd(4, 'Y');
      return `${dayPart}/${monthPart}/${yearPart}`;
    }
    return 'DD/MM/YYYY';
  };

  useEffect(() => {
    if (currentLead) {
        const step2Data = currentLead.formData?.step2 || {};
        const newPan = currentLead.panNumber || '';
        const panChanged = newPan !== formData.pan;
        
        setFormData(prev => ({
            ...prev,
            customerType: 'individual',
            pan: newPan,
            dob: currentLead.dob || '',
            age: currentLead.age || 0,
            gender: currentLead.gender || '',
            email: currentLead.formData?.step2?.email || '',
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
        
        // Only reset validation status if PAN actually changed and we're not in the middle of saving
        // Don't reset if validation is already 'valid' and PAN hasn't changed
        if (panChanged && panValidationStatus === 'valid' && !isVerifyingPan) {
            // If PAN changed from a validated state, reset to pending
            setPanValidationStatus('pending');
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
            gender: genderValue,
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
    }
  };

  // Handler for formatted DOB input (DD/MM/YYYY)
  const handleDOBInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCompleted) return;
    
    let value = e.target.value;
    // Remove all non-digit characters
    const digitsOnly = value.replace(/[^0-9]/g, '');
    
    // Limit to 8 digits (DDMMYYYY)
    const limitedDigits = digitsOnly.slice(0, 8);
    
    // Format with slashes
    let formatted = '';
    for (let i = 0; i < limitedDigits.length; i++) {
      if (i === 2 || i === 4) {
        formatted += '/';
      }
      formatted += limitedDigits[i];
    }
    
    setDobFormatted(formatted);
    
    // Real-time validation as user types
    if (limitedDigits.length >= 2) {
      const day = limitedDigits.slice(0, 2);
      const dayNum = parseInt(day, 10);
      
      // Validate day: cannot be > 31 or < 1
      if (dayNum > 31 || dayNum < 1) {
        // Invalid day - don't update formData
        return;
      }
    }
    
    if (limitedDigits.length >= 4) {
      const day = limitedDigits.slice(0, 2);
      const month = limitedDigits.slice(2, 4);
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      
      // Validate month: cannot be > 12 or < 1
      if (monthNum > 12 || monthNum < 1) {
        // Invalid month - don't update formData
        return;
      }
      
      // Validate day again with context (e.g., cannot have day 31 in month 2)
      if (dayNum > 31 || dayNum < 1) {
        return;
      }
    }
    
    // Validate and update DOB when complete (8 digits)
    if (limitedDigits.length >= 8) {
      const day = limitedDigits.slice(0, 2);
      const month = limitedDigits.slice(2, 4);
      const year = limitedDigits.slice(4, 8);
      
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      
      // Final validation
      if (dayNum > 31 || dayNum < 1 || monthNum > 12 || monthNum < 1) {
        return;
      }
      
      // Try to create a valid date
      try {
        const date = new Date(yearNum, monthNum - 1, dayNum);
        // Check if date is valid (handles invalid dates like Feb 30)
        if (date.getDate() === dayNum && date.getMonth() === monthNum - 1 && date.getFullYear() === yearNum) {
          updateDOBFromFormatted(formatted);
        }
      } catch (e) {
        // Invalid date, don't update
      }
    }
  };

  const handleValidatePan = () => {
    // Prevent validation if section is already completed
    if (isCompleted) {
      toast({
        title: 'Section Completed',
        description: 'This section has already been completed and submitted. It is now read-only.',
        variant: 'default',
      });
      return;
    }

    if (formData.pan.length !== 10 || !formData.dob || !formData.gender) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in PAN, Date of Birth, and Gender before validating.',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifyingPan(true);
    setPanValidationStatus('pending');

    // Only do format validation - no API call
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    
    setTimeout(() => {
      if (!panRegex.test(formData.pan)) {
        setPanFormatError('Invalid Pan');
        setPanValidationStatus('invalid');
        setIsVerifyingPan(false);
        toast({
          title: 'Validation Failed',
          description: 'Invalid PAN format. Expected format: ABCDE1234F',
          variant: 'destructive',
        });
        return;
      }

      // Format is valid - mark as valid
      setPanFormatError('');
      setPanValidationStatus('valid');
      setPanApiName('Verified');
      setIsVerifyingPan(false);
      
      toast({
        title: 'Validation Successful',
        description: 'PAN format validated successfully. Click "Save Information" to save.',
        className: 'bg-green-50 border-green-200',
      });
    }, 500);
  };

  const handleSave = async () => {
    if (!currentLead) return;
    
    if (panValidationStatus !== 'valid') {
      toast({
        title: 'Validation Required',
        description: 'Please validate PAN first before saving.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentLead.appId) {
      toast({
        title: 'Error',
        description: 'Application ID not found. Please create a new lead first.',
        variant: 'destructive',
      });
      return;
    }

    // Prevent any validation from being triggered during save
    setIsVerifyingPan(true);
    
    // Ensure validation status stays 'valid' during save process
    // This prevents any side effects from resetting validation status

    try {
      // Endpoint 3: Submit Personal Info - Save to backend
      const response = await submitPersonalInfo({
        application_id: currentLead.appId,
        customer_type: 'individual',
        pan_number: formData.pan,
        date_of_birth: formData.dob,
        gender: formData.gender,
        email: formData.email || undefined,
      });

      if (isApiError(response)) {
        toast({
          title: 'Save Failed',
          description: response.error || 'Failed to save personal information. Please try again.',
          variant: 'destructive',
        });
        setIsVerifyingPan(false);
        return;
      }

      // Success response
      if (response.success) {
        const personalInfoResponse = (response as any).data;
        const responseData = personalInfoResponse?.data || personalInfoResponse;
        
        // Update lead context with saved data and mark as completed
        updateLead(currentLead.id, {
          customerFirstName: localFirstName,
          customerLastName: localLastName,
          panNumber: responseData?.pan_number || formData.pan,
          dob: responseData?.date_of_birth || formData.dob,
          age: formData.age,
          gender: responseData?.gender || formData.gender,
          step2Completed: true, // Mark section as completed
          formData: { 
            ...currentLead.formData, 
            step2: { 
              ...formData, 
              nameMismatchReason,
              email: responseData?.email || formData.email,
            },
          },
        });

        toast({
          title: 'Success',
          description: 'Personal information saved successfully.',
          className: 'bg-green-50 border-green-200',
        });

        // Navigate immediately after save
        router.push('/lead/new-lead-info');
      }
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save personal information. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingPan(false);
    }
  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };
  
  // Check if PAN validation needs to be done - show "Validate Pan" button if not already validated
  const needsPanValidation = formData.pan.length === 10 && formData.dob && formData.gender && panValidationStatus !== 'valid';
  
  // Enable Save Information button only when PAN is validated
  const canSave = panValidationStatus === 'valid';

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
                {(isAutoFilledViaPAN || currentLead?.formData?.step2?.autoFilledViaPAN) && (
                  <Badge className="bg-green-100 text-green-700 text-xs">Verified via PAN</Badge>
                )}
            </div>
          
            <div className="space-y-6">
                <div>
                    <Label htmlFor="pan-input" className="text-sm font-medium text-[#003366] mb-2 block">PAN Number *</Label>
                             <div className="relative flex items-center">
                                <Input 
                                    id="pan-input" 
                                    maxLength={10} 
                                    placeholder="ABCDE1234F" 
                                    value={formData.pan} 
                                    onChange={e => {
                                        if (isCompleted) return; // Prevent editing when completed
                                        setIsPanTouched(true);
                                        const newPan = e.target.value.toUpperCase();
                                        const panChanged = newPan !== formData.pan;
                                        setFormData(prev => ({...prev, pan: newPan}));
                                        
                                        // Only reset validation status if PAN actually changed
                                        if (!panChanged && panValidationStatus === 'valid') {
                                            return; // Don't reset validation if PAN hasn't changed and is already validated
                                        }
                                        
                                        // Check format validation immediately when 10 characters entered
                                        if (newPan.length === 10) {
                                            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
                                            if (!panRegex.test(newPan)) {
                                                setPanFormatError('Invalid Pan');
                                                setPanValidationStatus('invalid');
                                                setNameMismatch(false);
                                                setDobMismatch(false);
                                            } else {
                                                setPanFormatError('');
                                                // Only reset validation status if PAN changed or not yet validated
                                                if (panChanged || panValidationStatus !== 'valid') {
                                                    setPanValidationStatus('pending');
                                                }
                                                setNameMismatch(false);
                                                setDobMismatch(false);
                                            }
                                        } else {
                                            setPanFormatError('');
                                            // Only reset validation status if PAN changed or not yet validated
                                            if (panChanged || panValidationStatus !== 'valid') {
                                                setPanValidationStatus('pending');
                                            }
                                            setNameMismatch(false);
                                            setDobMismatch(false);
                                        }
                                    }}
                                    onBlur={handlePanInputBlur} 
                                    disabled={isCompleted}
                                    className={cn("w-full h-12 px-4 py-3 border-gray-300 rounded-xl uppercase tracking-wider", panValidationStatus === 'invalid' && 'border-red-500', isCompleted && 'bg-gray-50 cursor-not-allowed')}
                                />
                                <div className="absolute right-3 h-full flex items-center">
                                    {(isVerifyingPan || isLoadingOcrData) && <Loader className="text-[#0072CE] animate-spin w-5 h-5" />}
                                    {!isVerifyingPan && !isLoadingOcrData && panValidationStatus === 'valid' && <CheckCircle className="text-[#16A34A] w-5 h-5" />}
                                    {!isVerifyingPan && !isLoadingOcrData && panValidationStatus === 'invalid' && <X className="text-[#DC2626] w-5 h-5" />}
                                    {!isVerifyingPan && !isLoadingOcrData && panValidationStatus === 'mismatch' && <AlertTriangle className="text-yellow-600 w-5 h-5" />}
                                </div>
                             </div>
                             {panFormatError && (
                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                    <X className="w-4 h-4" /> {panFormatError}
                                </p>
                             )}
                             {panValidationStatus === 'invalid' && !panFormatError && (
                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                    <X className="w-4 h-4" /> PAN doesn't exist
                                </p>
                             )}
                             {panValidationStatus === 'mismatch' && !panFormatError && (
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
                        </div>
                        
                        {panValidationStatus === 'valid' && !isVerifyingPan && (
                             <div className="bg-[#16A34A]/5 border border-[#16A34A]/20 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="text-[#16A34A] w-5 h-5" />
                                        <span className="text-sm font-medium text-[#16A34A]">PAN Verified</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {(isAutoFilledViaPAN || currentLead?.formData?.step2?.autoFilledViaPAN) && (
                          <p className="text-xs text-gray-400 mt-2">Auto-filled and verified via PAN & NSDL workflow</p>
                        )}
                </div>
            
            <div className="border-t border-gray-100 pt-6 mt-6 space-y-6">
                 <h3 className="text-sm font-semibold text-[#003366]">Personal Details</h3>
                 <div>
                    <Label className="text-sm font-medium text-[#003366] mb-2 block flex items-center gap-2">
                        Date of Birth *
                        {dobMismatch && formData.dob && <AlertTriangle className="text-yellow-600 w-4 h-4" />}
                    </Label>
                    <Input
                      type="text"
                      placeholder={getDynamicPlaceholder(dobFormatted)}
                      value={dobFormatted}
                      onChange={handleDOBInputChange}
                      onKeyDown={(e) => {
                        // Allow backspace, delete, arrow keys, tab, etc.
                        if (
                          e.key === 'Backspace' ||
                          e.key === 'Delete' ||
                          e.key === 'ArrowLeft' ||
                          e.key === 'ArrowRight' ||
                          e.key === 'Tab' ||
                          e.key === 'Home' ||
                          e.key === 'End'
                        ) {
                          return;
                        }
                        // Allow digits only
                        if (!/[0-9]/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      disabled={isCompleted}
                      maxLength={10}
                      className={cn(
                        "h-12 rounded-xl",
                        isCompleted && "bg-gray-50 cursor-not-allowed"
                      )}
                    />
                    {formData.age > 0 && <div className="mt-3"><Badge className="bg-[#E6F0FA] text-[#0072CE]">Age: {formData.age} years</Badge></div>}
                </div>
                 <div>
                    <Label className="block text-sm font-medium text-[#003366] mb-3">Gender *</Label>
                     <RadioGroup 
                        value={formData.gender} 
                        onValueChange={(value) => {
                          if (!isCompleted) {
                            setFormData({ ...formData, gender: value });
                          }
                        }}
                        disabled={isCompleted}
                        className="grid grid-cols-2 gap-2"
                      >
                        <Label htmlFor="g-male" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.gender === 'male' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isCompleted ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="male" id="g-male" className="sr-only" disabled={isCompleted} /><span className="text-lg"></span>Male</Label>
                        <Label htmlFor="g-female" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.gender === 'female' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isCompleted ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="female" id="g-female" className="sr-only" disabled={isCompleted} />Female</Label>
                        <Label htmlFor="g-other" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.gender === 'other' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isCompleted ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="other" id="g-other" className="sr-only" disabled={isCompleted} />Other</Label>
                        <Label htmlFor="g-not-specified" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all", formData.gender === 'not-specified' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300', isCompleted ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}><RadioGroupItem value="not-specified" id="g-not-specified" className="sr-only" disabled={isCompleted} />Not Specified</Label>
                    </RadioGroup>
                    {(isAutoFilledViaAadhaar || currentLead?.formData?.step2?.autoFilledViaAadhaar) && (
                      <p className="text-xs text-gray-400 mt-2">Auto-filled and verified via Aadhaar OCR workflow</p>
                    )}
                </div>
                 <div>
                    <Label htmlFor="email-input" className="text-sm font-medium text-[#003366] mb-2 block">Email</Label>
                    <Input 
                        id="email-input" 
                        type="email"
                        placeholder="example@email.com" 
                        value={formData.email} 
                        onChange={(e) => {
                          if (!isCompleted) {
                            setFormData({ ...formData, email: e.target.value });
                          }
                        }}
                        disabled={isCompleted}
                        className={cn("w-full h-12 px-4 py-3 border-gray-300 rounded-xl", isCompleted && "bg-gray-50 cursor-not-allowed")}
                    />
                </div>
            </div>
            
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
        <div className="flex gap-3 max-w-2xl mx-auto">
          {needsPanValidation ? (
            <Button 
              onClick={handleValidatePan} 
              disabled={isCompleted || !formData.dob || !formData.gender || isVerifyingPan}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isVerifyingPan ? 'Validating...' : 'Validate Pan'}
            </Button>
          ) : (
            <Button 
              onClick={handleSave} 
              disabled={isCompleted || !canSave || isVerifyingPan}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isVerifyingPan ? 'Saving...' : 'Save Information'}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}