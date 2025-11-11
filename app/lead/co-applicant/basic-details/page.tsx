'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

type ValidationStatus = 'pending' | 'valid' | 'invalid';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export default function CoApplicantBasicDetailsPage() {
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

  useEffect(() => {
    if (!currentLead || !coApplicant || !coApplicantId) {
      router.replace('/lead/co-applicant-info');
    }
  }, [currentLead, coApplicant, coApplicantId, router]);

  const handleDobChange = (value: string) => {
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

  const canSave =
    (formData.hasPan === 'yes' &&
      panValidationStatus === 'valid' &&
      formData.dob &&
      formData.gender &&
      formData.maritalStatus) ||
    (formData.hasPan === 'no' &&
      formData.panUnavailabilityReason &&
      formData.alternateIdType &&
      formData.documentNumber &&
      formData.dob &&
      formData.gender &&
      formData.maritalStatus);

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
              onValueChange={value =>
                setFormData(prev => ({
                  ...prev,
                  hasPan: value,
                  pan: '',
                  panUnavailabilityNotes: '',
                  panUnavailabilityReason: '',
                  alternateIdType: '',
                  documentNumber: '',
                }))
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="pan-yes" value="yes" />
                <Label htmlFor="pan-yes" className="font-normal">
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="pan-no" value="no" />
                <Label htmlFor="pan-no" className="font-normal">
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
                  className={cn('h-12 uppercase tracking-wide', panValidationStatus === 'invalid' && 'border-red-500')}
                  onChange={e => setFormData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
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
                  onValueChange={value => setFormData(prev => ({ ...prev, panUnavailabilityReason: value }))}
                >
                  <SelectTrigger className="h-12 rounded-xl">
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
                    onChange={e => setFormData(prev => ({ ...prev, panUnavailabilityNotes: e.target.value }))}
                    placeholder="Please provide additional details..."
                    className="rounded-xl"
                  />
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-[#003366] mb-2 block">
                  Alternate Primary ID Type <span className="text-[#DC2626]">*</span>
                </Label>
                <Select
                  value={formData.alternateIdType}
                  onValueChange={value => setFormData(prev => ({ ...prev, alternateIdType: value }))}
                >
                  <SelectTrigger className="h-12 rounded-xl">
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
                  onChange={e => setFormData(prev => ({ ...prev, documentNumber: e.target.value }))}
                  placeholder="Enter document number"
                  className="h-12 rounded-xl"
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
                className="h-12 rounded-xl"
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
                onValueChange={value => setFormData(prev => ({ ...prev, gender: value }))}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  htmlFor="gender-male"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.gender === 'male' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300'
                  )}
                >
                  <RadioGroupItem value="male" id="gender-male" className="sr-only" />
                  Male
                </Label>
                <Label
                  htmlFor="gender-female"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.gender === 'female' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300'
                  )}
                >
                  <RadioGroupItem value="female" id="gender-female" className="sr-only" />
                  Female
                </Label>
                <Label
                  htmlFor="gender-other"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.gender === 'other' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300'
                  )}
                >
                  <RadioGroupItem value="other" id="gender-other" className="sr-only" />
                  Other
                </Label>
                <Label
                  htmlFor="gender-not-specified"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.gender === 'not-specified' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300'
                  )}
                >
                  <RadioGroupItem value="not-specified" id="gender-not-specified" className="sr-only" />
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
                onValueChange={value => setFormData(prev => ({ ...prev, maritalStatus: value }))}
                className="grid grid-cols-3 gap-2"
              >
                <Label
                  htmlFor="marital-single"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.maritalStatus === 'single' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300'
                  )}
                >
                  <RadioGroupItem value="single" id="marital-single" className="sr-only" />
                  Single
                </Label>
                <Label
                  htmlFor="marital-married"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.maritalStatus === 'married' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300'
                  )}
                >
                  <RadioGroupItem value="married" id="marital-married" className="sr-only" />
                  Married
                </Label>
                <Label
                  htmlFor="marital-divorced"
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 border rounded-xl transition-all cursor-pointer',
                    formData.maritalStatus === 'divorced' ? 'border-[#0072CE] bg-[#E6F0FA]/50' : 'border-gray-300'
                  )}
                >
                  <RadioGroupItem value="divorced" id="marital-divorced" className="sr-only" />
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
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="coapplicant@example.com"
                className="h-12 rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="w-full h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]"
            >
              Save Information
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

