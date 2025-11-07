
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LogIn, LayoutGrid, Loader2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';

// --- Custom Colors based on HTML Mock ---
// primary-blue: #0072CE
// dark-blue: #003366
// neutral-gray: #6B7280

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
    mode: 'onChange',
  });

  async function onSubmit(data: LoginFormValues) {
    setIsSubmitting(true);
    const success = await login(data.email);

    if (success) {
      toast({
        title: 'OTP Sent',
        description: 'An OTP has been sent to your email address. Redirecting to verification.',
        className: 'bg-green-50 border-green-200',
      });
      // Redirect to the OTP page
      router.push('/otp');
    } else {
      toast({
        title: 'Login Failed',
        description: 'An error occurred. Please try again.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  }

  const isFormValid = form.formState.isValid && form.watch('email');
  
  // Custom button classes for matching mock disabled/enabled style
  const buttonClass = cn(
    'w-full h-14 py-4 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center',
    isSubmitting && 'opacity-70 cursor-not-allowed',
    isFormValid
      ? 'bg-[#0072CE] hover:bg-[#003366] text-white' // primary-blue / dark-blue hover
      : 'bg-[#6B7280] text-white cursor-not-allowed' // neutral-gray disabled
  );
  
  const iconBoxClass = 'w-20 h-20 bg-[#0072CE] rounded-2xl mx-auto mb-4 flex items-center justify-center';
  const labelClass = 'block text-sm font-medium text-[#003366]';
  const inputClass = 'w-full px-4 py-4 border-2 border-gray-300 rounded-xl bg-white text-[#003366] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#0072CE] focus:border-[#0072CE] transition-colors h-14';

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-sm border-none shadow-none">
        <CardHeader className="space-y-1 text-center py-8">
            {/* Custom Icon Box based on HTML Mock */}
            <div className={iconBoxClass}>
                <LayoutGrid className="w-9 h-9 text-white" /> {/* Using LayoutGrid for a grid icon */}
            </div>
            <CardTitle className="text-2xl font-bold text-[#003366]">Hey User!</CardTitle>
            <CardDescription className="text-lg text-[#6B7280]">
                Welcome
            </CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className='space-y-2'>
                    <FormLabel className={labelClass}>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your email address"
                        type="email"
                        className={inputClass}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-4">
                <Button 
                    type="submit" 
                    className={buttonClass}
                    disabled={!isFormValid || isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            <span>Logging in...</span>
                        </>
                    ) : (
                        <>
                            <LogIn className="w-5 h-5 mr-2" />
                            <span>Login</span>
                        </>
                    )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        <footer className="absolute bottom-6 left-0 right-0 text-center px-6 max-w-sm mx-auto">
            <p className="text-xs text-[#6B7280]">© Saarathi Finance 2025</p>
        </footer>
      </Card>
    </div>
  );
}
