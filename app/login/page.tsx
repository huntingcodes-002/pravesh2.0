
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { LogIn, Loader2, MapPin, AlertTriangle } from 'lucide-react';

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
import { useGeolocation } from '@uidotdev/usehooks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// --- Custom Colors based on HTML Mock ---
// primary-blue: #0072CE
// dark-blue: #003366
// neutral-gray: #6B7280

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' })
    .max(32, { message: 'Password must be at most 32 characters.' }),
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const suppressModalAutoOpenRef = useRef(false);
  const lastLocationErrorRef = useRef<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onChange',
  });

  const geolocation = useGeolocation({
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  });

  const locationCoords = useMemo(() => {
    const latitude =
      typeof geolocation.latitude === 'number' ? geolocation.latitude.toFixed(6) : '';
    const longitude =
      typeof geolocation.longitude === 'number' ? geolocation.longitude.toFixed(6) : '';

    return { latitude, longitude };
  }, [geolocation.latitude, geolocation.longitude]);

  const locationErrorMessage = useMemo(() => {
    if (!geolocation.error) return null;

    if (typeof geolocation.error === 'string') {
      return geolocation.error;
    }

    if (
      typeof geolocation.error === 'object' &&
      geolocation.error !== null &&
      'message' in geolocation.error &&
      typeof (geolocation.error as { message?: string }).message === 'string'
    ) {
      return (geolocation.error as { message: string }).message;
    }

    if (
      typeof geolocation.error === 'object' &&
      geolocation.error !== null &&
      'code' in geolocation.error &&
      typeof (geolocation.error as { code?: number }).code === 'number'
    ) {
      const code = (geolocation.error as { code: number }).code;
      switch (code) {
        case 1:
          return 'Location permission is required. Please allow access from the browser prompt.';
        case 2:
          return 'Location information is unavailable. Please ensure GPS or precise location is enabled.';
        case 3:
          return 'Fetching location timed out. Please try again.';
        default:
          break;
      }
    }

    return 'Unable to fetch your current location. Please allow access and try again.';
  }, [geolocation.error]);

  const locationStatus = geolocation.loading
    ? 'pending'
    : geolocation.error
      ? 'error'
      : locationCoords.latitude && locationCoords.longitude
        ? 'success'
        : 'pending';

  const isLocationReady = locationStatus === 'success';
  const hasCoordinates = Boolean(locationCoords.latitude && locationCoords.longitude);

  useEffect(() => {
    if (locationStatus !== 'error') {
      lastLocationErrorRef.current = null;
      return;
    }

    const description =
      locationErrorMessage ?? 'Unable to fetch your current location. Please allow access and try again.';

    if (lastLocationErrorRef.current === description) {
      return;
    }

    toast({
      title: 'Location Required',
      description,
      variant: 'destructive',
    });

    lastLocationErrorRef.current = description;
  }, [locationStatus, locationErrorMessage, toast]);

  useEffect(() => {
    if (locationStatus === 'error') {
      if (!suppressModalAutoOpenRef.current) {
        setIsPermissionModalOpen(true);
      }
    } else {
      setIsPermissionModalOpen(false);
      suppressModalAutoOpenRef.current = false;
    }
  }, [locationStatus]);

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

  const isFormValid =
    form.formState.isValid && Boolean(form.watch('email')) && Boolean(form.watch('password'));
  const isLoginEnabled = isFormValid && isLocationReady;
  
  // Custom button classes for matching mock disabled/enabled style
  const buttonClass = cn(
    'w-full h-14 py-4 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center',
    isSubmitting && 'opacity-70 cursor-not-allowed',
    isLoginEnabled
      ? 'bg-[#0072CE] hover:bg-[#003366] text-white' // primary-blue / dark-blue hover
      : 'bg-[#6B7280] text-white cursor-not-allowed' // neutral-gray disabled
  );
  
  const iconBoxClass = 'w-24 h-24 mx-auto mb-4 flex items-center justify-center';
  const labelClass = 'block text-sm font-medium text-[#003366]';
  const inputClass = 'w-full px-4 py-4 border-2 border-gray-300 rounded-xl bg-white text-[#003366] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#0072CE] focus:border-[#0072CE] transition-colors h-14';

  const handleRetryPermission = useCallback(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      toast({
        title: 'Location Unsupported',
        description: 'Geolocation is not supported on this device. Please try a different browser or device.',
        variant: 'destructive',
      });
      return;
    }

    suppressModalAutoOpenRef.current = true;
    setIsPermissionModalOpen(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        suppressModalAutoOpenRef.current = false;

        const latitude = typeof position.coords.latitude === 'number' ? position.coords.latitude.toFixed(6) : '';
        const longitude = typeof position.coords.longitude === 'number' ? position.coords.longitude.toFixed(6) : '';

        if (latitude && longitude) {
          toast({
            title: 'Location Captured',
            description: 'Coordinates refreshed successfully.',
            className: 'bg-green-50 border-green-200',
          });
        }
      },
      (error) => {
        suppressModalAutoOpenRef.current = false;

        const description =
          error?.message || 'Unable to fetch your current location. Please allow access in your browser settings.';

        toast({
          title: 'Location Required',
          description,
          variant: 'destructive',
        });

        setIsPermissionModalOpen(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  }, [toast]);

  const handlePermissionModalChange = useCallback(
    (open: boolean) => {
      if (!open && locationStatus === 'error' && !suppressModalAutoOpenRef.current) {
        setIsPermissionModalOpen(true);
        return;
      }

      setIsPermissionModalOpen(open);
    },
    [locationStatus]
  );

  const handleOpenMaps = useCallback(() => {
    if (!hasCoordinates) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${locationCoords.latitude},${locationCoords.longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [hasCoordinates, locationCoords.latitude, locationCoords.longitude]);

  return (
    <>
      <AlertDialog open={isPermissionModalOpen} onOpenChange={handlePermissionModalChange}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[#003366]">
              <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
              Location Access Required
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#4B5563]">
              Please allow location access in your browser settings before you continue with login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-3">
            <AlertDialogAction
              onClick={handleRetryPermission}
              className="w-full sm:w-auto bg-[#0072CE] hover:bg-[#005a9e]"
            >
              Try Again
            </AlertDialogAction>
            <AlertDialogCancel className="w-full sm:w-auto">
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-sm border-none shadow-none">
        <CardHeader className="space-y-1 text-center py-8">
            {/* Custom Icon Box based on HTML Mock */}
            <div className={iconBoxClass}>
                <Image
                  src="/apps/pravesh/pravesh-logo.jpg"
                  alt="Pravesh Logo"
                  width={96}
                  height={96}
                  priority
                />
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
                  <FormItem className="space-y-2">
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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className={labelClass}>Password</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your password"
                        type="password"
                        className={inputClass}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-4 space-y-4">
                <Button
                  type="submit"
                  className={buttonClass}
                  disabled={!isLoginEnabled || isSubmitting}
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

                <div className="rounded-xl border border-[#0072CE]/30 bg-[#E6F0FA] p-4 text-sm text-[#003366]">
                  {locationStatus === 'pending' && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#0072CE]" />
                      <span>Fetching your current location…</span>
                    </div>
                  )}
                  {locationStatus === 'success' && (
                    <div className="space-y-1">
                      <p className="font-semibold text-[#003366]">Location captured successfully.</p>
                      <p className="font-mono text-xs text-[#1F2937]">
                        Latitude: {locationCoords.latitude} · Longitude: {locationCoords.longitude}
                      </p>
                    </div>
                  )}
                  {locationStatus === 'error' && (
                    <div className="space-y-1">
                      <p className="font-semibold text-[#B91C1C]">Location access is required to login.</p>
                      {locationErrorMessage && (
                        <p className="text-xs text-[#7F1D1D]">{locationErrorMessage}</p>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenMaps}
                  disabled={!hasCoordinates}
                  className={cn(
                    'w-full h-12 border-[#0072CE]/40 text-[#0072CE] hover:bg-[#E6F0FA] hover:text-[#003366]',
                    !hasCoordinates && 'cursor-not-allowed text-gray-400 border-gray-300 hover:bg-white'
                  )}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  View Location in Google Maps
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
    </>
  );
}
