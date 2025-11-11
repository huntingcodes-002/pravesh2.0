'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle, AlertTriangle, Loader, Edit, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

type ValidationStatus = 'pending' | 'valid' | 'invalid' | 'mismatch';

interface Address {
  id: string;
  addressType: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  landmark: string;
  postalCode: string;
  isPrimary: boolean;
}

function NameEditDialog({
  isOpen,
  setIsOpen,
  currentFirstName,
  currentLastName,
  currentMismatchReason,
  onSave
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentFirstName: string;
  currentLastName: string;
  currentMismatchReason: string;
  onSave: (newFirstName: string, newLastName: string, mismatchReason: string) => void;
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

export default function ApplicantDetailsPage() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  const { toast } = useToast();

  // Step 2 form data (PAN and Personal Details)
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
  });

  const [panValidationStatus, setPanValidationStatus] = useState<ValidationStatus>('pending');
  const [panApiName, setPanApiName] = useState('');
  const [nameMismatchReason, setNameMismatchReason] = useState(currentLead?.formData?.step2?.nameMismatchReason || '');
  const [isPanTouched, setIsPanTouched] = useState(false);
  const [isVerifyingPan, setIsVerifyingPan] = useState(false);
  const [panFormatError, setPanFormatError] = useState('');
  const [dobMismatch, setDobMismatch] = useState(false);
  const [nameMismatch, setNameMismatch] = useState(false);

  // Track last successful validation data to prevent re-validation
  const [lastValidatedData, setLastValidatedData] = useState<{
    pan: string;
    firstName: string;
    lastName: string;
    dob?: string;
  } | null>(null);

  const [isNameEditOpen, setIsNameEditOpen] = useState(false);
  const [localFirstName, setLocalFirstName] = useState(currentLead?.customerFirstName || '');
  const [localLastName, setLocalLastName] = useState(currentLead?.customerLastName || '');

  // Step 3 form data (Addresses)
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [collapsedAddresses, setCollapsedAddresses] = useState<Set<string>>(new Set());

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
      }));
      setLocalFirstName(currentLead.customerFirstName || '');
      setLocalLastName(currentLead.customerLastName || '');
      setNameMismatchReason(step2Data.nameMismatchReason || '');

      // Only validate PAN if it exists and hasn't been successfully validated with the same data
      if (currentLead.panNumber) {
        setIsPanTouched(true);
        const pan = currentLead.panNumber;
        const firstName = currentLead.customerFirstName || '';
        const lastName = currentLead.customerLastName || '';
        const dob = currentLead.dob;

        // Check if we need to validate (data changed or never validated)
        const dataChanged = !lastValidatedData || 
          lastValidatedData.pan !== pan ||
          lastValidatedData.firstName !== firstName ||
          lastValidatedData.lastName !== lastName ||
          lastValidatedData.dob !== dob;

        // Only validate if data changed or status is not 'valid'
        if (dataChanged || panValidationStatus !== 'valid') {
          handlePanValidation(pan, firstName, lastName, dob);
        } else if (panValidationStatus === 'valid' && lastValidatedData) {
          // Restore validation state if already validated with same data
          // TODO: Replace with actual API call to restore PAN validation state
        }
      }

      // Load addresses
      if (currentLead.formData?.step3?.addresses) {
        setAddresses(currentLead.formData.step3.addresses);
      } else {
        setAddresses([{
          id: Date.now().toString(),
          addressType: 'residential',
          addressLine1: '',
          addressLine2: '',
          addressLine3: '',
          landmark: '',
          postalCode: '',
          isPrimary: false,
        }]);
      }
    }
  }, [currentLead]);

  const handlePanValidation = React.useCallback((pan: string, firstName: string, lastName: string, dob?: string) => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(pan)) {
      setPanFormatError('Invalid Pan');
      setPanValidationStatus('invalid');
      setPanApiName('');
      setNameMismatch(false);
      setDobMismatch(false);
      setLastValidatedData(null);
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
      // TODO: Replace with actual API call for PAN validation
      // For now, just mark as pending since mock validation is removed
      setPanValidationStatus('pending');
      setPanApiName('');
      setNameMismatch(false);
      setDobMismatch(false);
      setLastValidatedData(null);
      setIsVerifyingPan(false);
    }, 1500);
  }, []);

  const handlePanInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (formData.hasPan === 'yes') {
      const newPan = e.target.value.toUpperCase();
      const panChanged = newPan !== formData.pan;
      
      if (panChanged) {
        setFormData(prev => ({ ...prev, pan: newPan }));
        // Clear validation if PAN changed
        setPanValidationStatus('pending');
        setLastValidatedData(null);
      }
      
      // Validate only if PAN changed or not yet validated
      if (panChanged || panValidationStatus === 'pending') {
        if (newPan.length === 10) {
          handlePanValidation(newPan, localFirstName, localLastName, formData.dob);
        }
      }
    }
  };

  const handleNameSave = (newFirstName: string, newLastName: string, mismatchReason: string) => {
    const nameChanged = newFirstName !== localFirstName || newLastName !== localLastName;
    setLocalFirstName(newFirstName);
    setLocalLastName(newLastName);
    setNameMismatchReason(mismatchReason);

    // Only re-validate if name changed and we have PAN
    if (formData.hasPan === 'yes' && formData.pan.length === 10 && formData.dob && nameChanged) {
      // Clear last validated data since name changed
      setLastValidatedData(null);
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
      const dobChanged = formData.dob !== dobString;
      setFormData({ ...formData, dob: dobString, age: age });

      // Only re-validate if DOB changed and we have PAN
      if (formData.hasPan === 'yes' && formData.pan.length === 10 && dobChanged) {
        // Clear last validated data since DOB changed
        setLastValidatedData(null);
        handlePanValidation(formData.pan, localFirstName, localLastName, dobString);
      }
    }
  };

  // Address handlers
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

    if (formData.hasPan === 'yes' && panValidationStatus === 'invalid') {
      toast({
        title: 'Validation Error',
        description: 'Please fix PAN validation errors before saving.',
        variant: 'destructive'
      });
      return;
    }

    // Save both step2 and step3 data
    updateLead(currentLead.id, {
      formData: {
        ...currentLead.formData,
        step2: { ...formData, nameMismatchReason },
        step3: { addresses }
      },
      customerFirstName: localFirstName,
      customerLastName: localLastName,
      panNumber: formData.hasPan === 'yes' ? formData.pan : '',
      dob: formData.dob,
      age: formData.age,
    });

    toast({
      title: 'Information Saved',
      description: 'Applicant details have been saved successfully.',
      className: 'bg-green-50 border-green-200'
    });

    // Navigate back to New Lead Information
    router.push('/lead/new-lead-info');
  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };

  const isPanValidAndMatched = formData.hasPan === 'yes' && (panValidationStatus === 'valid' || (panValidationStatus === 'mismatch' && !dobMismatch));
  const isNoPanValid = formData.hasPan === 'no' && formData.panUnavailabilityReason && formData.alternateIdType && formData.documentNumber;

  const customerFullName = `${localFirstName} ${localLastName}`.trim();
  const isNameMismatch = panValidationStatus === 'mismatch';

  if (!currentLead) {
    return null;
  }

  return (
    <DashboardLayout title="Applicant Details" showNotifications={false} showExitButton={true} onExit={handleExit}>
      <NameEditDialog
        isOpen={isNameEditOpen}
        setIsOpen={setIsNameEditOpen}
        currentFirstName={localFirstName}
        currentLastName={localLastName}
        currentMismatchReason={nameMismatchReason}
        onSave={handleNameSave}
      />

      <div className="max-w-2xl mx-auto pb-24">
        {/* Step 2: Identity & Personal Details */}
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
                        setFormData(prev => ({ ...prev, pan: newPan }));

                        if (newPan.length === 10) {
                          const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
                          if (!panRegex.test(newPan)) {
                            setPanFormatError('Invalid Pan');
                            setPanValidationStatus('invalid');
                            setNameMismatch(false);
                            setDobMismatch(false);
                          } else {
                            setPanFormatError('');
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
                      <X className="w-4 h-4" /> PAN doesn&apos;t exist
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
                  <Select value={formData.panUnavailabilityReason} onValueChange={(v: string) => setFormData({ ...formData, panUnavailabilityReason: v })}>
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
                    <Textarea value={formData.panUnavailabilityNotes} onChange={e => setFormData({ ...formData, panUnavailabilityNotes: e.target.value })} placeholder="Please provide additional details..." className="rounded-xl" />
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-[#003366] mb-2 block">Alternate Primary ID Type *</Label>
                  <Select value={formData.alternateIdType} onValueChange={(v: string) => setFormData({ ...formData, alternateIdType: v })}>
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
                  <Input value={formData.documentNumber} onChange={e => setFormData({ ...formData, documentNumber: e.target.value })} placeholder="Enter document number" className="h-12 rounded-xl" />
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
          </div>
        </div>

        {formData.hasPan === 'no' && (
          <div className="mb-4">
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

        {/* Step 3: Address Information */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6 border border-gray-100 mb-4">
          <h2 className="text-xl font-semibold text-[#003366] mb-6">Address Information</h2>

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

        {/* Fixed Bottom Button - Only Save Information */}
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
