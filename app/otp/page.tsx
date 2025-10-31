
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MOCK_OTP } from '@/lib/mock-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { CircleCheck, ShieldAlert, RotateCcw, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label'; // <-- ADDED IMPORT FOR LABEL

export default function OtpVerificationPage() {
  const router = useRouter();
  const { pendingAuth, verifyOtpAndSignIn } = useAuth();
  const { toast } = useToast();
  
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  // Redirect if no pending auth data
  useEffect(() => {
    if (!pendingAuth) {
      router.replace('/dashboard');
    }
  }, [pendingAuth, router]);

  // Resend Timer Logic
  useEffect(() => {
    if (resendTimer > 0) {
      const timerId = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resendTimer]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast({
        title: 'Error',
        description: 'Please enter the 6-digit OTP.',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500)); 

    const success = await verifyOtpAndSignIn(otp);
    
    if (success) {
      toast({
        title: 'Verification Successful',
        description: 'Mobile number verified. Redirecting to Home Dashboard.',
        className: 'bg-green-50 border-green-200',
        action: <CircleCheck className='h-4 w-4'/>
      });
      
      // Redirect to the Home Dashboard
      router.replace('/dashboard'); 
    } else {
      toast({
        title: 'Verification Failed',
        description: 'The OTP entered is incorrect. Please try again.',
        variant: 'destructive',
      });
      setOtp(''); // Clear OTP on failure
    }
    setIsVerifying(false);
  };
  
  const handleResend = () => {
    setResendTimer(60); // Reset timer to 60 seconds
    toast({
      title: 'OTP Resent',
      description: 'A new OTP has been sent to your registered mobile number.',
      className: 'bg-blue-50 border-blue-200',
      action: <RotateCcw className='h-4 w-4'/>
    });
  };

  if (!pendingAuth) {
    return null;
  }
  
  const isOtpValidLength = otp.length === 6;
  const buttonClass = cn(
    'w-full h-14 py-4 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center',
    isVerifying && 'opacity-70 cursor-not-allowed',
    isOtpValidLength && !isVerifying
      ? 'bg-[#0072CE] hover:bg-[#003366] text-white' 
      : 'bg-[#6B7280] text-white cursor-not-allowed'
  );
  
  const iconBoxClass = 'w-20 h-20 bg-[#0072CE] rounded-2xl mx-auto mb-4 flex items-center justify-center';
  // Custom styling for InputOTPSlot to match the HTML mock's input boxes
  const otpSlotClass = 'w-12 h-14 text-center text-xl font-semibold border-2 border-gray-300 rounded-xl bg-white text-[#003366] focus:outline-none focus:ring-2 focus:ring-[#0072CE] focus:border-[#0072CE] transition-colors';
  const otpGroupClass = 'flex justify-center space-x-3';
  const labelClass = 'block text-sm font-medium text-[#003366] text-center';


  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-sm border-none shadow-none">
        <CardHeader className="space-y-1 text-center py-8">
          <div className={iconBoxClass}>
            <ShieldAlert className="w-9 h-9 text-white" /> {/* Using ShieldAlert for security/identity icon */}
          </div>
          <CardTitle className="text-2xl font-bold text-[#003366]">Verify Your Identity</CardTitle>
          <CardDescription className="text-sm text-[#6B7280] px-4">
            An OTP has been sent to your registered mobile number ending with ****{pendingAuth.user.phone.slice(-4)}
          </CardDescription>
        </CardHeader>
        <CardContent className='px-6 py-4'>
          <form onSubmit={handleVerify} className="space-y-6">
            
            <div className="space-y-4">
                <Label className={labelClass}>Enter 6-digit OTP</Label>
                <div id="otp-inputs" className={otpGroupClass}>
                    <InputOTP 
                        maxLength={6}
                        value={otp}
                        onChange={(value) => setOtp(value)}
                        disabled={isVerifying}
                    >
                        {/* Using InputOTPGroup without separator to match the visual layout */}
                        <InputOTPGroup className="space-x-3">
                            <InputOTPSlot index={0} className={cn(otpSlotClass, 'focus:!ring-2 focus:!ring-[#0072CE] focus:!border-[#0072CE] !border-r-2 !border-l-2 !border-y-2')} />
                            <InputOTPSlot index={1} className={cn(otpSlotClass, 'focus:!ring-2 focus:!ring-[#0072CE] focus:!border-[#0072CE] !border-r-2 !border-y-2 !border-l-2')} />
                            <InputOTPSlot index={2} className={cn(otpSlotClass, 'focus:!ring-2 focus:!ring-[#0072CE] focus:!border-[#0072CE] !border-r-2 !border-y-2 !border-l-2')} />
                            <InputOTPSlot index={3} className={cn(otpSlotClass, 'focus:!ring-2 focus:!ring-[#0072CE] focus:!border-[#0072CE] !border-r-2 !border-y-2 !border-l-2')} />
                            <InputOTPSlot index={4} className={cn(otpSlotClass, 'focus:!ring-2 focus:!ring-[#0072CE] focus:!border-[#0072CE] !border-r-2 !border-y-2 !border-l-2')} />
                            <InputOTPSlot index={5} className={cn(otpSlotClass, 'focus:!ring-2 focus:!ring-[#0072CE] focus:!border-[#0072CE] !border-r-2 !border-y-2 !border-l-2')} />
                        </InputOTPGroup>
                    </InputOTP>
                </div>
                {/* Note: The mock error is handled via toast in React. */}
            </div>
            
            <div className="space-y-4 pt-4">
                <Button 
                    type="submit" 
                    className={buttonClass}
                    disabled={!isOtpValidLength || isVerifying}
                >
                    {isVerifying ? <Loader className='h-5 w-5 animate-spin mr-2'/> : null}
                    Verify & Continue
                </Button>
                
                <div className="text-center">
                    <span className="text-[#6B7280] text-sm">Didn&apos;t receive OTP? </span>
                    <Button 
                        type="button" 
                        variant="link" 
                        onClick={handleResend} 
                        disabled={resendTimer > 0 || isVerifying}
                        className={cn('p-0 h-auto text-sm font-medium transition-colors', 
                                    (resendTimer > 0 || isVerifying) ? 'text-[#6B7280] cursor-not-allowed' : 'text-[#0072CE] hover:text-[#003366]')}
                    >
                        {resendTimer > 0 
                            ? `Resend OTP (${resendTimer}s)` 
                            : 'Resend OTP'}
                    </Button>
                </div>
                
                <div className="text-center text-xs text-blue-500">
                    <p>For testing, use the mock OTP: <span className="font-semibold">{MOCK_OTP}</span></p>
                </div>
            </div>
          </form>
        </CardContent>
        <footer className="absolute bottom-6 left-0 right-0 text-center px-6 max-w-sm mx-auto">
            <p className="text-xs text-[#6B7280]">© Saarathi Finance 2025</p>
        </footer>
      </Card>
    </div>
  );
}
