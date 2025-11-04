'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle, AlertTriangle, Loader, Edit, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { submitPersonalInfo, isApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DatePicker } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
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


  useEffect(() => {
    if (currentLead) {
        const step2Data = currentLead.formData?.step2 || {};
        setFormData(prev => ({
            ...prev,
            customerType: 'individual',
            pan: currentLead.panNumber || '',
            dob: currentLead.dob || '',
            age: currentLead.age || 0,
            gender: currentLead.gender || '',
            email: currentLead.formData?.step2?.email || '',
        }));
        setLocalFirstName(currentLead.customerFirstName || '');
        setLocalLastName(currentLead.customerLastName || '');
        setNameMismatchReason(step2Data.nameMismatchReason || '');
        
        if (currentLead.panNumber) {
            setIsPanTouched(true);
            // PAN validation now only happens via API when user clicks "Validate Pan"
        }
    }
  }, [currentLead]);

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

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      const dobString = format(date, 'yyyy-MM-dd');
      const today = new Date();
      const birthDate = new Date(dobString);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setFormData({ ...formData, dob: dobString, age: age });
      // PAN validation will be triggered via button now, not automatically
    }
  };

  const handleValidatePan = async () => {
    // Prevent validation if section is already completed
    if (isCompleted) {
      toast({
        title: 'Section Completed',
        description: 'This section has already been completed and submitted. It is now read-only.',
        variant: 'default',
      });
      return;
    }

    if (!currentLead?.appId) {
      toast({
        title: 'Error',
        description: 'Application ID not found. Please create a new lead first.',
        variant: 'destructive',
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

    try {
      // Endpoint 3: Submit Personal Info
      const response = await submitPersonalInfo({
        application_id: currentLead.appId,
        customer_type: 'individual',
        pan_number: formData.pan,
        date_of_birth: formData.dob,
        gender: formData.gender,
        email: formData.email || undefined,
      });

      if (isApiError(response)) {
        // On API error, don't mark as completed - allow retry
        if (currentLead) {
          updateLead(currentLead.id, {
            step2Completed: false, // Ensure not marked as completed on error
          });
        }
        
        toast({
          title: 'Validation Failed',
          description: response.error || 'Failed to validate PAN. Please try again.',
          variant: 'destructive',
        });
        setPanValidationStatus('invalid');
        setIsVerifyingPan(false);
        return;
      }

      // Debug: Log the full response
      console.log('PAN Validation Response:', response);
      console.log('Response structure:', {
        success: response.success,
        hasData: !!(response as any).data,
        dataKeys: response.success ? Object.keys((response as any).data || {}) : [],
      });

      // Success response - apiFetch returns the backend response as ApiSuccess<PersonalInfoResponse>
      // The backend response structure: { success: true, message, application_id, next_step, data: { ... } }
      // apiFetch wraps it, so response.data is PersonalInfoResponse which has its own data field
      if (response.success) {
        // Try multiple ways to access the response data
        // The response might be: response.data.data or just response.data
        const personalInfoResponse = (response as any).data;
        const responseData = personalInfoResponse?.data || personalInfoResponse;
        
        console.log('PersonalInfoResponse:', personalInfoResponse);
        console.log('Response data:', responseData);
        console.log('PAN Verification Status:', responseData?.pan_verification_status);
        
        // Check if we have pan_verification_status in the response
        const panVerificationStatus = responseData?.pan_verification_status;
        
        if (!panVerificationStatus) {
          // If pan_verification_status is not found, don't set to invalid - just log and wait
          console.warn('PAN verification status not found in response. Response structure:', {
            personalInfoResponse,
            responseData,
            responseKeys: response.success ? Object.keys((response as any) || {}) : [],
          });
          // Keep the status as pending rather than invalid
          setPanValidationStatus('pending');
          setIsVerifyingPan(false);
          toast({
            title: 'Warning',
            description: 'PAN verification status not found in response. Please try again.',
            variant: 'destructive',
          });
          return;
        }
        
        // Update validation status based on PAN verification status
        if (panVerificationStatus === 'verified') {
          console.log('Setting PAN validation status to valid');
          setPanValidationStatus('valid');
          
          // Extract name from masked PAN response if available
          if (responseData.pan_number) {
            // PAN is masked like "AEE***1A", we can't extract name from this
            // But we can mark it as verified
            setPanApiName('Verified'); // Placeholder since name isn't in response
          }
          
          // Update lead context with response data and mark as completed
          if (currentLead) {
            updateLead(currentLead.id, {
              panNumber: responseData.pan_number || formData.pan,
              dob: responseData.date_of_birth || formData.dob,
              gender: responseData.gender || formData.gender,
              step2Completed: true, // Mark section as completed
              formData: {
                ...currentLead.formData,
                step2: {
                  ...formData,
                  email: responseData.email || formData.email,
                },
              },
            });
          }

          toast({
            title: 'Success',
            description: 'PAN verified successfully. Personal information saved and marked as completed.',
            className: 'bg-green-50 border-green-200',
          });
        } else {
          // PAN verification status exists but is not 'verified'
          console.log('Setting PAN validation status to mismatch - status:', panVerificationStatus);
          setPanValidationStatus('mismatch');
          
          // Update lead context with response data even on mismatch
          // Don't mark as completed if there's a mismatch - allow retry
          if (currentLead) {
            updateLead(currentLead.id, {
              panNumber: responseData.pan_number || formData.pan,
              dob: responseData.date_of_birth || formData.dob,
              gender: responseData.gender || formData.gender,
              step2Completed: false, // Don't mark as completed on mismatch - allow retry
              formData: {
                ...currentLead.formData,
                step2: {
                  ...formData,
                  email: responseData.email || formData.email,
                },
              },
            });
          }

          toast({
            title: 'Validation Issue',
            description: 'PAN verification found mismatches. Please review the details.',
            variant: 'destructive',
          });
        }
      } else {
        // Response is not successful (shouldn't happen if isApiError didn't catch it)
        console.error('Response is not successful:', response);
        setPanValidationStatus('pending');
      }

      setIsVerifyingPan(false);
    } catch (error: any) {
      // On error, don't mark as completed - allow retry
      if (currentLead) {
        updateLead(currentLead.id, {
          step2Completed: false, // Ensure not marked as completed on error
        });
      }
      
      toast({
        title: 'Validation Failed',
        description: error.message || 'Failed to validate PAN. Please try again.',
        variant: 'destructive',
      });
      setPanValidationStatus('invalid');
      setIsVerifyingPan(false);
    }
  };

  const handleSave = () => {
    if (!currentLead) return;
    
    if (panValidationStatus === 'invalid') {
      return;
    }
    
    updateLead(currentLead.id, {
      formData: { 
        ...currentLead.formData, 
        step2: { ...formData, nameMismatchReason },
      },
      customerFirstName: localFirstName,
      customerLastName: localLastName,
      panNumber: formData.pan,
      dob: formData.dob,
      age: formData.age,
      gender: formData.gender,
    });
    
    router.push('/lead/new-lead-info');
  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };
  
  // Check if PAN validation needs to be done - only show Validate Pan button if not already verified
  const needsPanValidation = formData.pan.length === 10 && formData.dob && panValidationStatus !== 'valid' && (panValidationStatus === 'pending' || panValidationStatus === 'mismatch');
  
  // Enable Save Information button when:
  // 1. PAN is verified (panValidationStatus === 'valid') - enable immediately
  // 2. Otherwise, require all fields and no DOB mismatch
  const canProceed = (() => {
    // If PAN is verified by API, enable button immediately (backend has validated everything)
    if (panValidationStatus === 'valid') {
      return true; // Enable immediately when verified
    }
    
    // If PAN is not verified yet, check required fields
    const hasRequiredFields = formData.dob && formData.gender && formData.pan.length === 10;
    return hasRequiredFields && !dobMismatch && (panValidationStatus === 'mismatch' || panValidationStatus === 'pending');
  })();
  
  // Debug logging
  React.useEffect(() => {
    console.log('Save Information Button Debug:', {
      canProceed,
      panValidationStatus,
      hasDOB: !!formData.dob,
      hasGender: !!formData.gender,
      panLength: formData.pan.length,
      dobMismatch,
      needsPanValidation,
    });
  }, [canProceed, panValidationStatus, formData.dob, formData.gender, formData.pan.length, dobMismatch, needsPanValidation]);

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
            <div className="border-b border-gray-100 pb-2 mb-6">
                <h3 className="text-sm font-semibold text-[#003366]">Identity Verification</h3>
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
                                        setFormData(prev => ({...prev, pan: newPan}));
                                        
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
                                                // Clear validation status to allow manual validation
                                                setPanValidationStatus('pending');
                                                setNameMismatch(false);
                                                setDobMismatch(false);
                                            }
                                        } else {
                                            setPanFormatError('');
                                            setPanValidationStatus('pending');
                                            setNameMismatch(false);
                                            setDobMismatch(false);
                                        }
                                    }}
                                    onBlur={handlePanInputBlur} 
                                    disabled={isCompleted}
                                    className={cn("w-full h-12 px-4 py-3 border-gray-300 rounded-xl uppercase tracking-wider", panValidationStatus === 'invalid' && 'border-red-500', isCompleted && 'bg-gray-50 cursor-not-allowed')}
                                />
                                <div className="absolute right-3 h-full flex items-center">
                                    {isVerifyingPan && <Loader className="text-[#0072CE] animate-spin w-5 h-5" />}
                                    {!isVerifyingPan && panValidationStatus === 'valid' && <CheckCircle className="text-[#16A34A] w-5 h-5" />}
                                    {!isVerifyingPan && panValidationStatus === 'invalid' && <X className="text-[#DC2626] w-5 h-5" />}
                                    {!isVerifyingPan && panValidationStatus === 'mismatch' && <AlertTriangle className="text-yellow-600 w-5 h-5" />}
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
                </div>
            
            <div className="border-t border-gray-100 pt-6 mt-6 space-y-6">
                 <h3 className="text-sm font-semibold text-[#003366]">Personal Details</h3>
                 <div>
                    <Label className="text-sm font-medium text-[#003366] mb-2 block flex items-center gap-2">
                        Date of Birth *
                        {dobMismatch && formData.dob && <AlertTriangle className="text-yellow-600 w-4 h-4" />}
                    </Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button 
                                variant={"outline"} 
                                disabled={isCompleted}
                                className={cn("w-full justify-start text-left font-normal h-12 rounded-xl", !formData.dob && "text-muted-foreground", isCompleted && "bg-gray-50 cursor-not-allowed")}
                            >
                                <Calendar className="mr-2 h-4 w-4" />
                                {formData.dob ? format(new Date(formData.dob), "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        {!isCompleted && (
                          <PopoverContent className="w-auto p-0">
                            <DatePicker mode="single" selected={formData.dob ? new Date(formData.dob) : undefined} onSelect={handleDateChange} captionLayout="dropdown-buttons" fromYear={1920} toYear={new Date().getFullYear()} />
                          </PopoverContent>
                        )}
                    </Popover>
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
              disabled={isCompleted || !formData.dob || isVerifyingPan}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isVerifyingPan ? 'Validating...' : 'Validate Pan'}
            </Button>
          ) : (
            <Button 
              onClick={handleSave} 
              disabled={isCompleted || (panValidationStatus !== 'valid' && !canProceed)}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Save Information
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}