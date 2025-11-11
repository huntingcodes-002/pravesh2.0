'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { CheckCircle, Edit, Loader, Send } from 'lucide-react';

const RELATIONSHIPS = [
  { value: 'Father', label: 'Father' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Sister', label: 'Sister' },
  { value: 'Husband', label: 'Husband' },
  { value: 'Wife', label: 'Wife' },
  { value: 'Father in Law', label: 'Father in Law' },
  { value: 'Mother in Law', label: 'Mother in Law' },
  { value: 'Son', label: 'Son' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Partner', label: 'Partner' },
  { value: 'Other', label: 'Other' },
];

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

export default function CoApplicantNewPage() {
  const { currentLead, createCoApplicant, updateCoApplicant } = useLead();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const coApplicantId = searchParams.get('coApplicantId');
  const isEditingExisting = Boolean(coApplicantId);

  const coApplicant: CoApplicant | undefined = useMemo(() => {
    if (!currentLead || !coApplicantId) return undefined;
    return currentLead.formData?.coApplicants?.find((ca: CoApplicant) => ca.id === coApplicantId);
  }, [currentLead, coApplicantId]);

  const [formData, setFormData] = useState(() => {
    const basic = coApplicant?.data?.basicDetails ?? coApplicant?.data?.step1;
    return {
      relation: coApplicant?.relationship || '',
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

  useEffect(() => {
    if (isEditingExisting && coApplicant) {
      const basic = coApplicant.data?.basicDetails ?? coApplicant.data?.step1 ?? {};
      setFormData({
        relation: coApplicant.relationship || basic.relation || '',
        fullName: [basic.firstName, basic.lastName].filter(Boolean).join(' '),
        mobile: basic.mobile || '',
      });
      setIsMobileVerified(Boolean(basic.isMobileVerified));
    }
  }, [coApplicant, isEditingExisting]);

  useEffect(() => {
    if (!currentLead) {
      router.replace('/leads');
      return;
    }
    if (isEditingExisting && coApplicantId && !coApplicant) {
      router.replace('/lead/co-applicant-info');
    }
  }, [currentLead, coApplicantId, coApplicant, isEditingExisting, router]);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (isOtpModalOpen && resendTimer > 0) {
      timerId = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timerId);
  }, [isOtpModalOpen, resendTimer]);

  const handleRelationChange = (value: string) => {
    setFormData(prev => ({ ...prev, relation: value }));
  };

  const handleFullNameChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ');
    setFormData(prev => ({ ...prev, fullName: sanitized }));
  };

  const handleSendOtp = () => {
    if (!formData.relation || !formData.fullName.trim()) {
      toast({ title: 'Missing Information', description: 'Please select relation and enter full name.', variant: 'destructive' });
      return;
    }

    if (formData.mobile.length !== 10) {
      toast({ title: 'Invalid Mobile', description: 'Please enter a 10-digit mobile number.', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsOtpModalOpen(true);
      setResendTimer(30);
      toast({ title: 'OTP Sent', description: 'OTP sent successfully.' });
    }, 800);
  };

  const handleResendOtp = () => {
    setResendTimer(30);
    toast({ title: 'OTP Resent', description: 'New OTP sent.' });
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      toast({ title: 'Verification Failed', description: 'Please enter a 6-digit OTP.', variant: 'destructive' });
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

    updateCoApplicant(currentLead.id, targetId, {
      relationship: formData.relation,
      currentStep: currentStepValue,
      ...extra,
      data: {
        ...existingData,
        step1: {
          ...(existingData?.step1 ?? {}),
          firstName: parts.firstName,
          lastName: parts.lastName,
          relation: formData.relation,
          fullName: formData.fullName.trim(),
          mobile: formData.mobile,
          isMobileVerified,
        },
        basicDetails: {
          ...(existingData?.basicDetails ?? {}),
          ...parts,
          fullName: formData.fullName.trim(),
          relation: formData.relation,
          mobile: formData.mobile,
          isMobileVerified,
        },
      },
    });
  };

  useEffect(() => {
    if (isEditingExisting && coApplicant && coApplicantId) {
      persistForm(coApplicantId, coApplicant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.fullName, formData.relation, formData.mobile, isMobileVerified, coApplicant, coApplicantId, isEditingExisting]);

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
    let targetId = coApplicantId || null;
    let baseData: CoApplicant | undefined = coApplicant;

    if (!isEditingExisting) {
      const created = createCoApplicant(currentLead.id, formData.relation);
      targetId = created.id;
      baseData = created;
    }

    if (!targetId) {
      toast({
        title: 'Unable to continue',
        description: 'Something went wrong while saving the co-applicant. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const existingData: any = baseData?.data ?? (coApplicant && coApplicant.id === targetId ? coApplicant.data : {});

    updateCoApplicant(currentLead.id, targetId, {
      relationship: formData.relation,
      currentStep: baseData?.currentStep ?? 0,
      data: {
        ...existingData,
        step1: {
          ...(existingData?.step1 ?? {}),
          firstName: parts.firstName,
          lastName: parts.lastName,
          relation: formData.relation,
          fullName: formData.fullName.trim(),
          mobile: formData.mobile,
          isMobileVerified: true,
        },
        basicDetails: {
          ...(existingData?.basicDetails ?? {}),
          ...parts,
          fullName: formData.fullName.trim(),
          relation: formData.relation,
          mobile: formData.mobile,
          isMobileVerified: true,
        },
      },
    });

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
              <Label htmlFor="relation" className="text-sm font-medium text-[#003366] mb-2 block">
                Relation <span className="text-[#DC2626]">*</span>
              </Label>
              <Select value={formData.relation} onValueChange={handleRelationChange}>
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
                  disabled={!canSendOtp || isVerifying}
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
                maxLength={6}
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
                  <InputOTPSlot className="h-14 w-10 text-2xl" index={4} />
                  <InputOTPSlot className="h-14 w-10 text-2xl" index={5} />
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
                disabled={resendTimer > 0}
                className={cn(
                  'p-0 h-auto text-[#0072CE] hover:text-[#005a9e]',
                  resendTimer > 0 && 'cursor-not-allowed text-gray-400'
                )}
              >
                Resend OTP
              </Button>
            </div>
            <div className="space-y-3">
              <Button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6}
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

