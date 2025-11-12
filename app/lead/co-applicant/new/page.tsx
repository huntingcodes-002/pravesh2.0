'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead, CoApplicant } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { startCoApplicantWorkflow, submitCoApplicantConsentMobile, isApiError } from '@/lib/api';
import { CheckCircle, Edit, Loader, Send } from 'lucide-react';

const RELATIONSHIPS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'friend', label: 'Friend' },
  { value: 'business_partner', label: 'Business Partner' },
  { value: 'other', label: 'Other' },
];

const RELATIONSHIP_LABELS_MAP = RELATIONSHIPS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const LEGACY_RELATIONSHIP_MAP: Record<string, string> = {
  Father: 'father',
  Mother: 'mother',
  Sister: 'sister',
  Brother: 'brother',
  Husband: 'spouse',
  Wife: 'spouse',
  Spouse: 'spouse',
  Son: 'son',
  Daughter: 'daughter',
  Partner: 'friend',
  'Business Partner': 'business_partner',
  Friend: 'friend',
  'Father in Law': 'father',
  'Mother in Law': 'mother',
  Other: 'other',
};

const normalizeRelationValue = (value?: string | null) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (RELATIONSHIP_LABELS_MAP[trimmed]) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (RELATIONSHIP_LABELS_MAP[lower]) {
    return lower;
  }
  if (LEGACY_RELATIONSHIP_MAP[trimmed]) {
    return LEGACY_RELATIONSHIP_MAP[trimmed];
  }
  return lower;
};

const areStepSectionsEqual = (current: any, next: Record<string, any>, keys: string[]) =>
  keys.every(key => {
    const currentValue = current?.[key];
    const nextValue = next[key];
    return currentValue === nextValue;
  });

const deriveNameParts = (fullName: string) => {
  const normalized = fullName.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { firstName: '', lastName: '' };
  }
  const parts = normalized.split(' ');
  const firstName = parts.shift() || '';
  const lastName = parts.join(' ').trim();
  return { firstName, lastName };
};

function CoApplicantNewPageContent() {
  const { currentLead, updateCoApplicant } = useLead();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const coApplicantIdFromQuery = searchParams.get('coApplicantId');
  const [activeCoApplicantId, setActiveCoApplicantId] = useState<string | null>(coApplicantIdFromQuery);
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);

  useEffect(() => {
    if (coApplicantIdFromQuery && coApplicantIdFromQuery !== activeCoApplicantId) {
      setActiveCoApplicantId(coApplicantIdFromQuery);
    }
  }, [coApplicantIdFromQuery, activeCoApplicantId]);

  const isEditingExisting = Boolean(activeCoApplicantId);

  const coApplicant: CoApplicant | undefined = useMemo(() => {
    if (!currentLead || !activeCoApplicantId) return undefined;
    return currentLead.formData?.coApplicants?.find((ca: CoApplicant) => ca.id === activeCoApplicantId);
  }, [currentLead, activeCoApplicantId]);

  const [formData, setFormData] = useState(() => {
    const basic = coApplicant?.data?.basicDetails ?? coApplicant?.data?.step1;
    const initialRelation =
      normalizeRelationValue(coApplicant?.relationship) ||
      normalizeRelationValue(basic?.relation);
    return {
      relation: initialRelation,
      fullName: basic ? [basic.firstName, basic.lastName].filter(Boolean).join(' ') : '',
      mobile: basic?.mobile || '',
    };
  });

  const [isMobileVerified, setIsMobileVerified] = useState<boolean>(() => {
    const basic = coApplicant?.data?.basicDetails ?? coApplicant?.data?.step1;
    return Boolean(basic?.isMobileVerified);
  });
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [isResendingOtp, setIsResendingOtp] = useState(false);

  useEffect(() => {
    if (isEditingExisting && coApplicant) {
      const basic = coApplicant.data?.basicDetails ?? coApplicant.data?.step1 ?? {};
      const nextForm = {
        relation:
          normalizeRelationValue(coApplicant.relationship) ||
          normalizeRelationValue(basic.relation),
        fullName: [basic.firstName, basic.lastName].filter(Boolean).join(' '),
        mobile: basic.mobile || '',
      };
      setFormData(prev => {
        if (
          prev.relation === nextForm.relation &&
          prev.fullName === nextForm.fullName &&
          prev.mobile === nextForm.mobile
        ) {
          return prev;
        }
        return nextForm;
      });
      const nextVerified = Boolean(basic.isMobileVerified);
      setIsMobileVerified(prev => (prev === nextVerified ? prev : nextVerified));
    }
  }, [coApplicant, isEditingExisting]);

  useEffect(() => {
    if (!currentLead) {
      router.replace('/leads');
      return;
    }
    if (isEditingExisting && activeCoApplicantId && !coApplicant) {
      router.replace('/lead/co-applicant-info');
    }
  }, [currentLead, activeCoApplicantId, coApplicant, isEditingExisting, router]);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (isOtpModalOpen && resendTimer > 0) {
      timerId = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timerId);
  }, [isOtpModalOpen, resendTimer]);

  const getAccessToken = () => {
    if (typeof window === 'undefined') return null;
    const authRaw = sessionStorage.getItem('auth');
    if (!authRaw) return null;
    try {
      const parsed = JSON.parse(authRaw);
      return parsed?.access_token ?? null;
    } catch {
      return null;
    }
  };

  const handleRelationChange = async (value: string) => {
    setFormData(prev => ({ ...prev, relation: value }));

    if (!currentLead) {
      toast({
        title: 'Lead Not Found',
        description: 'Unable to start co-applicant workflow because lead details are missing.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentLead.appId) {
      toast({
        title: 'Application Not Found',
        description: 'Application ID missing. Please create or refresh the lead before adding a co-applicant.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsStartingWorkflow(true);
      const response = await startCoApplicantWorkflow({
        application_id: currentLead.appId,
        relationship_to_primary: value,
      });

      if (isApiError(response)) {
        toast({
          title: 'Co-applicant Setup Failed',
          description: response.error || 'Unable to start co-applicant workflow. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      const { co_applicant_workflow_id, co_applicant_index } = response;

      if (!co_applicant_workflow_id) {
        toast({
          title: 'Co-applicant Setup Failed',
          description: 'Workflow ID not received from the server. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      updateCoApplicant(currentLead.id, co_applicant_workflow_id, {
        relationship: value,
        workflowId: co_applicant_workflow_id,
        workflowIndex:
          typeof co_applicant_index === 'number' ? co_applicant_index : undefined,
        currentStep: coApplicant?.currentStep ?? 0,
        isComplete: coApplicant?.isComplete ?? false,
        data: coApplicant?.data ?? {},
      });

      setActiveCoApplicantId(co_applicant_workflow_id);
      router.replace(
        `/lead/co-applicant/new?coApplicantId=${encodeURIComponent(co_applicant_workflow_id)}`
      );
    } catch (error: any) {
      toast({
        title: 'Co-applicant Setup Failed',
        description: error?.message || 'Unable to start co-applicant workflow. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsStartingWorkflow(false);
    }
  };

  const handleFullNameChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ');
    setFormData(prev => ({ ...prev, fullName: sanitized }));
  };

  const handleSendOtp = async () => {
    if (!formData.relation || !formData.fullName.trim()) {
      toast({ title: 'Missing Information', description: 'Please select relation and enter full name.', variant: 'destructive' });
      return;
    }

    if (formData.mobile.length !== 10) {
      toast({ title: 'Invalid Mobile', description: 'Please enter a 10-digit mobile number.', variant: 'destructive' });
      return;
    }

    if (!currentLead?.appId) {
      toast({
        title: 'Application Not Found',
        description: 'Application ID missing. Please refresh the lead and try again.',
        variant: 'destructive',
      });
      return;
    }

    if (typeof coApplicant?.workflowIndex !== 'number') {
      toast({
        title: 'Co-applicant Setup Pending',
        description: 'Unable to find the co-applicant workflow. Please re-select the relation and try again.',
        variant: 'destructive',
      });
      return;
    }

    const parts = deriveNameParts(formData.fullName);
    if (!parts.firstName || !parts.lastName) {
      toast({
        title: 'Incomplete Name',
        description: 'Please enter both first name and last name for the co-applicant.',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    try {
      const response = await submitCoApplicantConsentMobile({
        application_id: currentLead.appId,
        co_applicant_index: coApplicant.workflowIndex,
        mobile_number: formData.mobile,
        first_name: parts.firstName,
        last_name: parts.lastName,
      });

      if (isApiError(response)) {
        toast({
          title: 'OTP Send Failed',
          description: response.error || 'Failed to send consent OTP. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setIsOtpModalOpen(true);
      setResendTimer(30);
      toast({
        title: 'OTP Sent',
        description: response.message || 'Co-applicant consent OTP sent successfully.',
        className: 'bg-blue-50 border-blue-200',
      });
    } catch (error: any) {
      toast({
        title: 'OTP Send Failed',
        description: error?.message || 'Failed to send consent OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!currentLead?.appId || !activeCoApplicantId) {
      toast({
        title: 'Cannot resend OTP',
        description: 'Application or co-applicant information is missing.',
        variant: 'destructive',
      });
      return;
    }

    const coApplicants = currentLead.formData?.coApplicants ?? [];
    const coApplicantIndex = coApplicants.findIndex(coApp => coApp.id === activeCoApplicantId);
    if (coApplicantIndex < 0) {
      toast({
        title: 'Cannot resend OTP',
        description: 'Unable to determine the co-applicant index. Please try again.',
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

    setIsResendingOtp(true);

    try {
      const response = await fetch(
        `https://uatlb.api.saarathifinance.com/api/lead-collection/applications/${encodeURIComponent(
          currentLead.appId
        )}/co-applicant-resend-mobile-otp/${coApplicantIndex}/`,
        {
          method: 'POST',
          headers: {
            Accept: '*/*',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to resend OTP.');
      }

      const result = await response.json();
      setResendTimer(30);
      toast({
        title: 'OTP resent',
        description: result?.message || 'New OTP sent successfully.',
        className: 'bg-blue-50 border-blue-200',
      });
    } catch (error: any) {
      toast({
        title: 'Resend failed',
        description: error?.message || 'Failed to resend OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 4) {
      toast({ title: 'Verification Failed', description: 'Please enter a 4-digit OTP.', variant: 'destructive' });
      return;
    }

    setIsMobileVerified(true);
    setIsOtpModalOpen(false);
    setOtp('');
    toast({
      title: 'Verification Successful',
      description: 'Co-applicant mobile verified.',
      className: 'bg-green-100 border-green-200',
    });
  };

  const persistForm = (targetId: string, base?: CoApplicant, extra?: Partial<CoApplicant>) => {
    if (!currentLead) return;
    const hasMinimalData = formData.relation && formData.fullName.trim();
    if (!hasMinimalData) {
      return;
    }
    const parts = deriveNameParts(formData.fullName);
    const existingData: any =
      base?.data ?? (coApplicant && coApplicant.id === targetId ? coApplicant.data : {});
    const currentStepValue =
      base?.currentStep ?? (coApplicant && coApplicant.id === targetId ? coApplicant.currentStep : 0);
    const relationLabel = RELATIONSHIP_LABELS_MAP[formData.relation] ?? formData.relation;
    const currentCoApplicant =
      base ?? (coApplicant && coApplicant.id === targetId ? coApplicant : undefined);
    const currentRelationship = currentCoApplicant?.relationship;

    const nextStep1 = {
      ...(existingData?.step1 ?? {}),
      firstName: parts.firstName,
      lastName: parts.lastName,
      relation: relationLabel,
      fullName: formData.fullName.trim(),
      mobile: formData.mobile,
      isMobileVerified,
    };

    const nextBasicDetails = {
      ...(existingData?.basicDetails ?? {}),
      ...parts,
      fullName: formData.fullName.trim(),
      relation: relationLabel,
      mobile: formData.mobile,
      isMobileVerified,
    };

    const shouldUpdate =
      currentRelationship !== formData.relation ||
      !areStepSectionsEqual(existingData?.step1, nextStep1, [
        'firstName',
        'lastName',
        'relation',
        'fullName',
        'mobile',
        'isMobileVerified',
      ]) ||
      !areStepSectionsEqual(existingData?.basicDetails, nextBasicDetails, [
        'firstName',
        'lastName',
        'relation',
        'fullName',
        'mobile',
        'isMobileVerified',
      ]) ||
      currentStepValue !== (currentCoApplicant?.currentStep ?? 0);

    if (!shouldUpdate) {
      return;
    }

    updateCoApplicant(currentLead.id, targetId, {
      relationship: formData.relation,
      currentStep: currentStepValue,
      ...extra,
      data: {
        ...existingData,
        step1: nextStep1,
        basicDetails: nextBasicDetails,
      },
    });
  };

  useEffect(() => {
    if (isEditingExisting && coApplicant && activeCoApplicantId) {
      persistForm(activeCoApplicantId, coApplicant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.fullName, formData.relation, formData.mobile, isMobileVerified, coApplicant, activeCoApplicantId, isEditingExisting]);

  const handleExit = () => {
    router.push('/lead/co-applicant-info');
  };

  const handleNext = () => {
    if (!currentLead) {
      router.replace('/leads');
      return;
    }

    if (!formData.relation || !formData.fullName.trim()) {
      toast({ title: 'Missing Information', description: 'Please select relation and enter full name.', variant: 'destructive' });
      return;
    }

    if (!isMobileVerified) {
      toast({ title: 'Verification Required', description: 'Please verify mobile number before continuing.', variant: 'destructive' });
      return;
    }

    const parts = deriveNameParts(formData.fullName);
    if (!activeCoApplicantId || !coApplicant) {
      toast({
        title: 'Co-applicant Not Ready',
        description: 'Please start the co-applicant workflow and validate consent before continuing.',
        variant: 'destructive',
      });
      return;
    }

    const targetId = activeCoApplicantId;
    const baseData: CoApplicant = coApplicant;

    const existingData: any = baseData.data ?? {};
    const relationLabel = RELATIONSHIP_LABELS_MAP[formData.relation] ?? formData.relation;

    const nextStep1 = {
      ...(existingData?.step1 ?? {}),
      firstName: parts.firstName,
      lastName: parts.lastName,
      relation: relationLabel,
      fullName: formData.fullName.trim(),
      mobile: formData.mobile,
      isMobileVerified: true,
    };

    const nextBasicDetails = {
      ...(existingData?.basicDetails ?? {}),
      ...parts,
      fullName: formData.fullName.trim(),
      relation: relationLabel,
      mobile: formData.mobile,
      isMobileVerified: true,
    };

    const shouldUpdate =
      (baseData?.relationship ?? coApplicant?.relationship) !== formData.relation ||
      !areStepSectionsEqual(existingData?.step1, nextStep1, [
        'firstName',
        'lastName',
        'relation',
        'fullName',
        'mobile',
        'isMobileVerified',
      ]) ||
      !areStepSectionsEqual(existingData?.basicDetails, nextBasicDetails, [
        'firstName',
        'lastName',
        'relation',
        'fullName',
        'mobile',
        'isMobileVerified',
      ]);

    if (shouldUpdate) {
      updateCoApplicant(currentLead.id, targetId, {
        relationship: formData.relation,
        currentStep: baseData?.currentStep ?? 0,
        data: {
          ...existingData,
          step1: nextStep1,
          basicDetails: nextBasicDetails,
        },
      });
    }

    router.push('/lead/co-applicant-info');
  };

  if (!currentLead) {
    return null;
  }

  if (isEditingExisting && !coApplicant) {
    return null;
  }

  const { firstName, lastName } = deriveNameParts(formData.fullName);
  const canSendOtp = formData.relation && formData.mobile.length === 10 && firstName && lastName;

  return (
    <DashboardLayout
      title="Add Co-Applicant"
      showNotifications={false}
      showExitButton
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-[#003366] mb-6">Co-Applicant Details</h2>
          <div className="space-y-6">
            <div>
              <Label htmlFor="relation" className="text-sm font-medium text-[#003366] mb-2 block flex items-center gap-2">
                <span>
                  Relation <span className="text-[#DC2626]">*</span>
                </span>
                {isStartingWorkflow && <Loader className="w-4 h-4 animate-spin text-[#0072CE]" aria-hidden="true" />}
              </Label>
              <Select
                value={formData.relation}
                onValueChange={handleRelationChange}
                disabled={isStartingWorkflow}
              >
                <SelectTrigger id="relation" className="h-12 rounded-lg">
                  <SelectValue placeholder="Select relation" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="full-name" className="text-sm font-medium text-[#003366] mb-2 block">
                Co-Applicant Name <span className="text-[#DC2626]">*</span>
              </Label>
              <Input
                id="full-name"
                value={formData.fullName}
                onChange={e => handleFullNameChange(e.target.value)}
                placeholder="Enter full name as per PAN"
                className="h-12 rounded-lg"
                maxLength={150}
              />
            </div>

            <div>
              <Label htmlFor="mobile-number" className="text-sm font-medium text-[#003366] mb-2 block">
                Mobile Number <span className="text-[#DC2626]">*</span>
              </Label>
              <div className="flex">
                <div className="flex items-center px-3 h-12 bg-[#F3F4F6] border border-r-0 border-gray-300 rounded-l-lg">
                  <span className="text-[#003366] font-medium">+91</span>
                </div>
                <div className="relative flex-1">
                  <Input
                    type="tel"
                    id="mobile-number"
                    placeholder="Enter 10-digit mobile number"
                    maxLength={10}
                    value={formData.mobile}
                    onChange={e => setFormData(prev => ({ ...prev, mobile: e.target.value.replace(/[^0-9]/g, '') }))}
                    className="w-full h-12 pr-10 rounded-l-none rounded-r-lg"
                    disabled={isMobileVerified}
                  />
                  {isMobileVerified && (
                    <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#16A34A]" />
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2">
              {!isMobileVerified ? (
                <Button
                  onClick={handleSendOtp}
                  disabled={!canSendOtp || isVerifying || isStartingWorkflow}
                  className="w-full h-12 bg-[#0072CE] hover:bg-[#005a9e] font-medium transition-colors rounded-lg"
                >
                  {isVerifying ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {isVerifying ? 'Sending...' : 'Send Consent OTP'}
                </Button>
              ) : (
                <div className="p-4 bg-green-100/50 border border-green-200 rounded-2xl flex items-center justify-center gap-3">
                  <CheckCircle className="text-[#16A34A] text-xl w-6 h-6" />
                  <p className="text-sm text-[#16A34A] font-medium">Consent verified successfully!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button variant="outline" className="flex-1 h-12 rounded-lg" onClick={handleExit}>
              Cancel
            </Button>
            <Button
              onClick={handleNext}
              disabled={isStartingWorkflow}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]"
            >
              Save & Continue
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isOtpModalOpen} onOpenChange={setIsOtpModalOpen}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="text-center space-y-4">
            <DialogTitle className="text-lg font-semibold text-[#003366]">Verify Consent OTP</DialogTitle>
            <DialogDescription>
              Enter the 6-digit OTP sent to +91-XXXXXX{formData.mobile.slice(-4)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={4}
                value={otp}
                onChange={value => {
                  const numbers = value.replace(/[^0-9]/g, '');
                  setOtp(numbers);
                }}
              >
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot className="h-14 w-10 text-2xl" index={0} />
                  <InputOTPSlot className="h-14 w-10 text-2xl" index={1} />
                  <InputOTPSlot className="h-14 w-10 text-2xl" index={2} />
                  <InputOTPSlot className="h-14 w-10 text-2xl" index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="text-center">
              <p className="text-sm text-neutral">
                {resendTimer > 0 ? (
                  <>
                    Resend OTP in{' '}
                    <span className="font-medium text-primary">
                      {`00:${resendTimer.toString().padStart(2, '0')}`}
                    </span>
                  </>
                ) : (
                  "Didn't receive OTP?"
                )}
              </p>
              <Button
                type="button"
                variant="link"
                onClick={handleResendOtp}
                disabled={resendTimer > 0 || isResendingOtp}
                className={cn(
                  'p-0 h-auto text-[#0072CE] hover:text-[#005a9e]',
                  (resendTimer > 0 || isResendingOtp) && 'cursor-not-allowed text-gray-400'
                )}
              >
                {isResendingOtp ? 'Resending…' : 'Resend OTP'}
              </Button>
            </div>
            <div className="space-y-3">
              <Button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 4}
                className="w-full h-12 bg-[#0072CE] text-white rounded-xl font-semibold text-lg hover:bg-[#005a9e] transition-colors"
              >
                Verify & Continue
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => setIsOtpModalOpen(false)}
                className="w-full text-sm text-[#0072CE] hover:text-[#005a9e] font-medium transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Mobile Number
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export default function CoApplicantNewPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading...</div>}>
      <CoApplicantNewPageContent />
    </Suspense>
  );
}

