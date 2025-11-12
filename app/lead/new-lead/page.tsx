'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead, type Lead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { cn } from '@/lib/utils';
import { Send, CheckCircle, Loader, Edit } from 'lucide-react';
import { createNewLead, verifyMobileOTP, resendMobileOTP, isApiError, type ApiSuccess, type NewLeadResponse, type ResendMobileOtpData, type VerifyMobileResponse } from '@/lib/api';

function Step1PageContent() {
  const { currentLead, updateLead, addLeadToArray } = useLead();
  const router = useRouter();
  const { toast } = useToast(); // Initialize useToast

  const initialFirstName = currentLead?.customerFirstName || currentLead?.formData?.step1?.firstName || '';
  const initialLastName = currentLead?.customerLastName || currentLead?.formData?.step1?.lastName || '';
  const [formData, setFormData] = useState({
    productType: currentLead?.formData?.step1?.productType || '',
    applicationType: currentLead?.formData?.step1?.applicationType || 'new',
    mobile: currentLead?.customerMobile || '',
    fullName: currentLead?.formData?.step1?.fullName || `${initialFirstName} ${initialLastName}`.trim(),
  });

  const [isMobileVerified, setIsMobileVerified] = useState(currentLead?.formData?.step1?.isMobileVerified || false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(currentLead?.appId || null);
  const [isResendingOtp, setIsResendingOtp] = useState(false);

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

  const nameParts = deriveNameParts(formData.fullName);

  useEffect(() => {
    if (currentLead) {
      const { firstName, lastName } = nameParts;
      updateLead(currentLead.id, {
        formData: { ...currentLead.formData, step1: { ...formData, firstName, lastName, isMobileVerified } },
        customerMobile: formData.mobile,
        customerFirstName: firstName,
        customerLastName: lastName,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isMobileVerified, nameParts.firstName, nameParts.lastName]);
  
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (isOtpModalOpen && resendTimer > 0) {
      timerId = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
    }
    return () => clearTimeout(timerId);
  }, [isOtpModalOpen, resendTimer]);

  const handleSendOtp = async () => {
    if (formData.mobile.length !== 10) {
      toast({ title: 'Error', description: 'Please enter a 10-digit mobile number.', variant: 'destructive' });
      return;
    }
    
    if (!formData.productType || !formData.applicationType || !nameParts.firstName || !nameParts.lastName) {
      toast({ title: 'Error', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }

    setIsCreatingLead(true);
    setIsVerifying(true);

    try {
      // Map application type from frontend to backend format
      const applicationTypeMap: Record<string, string> = {
        'new': 'NewApplication',
        'additional-disbursal': 'AdditionalDisbursal',
        'multiple-assets': 'MultipleAssets',
        'topup-without-closure': 'TopupWithoutClosure',
        'bt-topup': 'Balance Transfer With Topup',
      };

      const backendApplicationType = applicationTypeMap[formData.applicationType] || 'NewApplication';

      // Endpoint 1: Create new lead
      const response = await createNewLead({
        product_type: formData.productType as 'secured' | 'unsecured',
        application_type: backendApplicationType,
        mobile_number: formData.mobile,
        first_name: nameParts.firstName,
        last_name: nameParts.lastName,
      });

      if (isApiError(response)) {
        // Show validation error from backend
        const errorMessage = response.error || 'Failed to create new lead. Please try again.';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        setIsCreatingLead(false);
        setIsVerifying(false);
        return;
      }

      // Backend response structure: { success: true, application_id, workflow_id, next_step, data: {...} }
      // Note: Application ID will be set after OTP verification, not here
      const successResponse = response as ApiSuccess<NewLeadResponse>;
      
      // Store application_id temporarily for OTP verification step
      const tempApplicationId = successResponse.application_id;
      
      if (tempApplicationId) {
        setApplicationId(tempApplicationId);
        // Update formData but NOT appId - appId will be set after OTP verification
        if (currentLead) {
          updateLead(currentLead.id, {
            formData: {
              ...currentLead.formData,
              step1: {
                ...formData,
                isMobileVerified,
                applicationId: tempApplicationId, // Store temporarily for verification step
              },
            },
          });
        }
      }

      setIsVerifying(false);
      setIsOtpModalOpen(true);
      setResendTimer(30);
      toast({ title: 'OTP Sent', description: 'OTP sent successfully.' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create new lead. Please try again.',
        variant: 'destructive',
      });
      setIsCreatingLead(false);
      setIsVerifying(false);
    }
  };
  
  const handleResendOtp = async () => {
    if (!applicationId) {
      toast({
        title: 'Error',
        description: 'Application ID not found. Please request OTP again.',
        variant: 'destructive',
      });
      return;
    }

    setIsResendingOtp(true);

    try {
      const response = await resendMobileOTP({ application_id: applicationId });

      if (isApiError(response)) {
        const errorMessage = response.error || 'Failed to resend OTP. Please try again.';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      const successResponse = response as ApiSuccess<ResendMobileOtpData>;
      setResendTimer(30);
      toast({
        title: 'OTP Sent',
        description: successResponse.message || 'OTP resent successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 4) {
      toast({ title: 'Error', description: 'Please enter a 4-digit OTP.', variant: 'destructive' });
      return;
    }

    if (!applicationId) {
      toast({ title: 'Error', description: 'Application ID not found. Please request OTP again.', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);

    try {
      // Endpoint 7: Verify mobile OTP (verify-mobile)
      const response = await verifyMobileOTP({
        application_id: applicationId,
        otp: otp,
      });

      if (isApiError(response)) {
        // Show backend error message (for both 400 and 401)
        const errorMessage = response.error || 'Failed to verify OTP. Please try again.';
        toast({
          title: 'Verification Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        setOtp('');
        setIsVerifying(false);
        return;
      }

      // Backend response structure: { success: true, message, application_id, mobile_verified, next_step, data }
      // OTP verified successfully - extract application_id from response
      const successResponse = response as ApiSuccess<VerifyMobileResponse>;
      const verifiedApplicationId = successResponse.application_id;
      
      setIsMobileVerified(true);
      setIsOtpModalOpen(false);
      setOtp('');
      
      // Update lead state with application_id from backend response
      if (currentLead && verifiedApplicationId) {
        // Update both appId and local state
        setApplicationId(verifiedApplicationId);
        
        // Create the updated lead object with all changes
        const updatedLead: Lead = {
          ...currentLead,
          appId: verifiedApplicationId, // Set the actual Application ID from backend
          customerName: `${nameParts.firstName || currentLead.customerFirstName || ''} ${nameParts.lastName || currentLead.customerLastName || ''}`.trim() || currentLead.customerName,
          customerMobile: formData.mobile || currentLead.customerMobile,
          customerFirstName: nameParts.firstName || currentLead.customerFirstName,
          customerLastName: nameParts.lastName || currentLead.customerLastName,
          formData: {
            ...currentLead.formData,
            step1: {
              ...formData,
              firstName: nameParts.firstName,
              lastName: nameParts.lastName,
              isMobileVerified: true,
              applicationId: verifiedApplicationId,
            },
          },
          updatedAt: new Date().toISOString(),
        };
        
        // Update the currentLead state
        updateLead(currentLead.id, {
          appId: verifiedApplicationId,
          customerMobile: formData.mobile,
          customerFirstName: nameParts.firstName,
          customerLastName: nameParts.lastName,
          formData: {
            ...currentLead.formData,
            step1: {
              ...formData,
              firstName: nameParts.firstName,
              lastName: nameParts.lastName,
              isMobileVerified: true,
              applicationId: verifiedApplicationId,
            },
          },
        });
        
        // Add lead to leads array only after successful OTP verification
        addLeadToArray(updatedLead);
      }

      toast({
        title: 'Verification Successful',
        description: 'Mobile number verified.',
        className: 'bg-green-100 border-green-200',
      });
      setIsVerifying(false);
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Failed to verify OTP. Please try again.',
        variant: 'destructive',
      });
      setOtp('');
      setIsVerifying(false);
    }
  };

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const sanitizedValue = value.replace(/[^a-zA-Z\s]/g, ' ');
    const normalizedValue = sanitizedValue.replace(/\s+/g, ' ');
    setFormData({ ...formData, fullName: normalizedValue });
  };

  const appTypeDescriptions: { [key: string]: string } = {
    'new': 'Fresh loan application for first-time customers or new loan requirements.',
    'balance-transfer': 'Transfer existing loan from another lender to Saarathi Finance with better terms.',
    'bt-topup': 'Additional loan amount on top of existing loan with balance transfer.',
    'renewal': 'Renew an existing loan facility.'
  };

  const handleNext = () => {
    if (!currentLead) return;

    // Save and proceed to New Lead Information page
    updateLead(currentLead.id, {
      currentStep: 2,
    });
    router.push('/lead/new-lead-info');
  };

  const canSendOtp = Boolean(
    formData.productType &&
    formData.applicationType &&
    formData.mobile.length === 10 &&
    nameParts.firstName &&
    nameParts.lastName
  );
  const canProceed = isMobileVerified;
  
  // Co-applicant flow elements should not appear here
  const handleExit = () => {
    router.push('/leads');
  };

  return (
    <DashboardLayout
      title="New Lead"
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-[#003366] mb-6">Lead Information</h2>
          <div className="space-y-6">
            
            <div>
              <Label htmlFor="product-type" className="text-sm font-medium text-[#003366] mb-2 block">Product Type <span className="text-[#DC2626]">*</span></Label>
              <Select value={formData.productType} onValueChange={(value:string) => setFormData({ ...formData, productType: value })}>
                <SelectTrigger id="product-type" className="h-12 rounded-lg"><SelectValue placeholder="Select Product Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="secured">Secured</SelectItem>
                  <SelectItem value="unsecured">Unsecured</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="application-type" className="text-sm font-medium text-[#003366] mb-2 block">Application Type <span className="text-[#DC2626]">*</span></Label>
              <Select value={formData.applicationType} onValueChange={(value:string) => setFormData({ ...formData, applicationType: value })}>
                <SelectTrigger id="application-type" className="h-12 rounded-lg"><SelectValue placeholder="Select Application Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New Application</SelectItem>
                  <SelectItem value="additional-disbursal">Additional Disbursal</SelectItem>
                  <SelectItem value="multiple-assets">Multiple Assets</SelectItem>
                  <SelectItem value="topup-without-closure">Topup Without Closure</SelectItem>
                  <SelectItem value="bt-topup">Balance Transfer With Topup</SelectItem>
                </SelectContent>
              </Select>
              {formData.applicationType && appTypeDescriptions[formData.applicationType] && (
                 <div className="mt-2 p-3 bg-[#E6F0FA] border-l-4 border-[#0072CE] rounded-r-lg">
                    <p className="text-sm text-[#003366]">{appTypeDescriptions[formData.applicationType]}</p>
                </div>
               )}
            </div>

            <div>
                <Label htmlFor="full-name" className="text-sm font-medium text-[#003366] mb-2 block">Customer Name <span className="text-[#DC2626]">*</span></Label>
                <Input
                  id="full-name"
                  value={formData.fullName}
                  onChange={handleFullNameChange}
                  placeholder="Enter full name as per PAN"
                  className="h-12 rounded-lg"
                  maxLength={150}
                />
            </div>
            
            <div>
              <Label htmlFor="mobile-number" className="text-sm font-medium text-[#003366] mb-2 block">Customer Mobile Number <span className="text-[#DC2626]">*</span></Label>
              <div className="flex">
                  <div className="flex items-center px-3 h-12 bg-[#F3F4F6] border border-r-0 border-gray-300 rounded-l-lg">
                      <span className="text-[#003366] font-medium">+91</span>
                  </div>
                  <div className="relative flex-1">
                      <Input type="tel" id="mobile-number" placeholder="Enter 10-digit mobile number" maxLength={10} value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/[^0-9]/g, '') })} className="w-full h-12 pr-10 rounded-l-none rounded-r-lg" disabled={isMobileVerified} />
                      {isMobileVerified && <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#16A34A]" />}
                  </div>
              </div>
            </div>

            
            
            <div className="pt-2">
              {!isMobileVerified ? (
                 <Button onClick={handleSendOtp} disabled={!canSendOtp || isVerifying || isCreatingLead} className="w-full h-12 bg-[#0072CE] hover:bg-[#005a9e] font-medium transition-colors rounded-lg">
                    {(isVerifying || isCreatingLead) ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    {(isVerifying || isCreatingLead) ? 'Creating Lead...' : 'Send Consent OTP'}
                </Button>
              ) : (
                <div className="p-4 bg-green-100/50 border border-green-200 rounded-2xl flex items-center justify-center gap-3">
                    <CheckCircle className="text-[#16A34A] text-xl w-6 h-6"/>
                    <p className="text-sm text-[#16A34A] font-medium">Consent verified successfully!</p>
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
            <div className="flex gap-3 max-w-2xl mx-auto">
                <Button variant="outline" className="flex-1 h-12 rounded-lg" disabled>Previous</Button>
                <Button onClick={handleNext} disabled={!canProceed} className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]">Next</Button>
            </div>
        </div>
      </div>
      
      {/* OTP Modal */}
      <Dialog open={isOtpModalOpen} onOpenChange={setIsOtpModalOpen}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="text-center space-y-4">
            <DialogTitle className="text-lg font-semibold text-[#003366]">Verify Consent OTP</DialogTitle>
            <DialogDescription>
              Enter the 4-digit OTP sent to +91-XXXXXX{formData.mobile.slice(-4)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
             <div className="flex justify-center">
              <InputOTP 
                maxLength={4}
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
                  disabled={resendTimer > 0 || isResendingOtp}
                  className={cn(
                    'p-0 h-auto text-[#0072CE] hover:text-[#005a9e]',
                    (resendTimer > 0 || isResendingOtp) && 'cursor-not-allowed text-gray-400'
                  )}
                >
                  {isResendingOtp ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      Resending...
                    </span>
                  ) : (
                    'Resend OTP'
                  )}
                </Button>
            </div>
            <div className="space-y-3">
                <Button onClick={handleVerifyOtp} disabled={otp.length !== 4 || isVerifying} className="w-full h-12 bg-[#0072CE] text-white rounded-xl font-semibold text-lg hover:bg-[#005a9e] transition-colors">
                    {isVerifying ? <><Loader className="w-5 h-5 animate-spin mr-2" /> Verifying...</> : 'Verify & Continue'}
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

export default function Step1Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <Step1PageContent />
    </Suspense>
  );
}
