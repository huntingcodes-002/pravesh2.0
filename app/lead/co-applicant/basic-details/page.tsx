'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead, CoApplicant } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { MaskedDateInput } from '@/components/MaskedDateInput';
import { submitCoApplicantPersonalInfo, isApiError, type CoApplicantPersonalInfoResponse } from '@/lib/api';

type ValidationStatus = 'pending' | 'valid' | 'invalid';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function CoApplicantBasicDetailsContent() {
  const { currentLead, updateCoApplicant } = useLead();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const coApplicantId = searchParams.get('coApplicantId');

  const coApplicant: CoApplicant | undefined = useMemo(() => {
    if (!currentLead || !coApplicantId) return undefined;
    return currentLead.formData?.coApplicants?.find((ca: CoApplicant) => ca.id === coApplicantId);
  }, [currentLead, coApplicantId]);

  const existing = coApplicant?.data?.basicDetails ?? {};

  const [formData, setFormData] = useState({
    hasPan: existing.hasPan || 'yes',
    pan: existing.pan || '',
    panUnavailabilityReason: existing.panUnavailabilityReason || '',
    panUnavailabilityNotes: existing.panUnavailabilityNotes || '',
    alternateIdType: existing.alternateIdType || '',
    documentNumber: existing.documentNumber || '',
    dob: existing.dob || '',
    age: existing.age || 0,
    gender: existing.gender || '',
    maritalStatus: existing.maritalStatus || '',
    email: existing.email || '',
  });

  const [dobFormatted, setDobFormatted] = useState(
    formData.dob ? new Date(formData.dob).toLocaleDateString('en-GB') : ''
  );
  const [panValidationStatus, setPanValidationStatus] = useState<ValidationStatus>('pending');
  const [panFormatError, setPanFormatError] = useState('');
  const [isValidatingPan, setIsValidatingPan] = useState(false);
  const [isValidated, setIsValidated] = useState(
    coApplicant?.data?.basicDetails?.panValidated === true
  );

  useEffect(() => {
    setIsValidated(coApplicant?.data?.basicDetails?.panValidated === true);
  }, [coApplicant?.data?.basicDetails?.panValidated]);

  const isReadOnly = isValidated && formData.hasPan === 'yes';

  useEffect(() => {
    if (!currentLead || !coApplicant || !coApplicantId) {
      router.replace('/lead/co-applicant-info');
    }
  }, [currentLead, coApplicant, coApplicantId, router]);

  const handleDobChange = (value: string) => {
    if (isReadOnly) return;
    setDobFormatted(value);
    if (value.length === 10) {
      const [day, month, year] = value.split('/');
      const iso = `${year}-${month}-${day}`;
      const date = new Date(iso);
      if (!Number.isNaN(date.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const m = today.getMonth() - date.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
          age--;
        }
        setFormData(prev => ({ ...prev, dob: iso, age }));
        return;
      }
    }
    setFormData(prev => ({ ...prev, dob: '', age: 0 }));
  };

  useEffect(() => {
    if (formData.hasPan !== 'yes') {
      setPanFormatError('');
      setPanValidationStatus('pending');
      return;
    }

    if (!formData.maritalStatus || formData.pan.length !== 10) {
      setPanFormatError('');
      setPanValidationStatus('pending');
      return;
    }

    if (!PAN_REGEX.test(formData.pan)) {
      setPanFormatError('Invalid PAN format');
      setPanValidationStatus('invalid');
    } else {
      setPanFormatError('');
      setPanValidationStatus('valid');
    }
  }, [formData.hasPan, formData.pan, formData.maritalStatus]);

  useEffect(() => {
    if (isReadOnly) return;
    if (formData.hasPan === 'yes') {
      setIsValidated(false);
    }
  }, [formData.hasPan, formData.pan, formData.dob, formData.gender, formData.maritalStatus, isReadOnly]);

  const coApplicantIndex = coApplicant?.workflowIndex;

  const canValidatePan =
    formData.hasPan === 'yes' &&
    !!currentLead?.appId &&
    typeof coApplicantIndex === 'number' &&
    panValidationStatus === 'valid' &&
    formData.dob &&
    formData.gender &&
    formData.maritalStatus &&
    !isValidatingPan &&
    !isReadOnly;

  const canSave =
    (formData.hasPan === 'yes' &&
      isValidated) ||
    (formData.hasPan === 'no' &&
      formData.panUnavailabilityReason &&
      formData.alternateIdType &&
      formData.documentNumber &&
      formData.dob &&
      formData.gender &&
      formData.maritalStatus);

  const handleValidatePan = async () => {
    if (!coApplicantId) {
      toast({
        title: 'Co-applicant Missing',
        description: 'Unable to find this co-applicant. Please start again from the list.',
        variant: 'destructive',
      });
      return;
    }

    if (!coApplicant) {
      toast({
        title: 'Co-applicant Missing',
        description: 'Unable to locate this co-applicant record. Please return to the previous step.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentLead?.appId || typeof coApplicantIndex !== 'number') {
      toast({
        title: 'Setup Incomplete',
        description: 'Unable to validate PAN because workflow information is missing.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.dob || formData.pan.length !== 10) {
      toast({
        title: 'Validation Error',
        description: 'Please fill PAN and Date of Birth before validating.',
        variant: 'destructive',
      });
      return;
    }

    setIsValidatingPan(true);
    try {
      const response = await submitCoApplicantPersonalInfo({
        application_id: currentLead.appId,
        co_applicant_index: coApplicantIndex,
        customer_type: 'individual',
        pan_number: formData.pan,
        date_of_birth: formData.dob,
        gender: formData.gender,
        email: formData.email || undefined,
      });

      if (isApiError(response)) {
        const message = response.error || 'PAN validation failed.';
        toast({
          title: 'Validation Failed',
          description: message,
          variant: 'destructive',
        });
        setIsValidated(false);
        return;
      }

      const responseData = response as CoApplicantPersonalInfoResponse;
      if (responseData.success === false) {
        toast({
          title: 'Validation Failed',
          description: responseData.message || 'PAN validation failed.',
          variant: 'destructive',
        });
        setIsValidated(false);
        return;
      }

      setIsValidated(true);
      const existingBasic = coApplicant?.data?.basicDetails ?? {};
      updateCoApplicant(currentLead.id, coApplicantId, {
        relationship: coApplicant?.relationship,
        data: {
          basicDetails: {
            ...existingBasic,
            ...formData,
            isMobileVerified: existingBasic?.isMobileVerified,
            panValidated: true,
          },
        },
      });
      toast({
        title: 'PAN Validated',
        description: responseData.message || 'Co-applicant PAN validated successfully.',
        className: 'bg-green-50 border-green-200',
      });
    } catch (error: any) {
      toast({
        title: 'Validation Failed',
        description: error?.message || 'PAN validation failed. Please try again.',
        variant: 'destructive',
      });
      setIsValidated(false);
    } finally {
      setIsValidatingPan(false);
    }
  };

  const handleSave = () => {
    if (!currentLead || !coApplicantId) return;
    if (!canSave) {
      toast({
        title: 'Missing Information',
        description: 'Please fill all required fields before saving.',
        variant: 'destructive',
      });
      return;
    }

    updateCoApplicant(currentLead.id, coApplicantId, {
      relationship: coApplicant?.relationship,
      data: {
        ...coApplicant?.data,
        basicDetails: {
          ...(coApplicant?.data?.basicDetails ?? {}),
          ...formData,
          isMobileVerified: coApplicant?.data?.basicDetails?.isMobileVerified,
          panValidated: formData.hasPan === 'yes' ? isValidated : false,
        },
      },
    });

    toast({
      title: 'Saved',
      description: 'Co-applicant basic details saved successfully.',
      className: 'bg-green-50 border-green-200',
    });
    router.push('/lead/co-applicant-info');
  };

  if (!currentLead || !coApplicant) {
    return null;
  }

  return (
    <DashboardLayout
      title="Co-Applicant Basic Details"
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

          <div>
            <Label className="text-sm font-medium text-[#003366] mb-2 block">
              Does the co-applicant have a PAN? <span className="text-[#DC2626]">*</span>
            </Label>
            <RadioGroup
              className="flex gap-4"
              value={formData.hasPan}
              onValueChange={value => {
                if (isReadOnly) return;
                setFormData(prev => ({
                  ...prev,
                  hasPan: value,
                  pan: '',
                  panUnavailabilityNotes: '',
                  panUnavailabilityReason: '',
                  alternateIdType: '',
                  documentNumber: '',
                }));
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="pan-yes" value="yes" disabled={isReadOnly} />
                <Label
                  htmlFor="pan-yes"
                  className={cn('font-normal', isReadOnly && 'opacity-60 cursor-not-allowed')}
                >
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="pan-no" value="no" disabled={isReadOnly} />
                <Label
                  htmlFor="pan-no"
                  className={cn('font-normal', isReadOnly && 'opacity-60 cursor-not-allowed')}
                >
                  No
                </Label>
              </div>
            </RadioGroup>
          </div>

          {formData.hasPan === 'yes' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="pan" className="text-sm font-medium text-[#003366] mb-2 block">
                  PAN Number <span className="text-[#DC2626]">*</span>
                </Label>
                <Input
                  id="pan"
                  value={formData.pan}
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  className={cn(
                    'h-12 uppercase tracking-wide',
                    panValidationStatus === 'invalid' && 'border-red-500',
                    isReadOnly && 'bg-gray-100 cursor-not-allowed text-gray-600'
                  )}
                  disabled={isReadOnly}
                  onChange={e => {
                    if (isReadOnly) return;
                    setFormData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }));
                  }}
                />
                {panFormatError && <p className="text-xs text-red-600 mt-1">{panFormatError}</p>}
              </div>
            </div>
          )}

          {formData.hasPan === 'no' && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-[#003366] mb-2 block">
                  PAN Unavailability Reason <span className="text-[#DC2626]">*</span>
                </Label>
                <Select
                  value={formData.panUnavailabilityReason}
                  disabled={isReadOnly}
                  onValueChange={value => {
                    if (isReadOnly) return;
                    setFormData(prev => ({ ...prev, panUnavailabilityReason: value }));
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      'h-12 rounded-xl',
                      isReadOnly && 'bg-gray-100 cursor-not-allowed text-gray-600'
                    )}
                  >
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

              {(formData.panUnavailabilityReason === 'name-change' || formData.panUnavailabilityReason === 'other') && (
                <div>
                  <Label className="text-sm font-medium text-[#003366] mb-2 block">Notes</Label>
                  <Textarea
                    value={formData.panUnavailabilityNotes}
                    onChange={e => {
                      if (isReadOnly) return;
                      setFormData(prev => ({ ...prev, panUnavailabilityNotes: e.target.value }));
                    }}
                    placeholder="Please provide additional details..."
                    className={cn('rounded-xl', isReadOnly && 'bg-gray-100 cursor-not-allowed text-gray-600')}
                    disabled={isReadOnly}
                  />
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-[#003366] mb-2 block">
                  Alternate Primary ID Type <span className="text-[#DC2626]">*</span>
                </Label>
                <Select
                  value={formData.alternateIdType}
                  disabled={isReadOnly}
                  onValueChange={value => {
                    if (isReadOnly) return;
                    setFormData(prev => ({ ...prev, alternateIdType: value }));
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      'h-12 rounded-xl',
                      isReadOnly && 'bg-gray-100 cursor-not-allowed text-gray-600'
                    )}
                  >
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
                <Label className="text-sm font-medium text-[#003366] mb-2 block">
                  Document Number <span className="text-[#DC2626]">*</span>
                </Label>
                <Input
                  value={formData.documentNumber}
                  disabled={isReadOnly}
                  onChange={e => {
                    if (isReadOnly) return;
                    setFormData(prev => ({ ...prev, documentNumber: e.target.value }));
                  }}
                  placeholder="Enter document number"
                  className={cn('h-12 rounded-xl', isReadOnly && 'bg-gray-100 cursor-not-allowed text-gray-600')}
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-[#003366] mb-2 block flex items-center gap-2">
                Date of Birth <span className="text-[#DC2626]">*</span>
              </Label>
              <MaskedDateInput
                id="dob"
                value={dobFormatted}
                onChange={handleDobChange}
                placeholder="DD/MM/YYYY"
                disabled={isReadOnly}
                className={cn(
                  'h-12 rounded-xl',
                  isReadOnly && 'bg-gray-100 cursor-not-allowed text-gray-600'
                )}
              />
              {formData.age > 0 && (
                <div className="mt-3">
                  <Badge className="bg-[#E6F0FA] text-[#0072CE]">Age: {formData.age} years</Badge>
                </div>
              )}
            </div>

            <div>
              <Label className="block text-sm font-medium text-[#003366] mb-3">Gender <span className="text-[#DC2626]">*</span></Label>
              <RadioGroup
                value={formData.gender}
                onValueChange={value => {
                  if (isReadOnly) return;
                  setFormData(prev => ({ ...prev, gender: value }));
                }}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  htmlFor="gender-male"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.gender === 'male' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300',
                    isReadOnly && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <RadioGroupItem value="male" id="gender-male" className="sr-only" disabled={isReadOnly} />
                  Male
                </Label>
                <Label
                  htmlFor="gender-female"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.gender === 'female' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300',
                    isReadOnly && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <RadioGroupItem value="female" id="gender-female" className="sr-only" disabled={isReadOnly} />
                  Female
                </Label>
                <Label
                  htmlFor="gender-other"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.gender === 'other' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300',
                    isReadOnly && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <RadioGroupItem value="other" id="gender-other" className="sr-only" disabled={isReadOnly} />
                  Other
                </Label>
                <Label
                  htmlFor="gender-not-specified"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.gender === 'not-specified'
                      ? 'border-[#0072CE] bg-[#E6F0FA]/50'
                      : 'border-gray-300',
                    isReadOnly && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <RadioGroupItem
                    value="not-specified"
                    id="gender-not-specified"
                    className="sr-only"
                    disabled={isReadOnly}
                  />
                  Not Specified
                </Label>
              </RadioGroup>
            </div>

            <div>
              <Label className="block text-sm font-medium text-[#003366] mb-3">
                Marital Status <span className="text-[#DC2626]">*</span>
              </Label>
              <RadioGroup
                value={formData.maritalStatus}
                onValueChange={value => {
                  if (isReadOnly) return;
                  setFormData(prev => ({ ...prev, maritalStatus: value }));
                }}
                className="grid grid-cols-3 gap-2"
              >
                <Label
                  htmlFor="marital-single"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.maritalStatus === 'single' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300',
                    isReadOnly && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <RadioGroupItem value="single" id="marital-single" className="sr-only" disabled={isReadOnly} />
                  Single
                </Label>
                <Label
                  htmlFor="marital-married"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.maritalStatus === 'married' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300',
                    isReadOnly && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <RadioGroupItem value="married" id="marital-married" className="sr-only" disabled={isReadOnly} />
                  Married
                </Label>
                <Label
                  htmlFor="marital-divorced"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.maritalStatus === 'divorced'
                      ? 'border-[#0072CE] bg-[#E6F0FA]/50'
                      : 'border-gray-300',
                    isReadOnly && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <RadioGroupItem value="divorced" id="marital-divorced" className="sr-only" disabled={isReadOnly} />
                  Divorced
                </Label>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-[#003366] mb-2 block">
                Email (optional)
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => {
                  if (isReadOnly) return;
                  setFormData(prev => ({ ...prev, email: e.target.value }));
                }}
                placeholder="coapplicant@example.com"
                className={cn(
                  'h-12 rounded-xl',
                  isReadOnly && 'bg-gray-100 cursor-not-allowed text-gray-600'
                )}
                disabled={isReadOnly}
              />
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="max-w-2xl mx-auto">
            {formData.hasPan === 'yes' && !isValidated ? (
              <Button
                onClick={handleValidatePan}
                disabled={!canValidatePan}
                className="w-full h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isValidatingPan ? 'Validating…' : 'Validate Pan'}
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="w-full h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]"
              >
                Save Information
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function CoApplicantBasicDetailsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading...</div>}>
      <CoApplicantBasicDetailsContent />
    </Suspense>
  );
}

