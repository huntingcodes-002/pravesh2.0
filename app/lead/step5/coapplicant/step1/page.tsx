'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressBar from '@/components/ProgressBar';
import { useLead, CoApplicant } from '@/contexts/LeadContext'; // Import CoApplicant
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { MOCK_OTP } from '@/lib/mock-auth';
import { cn } from '@/lib/utils';
import { Send, CheckCircle, Loader, ArrowLeft, Edit } from 'lucide-react';

const RELATIONSHIPS = [
  { value: "Father", label: "Father" },
  { value: "Mother", label: "Mother" },
  { value: "Sister", label: "Sister" },
  { value: "Husband", label: "Husband" },
  { value: "Wife", label: "Wife" },
  { value: "Father in Law", label: "Father in Law" },
  { value: "Mother in Law", label: "Mother in Law" },
  { value: "Son", label: "Son" },
  { value: "Daughter", label: "Daughter" },
  { value: "Partner", label: "Partner" },
  { value: "Other", label: "Other" },
];

function CoApplicantStep1PageContent() {
  const { currentLead, updateCoApplicant } = useLead();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Get coApplicantId from URL params
  const coApplicantId = searchParams.get('coApplicantId');

  // Explicitly type 'ca' here to resolve TS7006
  const coApplicant: CoApplicant | undefined = currentLead?.formData.coApplicants?.find((ca: CoApplicant) => ca.id === coApplicantId);

  // If no lead or co-applicant ID is found, redirect back to Step 5
  useEffect(() => {
    if (!currentLead || !coApplicantId || !coApplicant) {
      router.replace('/lead/step5');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLead, coApplicantId]);

  const [formData, setFormData] = useState({
    relationship: coApplicant?.relationship || '',
    mobile: coApplicant?.data?.step1?.mobile || '',
    firstName: coApplicant?.data?.step1?.firstName || '',
    lastName: coApplicant?.data?.step1?.lastName || '',
  });

  const [isMobileVerified, setIsMobileVerified] = useState(coApplicant?.data?.step1?.isMobileVerified || false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (isOtpModalOpen && resendTimer > 0) {
      timerId = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
    }
    return () => clearTimeout(timerId);
  }, [isOtpModalOpen, resendTimer]);

  const setField = (key: keyof typeof formData, value: string) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleSendOtp = () => {
    if (formData.mobile.length !== 10) {
      toast({ title: 'Error', description: 'Please enter a 10-digit mobile number.', variant: 'destructive' });
      return;
    }
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsOtpModalOpen(true);
      setResendTimer(30);
      toast({ title: 'OTP Sent', description: `Mock OTP (${MOCK_OTP}) sent successfully.` });
    }, 1000);
  };

  const handleResendOtp = () => {
    setResendTimer(30);
    toast({ title: 'OTP Resent', description: `New Mock OTP (${MOCK_OTP}) sent.` });
  };

  const handleVerifyOtp = () => {
    if (otp === MOCK_OTP) {
      setIsMobileVerified(true);
      setIsOtpModalOpen(false);
      setOtp('');
      toast({ title: 'Verification Successful', description: 'Mobile number verified.', className: 'bg-green-100 border-green-200' });
    } else {
      toast({ title: 'Verification Failed', description: 'Invalid OTP. Please try again.', variant: 'destructive' });
      setOtp('');
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'firstName' | 'lastName') => {
    const value = e.target.value;
    const sanitizedValue = value.replace(/[^a-zA-Z\s]/g, '');
    setField(field, sanitizedValue);
  }

  const handleExit = () => {
    if (!currentLead || !coApplicantId) return;

    // Save current step data (Rule c)
    updateCoApplicant(currentLead.id, coApplicantId, {
      relationship: formData.relationship,
      currentStep: 1,
      data: {
        ...coApplicant?.data,
        step1: {
          ...formData,
          isMobileVerified,
        }
      }
    });

    // Back to co-applicants should go to main step 5
    router.push('/lead/step5');
  };

  const handleNext = () => {
    if (!currentLead || !coApplicantId) return;

    // Save data and move to next sub-step
    updateCoApplicant(currentLead.id, coApplicantId, {
      relationship: formData.relationship,
      currentStep: 2,
      data: {
        ...coApplicant?.data,
        step1: {
          ...formData,
          isMobileVerified,
        }
      }
    });

    // Next should go to co-applicant step 2
    if (coApplicantId) {
      router.push(`/lead/step5/coapplicant/step2?coApplicantId=${coApplicantId}`);
    }
  };

  const canSendOtp = formData.relationship && formData.mobile.length === 10 && formData.firstName && formData.lastName;
  const canProceed = isMobileVerified;

  const progressBarText = 'Co-Applicant Details';


  if (!currentLead || !coApplicant) {
    return null;
  }

  return (
    <DashboardLayout
      title={progressBarText}
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24">
        <ProgressBar currentStep={1} totalSteps={3} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-[#003366] mb-6">Co-Applicant Contact</h2>
          <div className="space-y-6">

            {/* Relationship Dropdown */}
            <div>
              <Label htmlFor="relationship" className="text-sm font-medium text-[#003366] mb-2 block">Relationship with Applicant <span className="text-[#DC2626]">*</span></Label>
              <Select value={formData.relationship} onValueChange={(value: string) => setField('relationship', value)}>
                <SelectTrigger id="relationship" className="h-12 rounded-lg"><SelectValue placeholder="Select Relationship" /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map(rel => (
                    <SelectItem key={rel.value} value={rel.value}>{rel.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-[#003366] mb-2 block">Co-Applicant Name <span className="text-[#DC2626]">*</span></Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="first-name" className="sr-only">First Name</Label>
                  <Input
                    id="first-name"
                    name="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleNameChange(e, 'firstName')}
                    placeholder="First Name"
                    className="h-12 rounded-lg"
                    maxLength={100}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <Label htmlFor="last-name" className="sr-only">Last Name</Label>
                  <Input
                    id="last-name"
                    name="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleNameChange(e, 'lastName')}
                    placeholder="Last Name"
                    className="h-12 rounded-lg"
                    maxLength={50}
                    autoComplete="family-name"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="mobile-number" className="text-sm font-medium text-[#003366] mb-2 block">Co-Applicant Mobile Number <span className="text-[#DC2626]">*</span></Label>
              <div className="flex">
                <div className="flex items-center px-3 h-12 bg-[#F3F4F6] border border-r-0 border-gray-300 rounded-l-lg">
                  <span className="text-[#003366] font-medium">+91</span>
                </div>
                <div className="relative flex-1">
                  <Input
                    type="tel"
                    id="mobile-number"
                    name="mobile"
                    placeholder="Enter 10-digit mobile number"
                    maxLength={10}
                    value={formData.mobile}
                    onChange={(e) => setField('mobile', e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full h-12 pr-10 rounded-l-none rounded-r-lg"
                    disabled={isMobileVerified}
                    autoComplete="tel"
                  />
                  {isMobileVerified && <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#16A34A]" />}
                </div>
              </div>
            </div>


            <div className="pt-2">
              {!isMobileVerified ? (
                <Button onClick={handleSendOtp} disabled={!canSendOtp || isVerifying} className="w-full h-12 bg-[#0072CE] hover:bg-[#005a9e] font-medium transition-colors rounded-lg">
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
            <Button onClick={handleExit} variant="outline" className="flex-1 h-12 rounded-lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Co-Applicants
            </Button>
            <Button onClick={handleNext} disabled={!canProceed} className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]">
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* OTP Modal */}
      <Dialog open={isOtpModalOpen} onOpenChange={setIsOtpModalOpen}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="text-center space-y-4">
            <DialogTitle className="text-lg font-semibold text-[#003366]">Verify Consent OTP</DialogTitle>
            <DialogDescription>
              An OTP has been sent to +91-XXXXXX{formData.mobile.slice(-4)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => {
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
              <p id="countdown-text" className="text-sm text-neutral">
                {resendTimer > 0 ? (
                  <>Resend OTP in <span className="font-medium text-primary">{`00:${resendTimer.toString().padStart(2, '0')}`}</span></>
                ) : "Didn't receive OTP?"}
              </p>
              <Button
                type="button"
                variant="link"
                onClick={handleResendOtp}
                disabled={resendTimer > 0}
                className={cn('p-0 h-auto text-[#0072CE] hover:text-[#005a9e]', resendTimer > 0 && 'cursor-not-allowed text-gray-400')}
              >
                Resend OTP
              </Button>
            </div>
            <div className="space-y-3">
              <Button onClick={handleVerifyOtp} disabled={otp.length !== 6} className="w-full h-12 bg-[#0072CE] text-white rounded-xl font-semibold text-lg hover:bg-[#005a9e] transition-colors">
                Verify & Continue
              </Button>
              <Button type="button" variant="link" onClick={() => setIsOtpModalOpen(false)} className="w-full text-sm text-[#0072CE] hover:text-[#005a9e] font-medium transition-colors">
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

export default function CoApplicantStep1Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <CoApplicantStep1PageContent />
    </Suspense>
  );
}
