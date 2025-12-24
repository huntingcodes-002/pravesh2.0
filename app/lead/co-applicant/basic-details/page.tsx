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
import { submitCoApplicantPersonalInfo, isApiError, getDetailedInfo, type CoApplicantPersonalInfoResponse, getCoApplicantRequiredDocuments, triggerBureauCheck } from '@/lib/api';
import { CheckCircle } from 'lucide-react';

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
  const [isBackendVerified, setIsBackendVerified] = useState(false);

  useEffect(() => {
    setIsValidated(coApplicant?.data?.basicDetails?.panValidated === true);
  }, [coApplicant?.data?.basicDetails?.panValidated]);

  // Fetch detailed info to check for backend verification and prefill form
  useEffect(() => {
    const fetchBackendData = async () => {
      if (!currentLead?.appId || typeof coApplicant?.workflowIndex !== 'number') return;

      try {
        const response = await getDetailedInfo(currentLead.appId);
        if (isApiError(response) || !response.success) return;

        const applicationDetails = response.data?.application_details || response.application_details || (response as any).application_details;
        const participants = applicationDetails?.participants || [];
        const apiCoApp = participants.find((p: any) => {
          const pt = p.participant_type as string;
          return (pt === 'co-applicant' || pt === 'co_applicant') && p.co_applicant_index === coApplicant.workflowIndex;
        });

        if (apiCoApp?.personal_info) {
          const personalInfo = apiCoApp.personal_info;
          const { pan_number, date_of_birth, gender, email, marital_status, full_name, mobile_number } = personalInfo;

          let hasUpdates = false;
          let isVerified = false;

          setFormData(prev => {
            const updates: any = { ...prev };

            // Only update if field is empty or if API has verified data
            // 1. PAN Logic
            if (pan_number?.value && (!prev.pan || pan_number.verified)) {
              updates.pan = pan_number.value;
              updates.hasPan = 'yes';
              hasUpdates = true;
            }

            if (pan_number?.verified) {
              isVerified = true;
            }

            // 2. Date of Birth
            if (date_of_birth?.value && (!prev.dob || date_of_birth.verified)) {
              // Convert DD/MM/YYYY to YYYY-MM-DD
              const parts = date_of_birth.value.split('/');
              if (parts.length === 3) {
                updates.dob = `${parts[2]}-${parts[1]}-${parts[0]}`;
                setDobFormatted(date_of_birth.value);

                // Calculate age
                const birthDate = new Date(updates.dob);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                  age--;
                }
                updates.age = age;
                hasUpdates = true;
              }
            }

            // 3. Gender
            if (gender && (!prev.gender || personalInfo.gender)) {
              const g = gender.toLowerCase();
              if (g === 'male' || g === 'm') updates.gender = 'male';
              else if (g === 'female' || g === 'f') updates.gender = 'female';
              else if (g === 'other' || g === 'o') updates.gender = 'other';
              hasUpdates = true;
            }

            // 4. Email
            if (email && (!prev.email || email)) {
              updates.email = email;
              hasUpdates = true;
            }

            // 5. Marital Status
            if (marital_status && (!prev.maritalStatus || marital_status)) {
              updates.maritalStatus = marital_status;
              hasUpdates = true;
            }

            return updates;
          });

          if (isVerified) {
            setIsBackendVerified(true);
            setIsValidated(true);
          }

          if (hasUpdates) {
            toast({
              title: 'Data Fetched',
              description: 'Personal details have been fetched from the application.',
              className: 'bg-blue-50 border-blue-200',
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch detailed info', error);
      }
    };

    fetchBackendData();
  }, [currentLead?.appId, coApplicant?.workflowIndex, toast]);

  // Check if basic details have been submitted
  const [isCompleted, setIsCompleted] = useState(
    coApplicant?.data?.basicDetails?.isCompleted === true
  );

  // Check if basic details are completed by checking backend data or local flag
  useEffect(() => {
    // First check local completion flag
    if (coApplicant?.data?.basicDetails?.isCompleted === true) {
      setIsCompleted(true);
      return;
    }

    // If not completed locally, check backend
    const checkCompletion = async () => {
      if (!currentLead?.appId || typeof coApplicant?.workflowIndex !== 'number') return;

      try {
        const response = await getDetailedInfo(currentLead.appId);
        if (isApiError(response)) return;

        const successResponse = response as any;
        const appDetails = successResponse.application_details;
        const participants = appDetails?.participants || [];
        const apiCoApp = participants.find((p: any) =>
          (p.participant_type === 'co-applicant' || p.participant_type === 'co_applicant') &&
          p.co_applicant_index === coApplicant.workflowIndex
        );

        // If personal_info exists in backend, consider it completed
        if (apiCoApp?.personal_info) {
          const personalInfo = apiCoApp.personal_info;
          // Check if we have essential data (name, DOB, gender, and either PAN or alternate ID)
          const hasName = personalInfo.full_name?.value;
          const hasDob = personalInfo.date_of_birth?.value;
          const hasGender = personalInfo.gender;
          const hasPan = personalInfo.pan_number?.value;
          const hasAlternateId = personalInfo.alternate_id_type && personalInfo.alternate_id_number;

          if (hasName && hasDob && hasGender && (hasPan || hasAlternateId)) {
            setIsCompleted(true);
          }
        }
      } catch (error) {
        console.error('Failed to check completion status', error);
      }
    };

    checkCompletion();
  }, [currentLead?.appId, coApplicant?.workflowIndex, coApplicant?.data?.basicDetails?.isCompleted]);

  const isReadOnly = isCompleted || isBackendVerified;

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
        marital_status: formData.maritalStatus || undefined,
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
            isCompleted: true, // Mark as completed after PAN validation
          },
        },
      });
      // Mark as completed locally
      setIsCompleted(true);
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

  const handleSave = async () => {
    if (!currentLead || !coApplicantId || !coApplicant) return;
    if (!canSave) {
      toast({
        title: 'Missing Information',
        description: 'Please fill all required fields before saving.',
        variant: 'destructive',
      });
      return;
    }

    const coApplicantIndex = coApplicant?.workflowIndex;
    if (!currentLead?.appId || typeof coApplicantIndex !== 'number') {
      toast({
        title: 'Application ID Missing',
        description: 'Application ID not found. Please complete the consent OTP verification first.',
        variant: 'destructive',
      });
      return;
    }

    // If "No PAN" is selected, call the API to save the data
    if (formData.hasPan === 'no') {
      try {
        const response = await submitCoApplicantPersonalInfo({
          application_id: currentLead.appId,
          co_applicant_index: coApplicantIndex,
          customer_type: 'individual',
          pan_number: undefined,
          pan_unavailability_reason: formData.panUnavailabilityReason || undefined,
          alternate_id_type: formData.alternateIdType || undefined,
          alternate_id_number: formData.documentNumber || undefined,
          date_of_birth: formData.dob,
          gender: formData.gender,
          email: formData.email || undefined,
          marital_status: formData.maritalStatus || undefined,
        });

        if (isApiError(response)) {
          throw new Error(response.error || 'Failed to save personal information');
        }

        // Check required-documents API and trigger bureau check if pan_card.required: false
        if (currentLead.appId && typeof coApplicantIndex === 'number') {
          try {
            // Wait a bit for backend to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            const requiredDocsResponse = await getCoApplicantRequiredDocuments(currentLead.appId, coApplicantIndex);
            if (!isApiError(requiredDocsResponse) && requiredDocsResponse.success) {
              const requiredDocs = requiredDocsResponse.required_documents || {};
              const panRequired = requiredDocs.pan_card?.required;
              const aadhaarUploaded = requiredDocs.aadhaar_card?.uploaded === true;

              // Trigger bureau check if PAN is not required and Aadhaar is uploaded
              if (panRequired === false && aadhaarUploaded) {
                try {
                  await triggerBureauCheck({
                    application_id: currentLead.appId,
                    agency: 'CRIF'
                  });
                  console.log(`Bureau check triggered for co-applicant ${coApplicantIndex} after PAN "No" submission`);
                } catch (err) {
                  console.error('Bureau check trigger failed', err);
                }
              }
            }
          } catch (err) {
            console.error('Failed to check required documents for bureau trigger', err);
          }
        }
      } catch (error: any) {
        toast({
          title: 'Save Failed',
          description: error.message || 'Failed to save co-applicant personal information.',
          variant: 'destructive',
        });
        return;
      }
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
          isCompleted: true, // Mark as completed after saving
        },
      },
    });

    // Mark as completed locally
    setIsCompleted(true);

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
        {isCompleted && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Co-applicant Basic Details section has been completed and submitted. This section is now read-only.
            </p>
          </div>
        )}

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
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="pan" className="text-sm font-medium text-[#003366]">
                    PAN Number <span className="text-[#DC2626]">*</span>
                  </Label>
                  {isBackendVerified && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Verified via PAN
                    </Badge>
                  )}
                </div>
                <Input
                  id="pan"
                  value={formData.pan}
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  className={cn(
                    'h-12 uppercase tracking-wide',
                    panValidationStatus === 'invalid' && 'border-red-500',
                    isReadOnly ? 'bg-gray-100 cursor-not-allowed text-gray-600' : 'bg-white'
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

