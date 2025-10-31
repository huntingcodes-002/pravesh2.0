
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Send, Loader, ArrowLeft, Mail, CheckCircle, AlertTriangle } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailError) {
      setEmailError('');
    }
  };

  const handleEmailBlur = () => {
    const value = email.trim();
    if (value && !validateEmail(value)) {
        setEmailError('Please enter a valid email address.');
    } else if (!value) {
        setEmailError('Email address is required.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleEmailBlur();
    
    if (!email.trim() || !validateEmail(email)) {
        return;
    }

    setIsSubmitting(true);
    
    // Simulate API call to send reset link
    await new Promise(resolve => setTimeout(resolve, 2000)); 

    // Mock logic: assume success if email is valid
    toast({
        title: 'Reset Link Sent',
        description: `Successfully initiated password reset for ${email}.`,
        className: 'bg-green-50 border-green-200',
    });
    
    setIsSubmitting(false);
    setIsSuccess(true);
  };

  const isFormValid = validateEmail(email.trim());
  
  // Custom classes for design fidelity
  const iconBoxClass = 'w-20 h-20 bg-[#0072CE] rounded-2xl mx-auto mb-4 flex items-center justify-center';
  const labelClass = 'block text-sm font-medium text-[#003366]';
  const inputClass = 'w-full pl-10 pr-4 py-3 border-2 border-transparent rounded-xl bg-white text-[#003366] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#0072CE] focus:border-[#0072CE] transition-colors h-12';
  
  const buttonClass = cn(
    'w-full h-12 py-4 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center',
    isSubmitting && 'opacity-70 cursor-not-allowed',
    isFormValid && !isSubmitting
      ? 'bg-[#0072CE] hover:bg-[#003366] text-white' // primary-blue / dark-blue hover
      : 'bg-[#6B7280] text-white cursor-not-allowed' // neutral-gray disabled
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] p-4">
      <Card className="w-full max-w-sm border-none shadow-none bg-transparent">
        <CardHeader className="space-y-1 text-center py-8">
          <div className={iconBoxClass}>
            <Key className="w-9 h-9 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#003366]">Forgot Password?</CardTitle>
          <CardDescription className="text-sm text-[#6B7280] px-4">
            Enter your registered email ID to receive a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent className='px-6 py-4'>
            <Card className='rounded-2xl shadow-lg p-6 bg-white'>
                {isSuccess ? (
                    /* Success State - based on HTML mock structure */
                    <div className="text-center space-y-4 py-4" id="success-state">
                        <div className="w-16 h-16 bg-[#16A34A] rounded-full mx-auto mb-4 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-[#003366]">Reset Link Sent!</h3>
                        <p className="text-sm text-[#6B7280] px-2">
                            Reset link sent to your email. Check your inbox and follow the instructions to reset your password.
                        </p>
                    </div>
                ) : (
                    /* Form State */
                    <form id="forgot-password-form" className="space-y-6" onSubmit={handleSubmit}>
                        
                        <div id="email-input-section" className="space-y-2">
                            <Label htmlFor="email" className={labelClass}>Email Address</Label>
                            <div className={cn("relative bg-gray-50 border-2 border-gray-200 rounded-xl", emailError && "border-red-500")}>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="w-4 h-4 text-[#6B7280]" />
                                </div>
                                <Input 
                                    type="email" 
                                    id="email" 
                                    value={email}
                                    onChange={handleEmailChange}
                                    onBlur={handleEmailBlur}
                                    placeholder="Enter your email address"
                                    className={cn(inputClass, "border-none bg-transparent")} 
                                    required
                                />
                            </div>
                            
                            {emailError && (
                                <div id="email-error" className="text-red-600 text-sm font-medium mt-2 flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4 mr-1"/>
                                    <span id="email-error-text">{emailError}</span>
                                </div>
                            )}
                        </div>

                        <div id="form-actions" className="space-y-4 pt-4">
                            <Button 
                                type="submit" 
                                className={buttonClass}
                                disabled={!isFormValid || isSubmitting}
                            >
                                {isSubmitting ? <Loader className="w-5 h-5 animate-spin mr-2"/> : <Send className="w-4 h-4 mr-2" />}
                                Send Reset Link
                            </Button>
                        </div>
                    </form>
                )}
            </Card>

            <div id="back-to-login" className="text-center mt-6">
                <Button 
                    variant="link" 
                    onClick={() => router.push('/login')} 
                    className="text-[#0072CE] font-medium text-sm hover:text-[#003366] transition-colors p-0 h-auto"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                </Button>
            </div>
        </CardContent>
        <footer className="absolute bottom-6 left-0 right-0 text-center px-6 max-w-sm mx-auto">
            <p className="text-xs text-[#6B7280]">© Saarathi Finance 2025</p>
        </footer>
      </Card>
    </div>
  );
}
