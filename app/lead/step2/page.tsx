'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle, AlertTriangle, Loader, Edit, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressBar from '@/components/ProgressBar';
import { useLead } from '@/contexts/LeadContext';
import { validatePANDetails, PAN_DATA } from '@/lib/mock-auth'; 
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
    maritalStatus: currentLead?.formData?.step2?.maritalStatus || '',
    email: currentLead?.formData?.step2?.email || '',
  });

  const [panValidationStatus, setPanValidationStatus] = useState<ValidationStatus>('pending');
  const [panApiName, setPanApiName] = useState('');
  const [nameMismatchReason, setNameMismatchReason] = useState(currentLead?.formData?.step2?.nameMismatchReason || '');
  const [isPanTouched, setIsPanTouched] = useState(false);
  const [isVerifyingPan, setIsVerifyingPan] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [panFormatError, setPanFormatError] = useState('');
  const [dobMismatch, setDobMismatch] = useState(false);
  const [nameMismatch, setNameMismatch] = useState(false);
  
  const [isNameEditOpen, setIsNameEditOpen] = useState(false);
  const [localFirstName, setLocalFirstName] = useState(currentLead?.customerFirstName || '');
  const [localLastName, setLocalLastName] = useState(currentLead?.customerLastName || '');

  const handlePanValidation = React.useCallback((pan: string, firstName: string, lastName: string, dob?: string) => {
    // Check PAN format first
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(pan)) {
        setPanFormatError('Invalid Pan');
        setPanValidationStatus('invalid');
        setPanApiName('');
        setNameMismatch(false);
        setDobMismatch(false);
        return;
    }
    setPanFormatError('');
    
    if (pan.length !== 10) {
        setPanValidationStatus('pending');
        setPanApiName('');
        setNameMismatch(false);
        setDobMismatch(false);
        return;
    }
    setIsVerifyingPan(true);
    setPanValidationStatus('pending');
    
    setTimeout(() => {
        const result = validatePANDetails(pan, 'Mr', firstName, lastName, dob);
        const panData = PAN_DATA.find((p: any) => p.pan.toUpperCase() === pan.toUpperCase());

        if (panData) {
            const fetchedName = `${panData.firstName} ${panData.lastName}`.trim().toUpperCase();
            setPanApiName(fetchedName);
            
            // Check for name mismatch
            if (!result.firstNameMatch || !result.lastNameMatch) {
                setNameMismatch(true);
            } else {
                setNameMismatch(false);
            }
            
            // Check for DOB mismatch
            if (dob && !result.dateOfBirthMatch) {
                setDobMismatch(true);
            } else {
                setDobMismatch(false);
            }
            
            if (result.firstNameMatch && result.lastNameMatch && result.dateOfBirthMatch) {
                setPanValidationStatus('valid');
            } else {
                setPanValidationStatus('mismatch');
            }
        } else {
            setPanValidationStatus('invalid');
            setPanApiName('');
            setNameMismatch(false);
            setDobMismatch(false);
        }
        setIsVerifyingPan(false);
    }, 1500);
  }, []);

  useEffect(() => {
    if (currentLead) {
        const step2Data = currentLead.formData?.step2 || {};
        setFormData(prev => ({
            ...prev,
            customerType: 'individual',
            hasPan: step2Data.hasPan || 'yes',
            pan: currentLead.panNumber || '',
            panUnavailabilityReason: step2Data.panUnavailabilityReason || '',
            panUnavailabilityNotes: step2Data.panUnavailabilityNotes || '',
            alternateIdType: step2Data.alternateIdType || '',
            documentNumber: step2Data.documentNumber || '',
            dob: currentLead.dob || '',
            age: currentLead.age || 0,
            gender: currentLead.gender || '',
            maritalStatus: step2Data.maritalStatus || '',
            email: step2Data.email || '',
        }));
        setLocalFirstName(currentLead.customerFirstName || '');
        setLocalLastName(currentLead.customerLastName || '');
        setNameMismatchReason(step2Data.nameMismatchReason || '');
        
        if (currentLead.panNumber) {
            setIsPanTouched(true);
            handlePanValidation(currentLead.panNumber, currentLead.customerFirstName || '', currentLead.customerLastName || '', currentLead.dob);
        }
    }
  }, [currentLead, handlePanValidation]);

  // Removed: PAN validation should only trigger after DOB is set, not on PAN input change
  
  const handlePanInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (formData.hasPan === 'yes') {
        const newPan = e.target.value.toUpperCase();
        if (newPan !== formData.pan || panValidationStatus === 'pending') {
             setFormData(prev => ({...prev, pan: newPan}));
        }
    }
  };

  const handleNameSave = (newFirstName: string, newLastName: string, mismatchReason: string) => {
    setLocalFirstName(newFirstName);
    setLocalLastName(newLastName);
    setNameMismatchReason(mismatchReason);
    
    // Re-trigger PAN validation after name change if PAN and DOB are present
    if (formData.hasPan === 'yes' && formData.pan.length === 10 && formData.dob) {
      handlePanValidation(formData.pan, newFirstName, newLastName, formData.dob);
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
      
      // Trigger PAN verification after DOB is set
      if (formData.hasPan === 'yes' && formData.pan.length === 10) {
        handlePanValidation(formData.pan, localFirstName, localLastName, dobString);
      }
    }
  };

  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const email = e.target.value;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailError('Please enter a valid email address.');
    } else {
        setEmailError('');
    }
  };

  const handleNext = () => {
    if (!currentLead) return;
    
    if (formData.hasPan === 'yes' && panValidationStatus === 'invalid') {
        return;
    }
    
    updateLead(currentLead.id, {
      formData: { ...currentLead.formData, step2: { ...formData, nameMismatchReason } },
      customerFirstName: localFirstName,
      customerLastName: localLastName,
      panNumber: formData.hasPan === 'yes' ? formData.pan : '',
      dob: formData.dob,
      age: formData.age,
      gender: formData.gender,
      currentStep: 3,
    });
    router.push('/lead/step3');
  };

  const handlePrevious = () => {
    router.push('/lead/step1');
  };
  
  const isPanValidAndMatched = formData.hasPan === 'yes' && (panValidationStatus === 'valid' || (panValidationStatus === 'mismatch' && !dobMismatch));
  const isNoPanValid = formData.hasPan === 'no' && formData.panUnavailabilityReason && formData.alternateIdType && formData.documentNumber;
  
  const canProceed = formData.dob && formData.gender && formData.maritalStatus && !emailError && !dobMismatch && (isPanValidAndMatched || isNoPanValid);
    
  const customerFullName = `${localFirstName} ${localLastName}`.trim();
  const isNameMismatch = panValidationStatus === 'mismatch';

  return (
    <DashboardLayout title="Customer Details" showNotifications={false} showExitButton={true}>
      <NameEditDialog
            isOpen={isNameEditOpen}
            setIsOpen={setIsNameEditOpen}
            currentFirstName={localFirstName}
            currentLastName={localLastName}
            currentMismatchReason={nameMismatchReason}
            onSave={handleNameSave}
        />
        
      <div className="max-w-2xl mx-auto pb-24">
        <ProgressBar currentStep={2} totalSteps={10} />
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
            <div className="space-y-4">
                 <div className="flex items-start justify-between">
                    <div>
                        <Label className="block text-xs font-medium text-neutral mb-1">Customer Name</Label>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[#003366]">{customerFullName || 'N/A'}</p>
                            {isNameMismatch && (
                                <AlertTriangle className="text-yellow-600 w-4 h-4" />
                            )}
                        </div>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsNameEditOpen(true)}
                        className='w-8 h-8 rounded-full flex-shrink-0'
                        title="Edit Customer Name"
                        disabled={!isNameMismatch}
                    >
                        <Edit className="w-4 h-4 text-blue-600" />
                    </Button>
                </div>
                <div>
                    <Label className="block text-xs font-medium text-neutral mb-1">Mobile Number</Label>
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#003366]">{currentLead?.customerMobile ? `+91-${currentLead.customerMobile}` : 'N/A'}</p>
                        <CheckCircle className="text-[#16A34A] w-4 h-4" />
                    </div>
                </div>
                 <div>
                    <Label className="block text-xs font-medium text-neutral mb-1">Customer Type</Label>
                    <p className="text-sm font-medium text-[#003366]">Individual</p>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6 mb-4">
            <div className="border-b border-gray-100 pb-2 mb-6">
                <h3 className="text-sm font-semibold text-[#003366]">Identity Verification</h3>
            </div>
          
            <div className="space-y-6">
                <div>
                    <Label className="block text-sm font-medium text-[#003366] mb-3">Does the customer have a PAN? *</Label>
                    <RadioGroup value={formData.hasPan} onValueChange={(value) => {
                        setFormData({ ...formData, hasPan: value, pan: '' });
                        setPanValidationStatus('pending');
                        setPanApiName('');
                        setIsPanTouched(false);
                        // Clear all error states when switching PAN status
                        setDobMismatch(false);
                        setNameMismatch(false);
                        setPanFormatError('');
                    }} className="flex gap-4">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="pan-yes" /><Label htmlFor="pan-yes" className="font-normal">Yes</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="pan-no" /><Label htmlFor="pan-no" className="font-normal">No</Label></div>
                    </RadioGroup>
                </div>
                
                {formData.hasPan === 'yes' && (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="pan-input" className="text-sm font-medium text-[#003366] mb-2 block">PAN Number *</Label>
                             <div className="relative flex items-center">
                                <Input 
                                    id="pan-input" 
                                    maxLength={10} 
                                    placeholder="ABCDE1234F" 
                                    value={formData.pan} 
                                    onChange={e => {
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
                                                // If DOB is set, trigger full validation
                                                if (formData.dob) {
                                                    handlePanValidation(newPan, localFirstName, localLastName, formData.dob);
                                                }
                                            }
                                        } else {
                                            setPanFormatError('');
                                            setPanValidationStatus('pending');
                                            setNameMismatch(false);
                                            setDobMismatch(false);
                                        }
                                    }}
                                    onBlur={handlePanInputBlur} 
                                    className={cn("w-full h-12 px-4 py-3 border-gray-300 rounded-xl uppercase tracking-wider", panValidationStatus === 'invalid' && 'border-red-500')}
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
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="text-[#16A34A] w-5 h-5" />
                                        <span className="text-sm font-medium text-[#16A34A]">PAN Verified</span>
                                    </div>
                                </div>
                                <p className="text-sm text-[#003366]">Name on PAN: <span className="font-medium">{panApiName}</span></p>
                            </div>
                        )}
                    </div>
                )}
                
                {formData.hasPan === 'no' && (
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">PAN Unavailability Reason *</Label>
                            <Select value={formData.panUnavailabilityReason} onValueChange={(v: string) => setFormData({...formData, panUnavailabilityReason: v})}>
                                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select reason" /></SelectTrigger>
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
                                <Textarea value={formData.panUnavailabilityNotes} onChange={e => setFormData({...formData, panUnavailabilityNotes: e.target.value})} placeholder="Please provide additional details..." className="rounded-xl"/>
                            </div>
                        )}
                        <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">Alternate Primary ID Type *</Label>
                            <Select value={formData.alternateIdType} onValueChange={(v: string) => setFormData({...formData, alternateIdType: v})}>
                                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select ID Type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Passport">Passport</SelectItem>
                                    <SelectItem value="Voter ID">Voter ID</SelectItem>
                                    <SelectItem value="Driving License">Driving License</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-sm font-medium text-[#003366] mb-2 block">Document Number *</Label>
                            <Input value={formData.documentNumber} onChange={e => setFormData({...formData, documentNumber: e.target.value})} placeholder="Enter document number" className="h-12 rounded-xl"/>
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
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-12 rounded-xl", !formData.dob && "text-muted-foreground")}>
                                <Calendar className="mr-2 h-4 w-4" />
                                {formData.dob ? format(new Date(formData.dob), "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><DatePicker mode="single" selected={formData.dob ? new Date(formData.dob) : undefined} onSelect={handleDateChange} captionLayout="dropdown-buttons" fromYear={1920} toYear={new Date().getFullYear()} /></PopoverContent>
                    </Popover>
                    {formData.age > 0 && <div className="mt-3"><Badge className="bg-[#E6F0FA] text-[#0072CE]">Age: {formData.age} years</Badge></div>}
                </div>
                 <div>
                    <Label className="block text-sm font-medium text-[#003366] mb-3">Gender *</Label>
                     <RadioGroup value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })} className="grid grid-cols-2 gap-2">
                        <Label htmlFor="g-male" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer", formData.gender === 'male' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300')}><RadioGroupItem value="male" id="g-male" className="sr-only" /><span className="text-lg"></span>Male</Label>
                        <Label htmlFor="g-female" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer", formData.gender === 'female' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300')}><RadioGroupItem value="female" id="g-female" className="sr-only" />Female</Label>
                        <Label htmlFor="g-other" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer", formData.gender === 'other' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300')}><RadioGroupItem value="other" id="g-other" className="sr-only" />Other</Label>
                        <Label htmlFor="g-not-specified" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer", formData.gender === 'not-specified' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300')}><RadioGroupItem value="not-specified" id="g-not-specified" className="sr-only" />Not Specified</Label>
                    </RadioGroup>
                </div>
                <div>
                    <Label className="block text-sm font-medium text-[#003366] mb-3">Marital Status *</Label>
                     <RadioGroup value={formData.maritalStatus} onValueChange={(value) => setFormData({ ...formData, maritalStatus: value })} className="grid grid-cols-3 gap-2">
                        <Label htmlFor="m-single" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer", formData.maritalStatus === 'single' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300')}><RadioGroupItem value="single" id="m-single" className="sr-only" />Single</Label>
                        <Label htmlFor="m-married" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer", formData.maritalStatus === 'married' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300')}><RadioGroupItem value="married" id="m-married" className="sr-only" />Married</Label>
                        <Label htmlFor="m-divorced" className={cn("flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer", formData.maritalStatus === 'divorced' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300')}><RadioGroupItem value="divorced" id="m-divorced" className="sr-only" />Divorced</Label>
                    </RadioGroup>
                </div>
                <div>
                    <Label className="text-sm font-medium text-[#003366] mb-2 block">Email (Optional)</Label>
                    <Input type="email" value={formData.email} onBlur={handleEmailBlur} onChange={e => { setFormData({...formData, email: e.target.value}); if (emailError) setEmailError(''); }} placeholder="customer@example.com" className={cn("h-12 rounded-xl", emailError && "border-red-500")}/>
                    {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
                </div>
            </div>
            
        </div>
        
        {/* Important Note - PAN Notification */}
        {formData.hasPan === 'no' && (
          <div className="max-w-2xl mx-auto pb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Important Note</h4>
                <p className="text-sm text-blue-800">
                  PAN must be provided before sanction. A follow-up task will be created automatically.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
            <div className="flex gap-3 max-w-2xl mx-auto">
                <Button onClick={handlePrevious} variant="outline" className="flex-1 h-12 rounded-lg">
                  Previous
                </Button>
                <Button onClick={handleNext} disabled={!canProceed} className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]">
                  Next
                </Button>
            </div>
        </div>
    </DashboardLayout>
  );
}