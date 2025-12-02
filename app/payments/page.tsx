'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { RefreshCw, CheckCircle, ChevronDown, Trash2, Send, Wallet } from 'lucide-react';
import { useLead } from '@/contexts/LeadContext';
import { getAccessToken, requestPaymentWaiver, isApiError } from '@/lib/api';

type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Waived';
type WaiverStatus = 'none' | 'pending' | 'approved' | 'rejected';

const API_BASE_URL = 'https://uatlb.api.saarathifinance.com/api/lead-collection/applications';

export default function PaymentsPage() {
  const router = useRouter();
  const { currentLead } = useLead();

  const headerName = currentLead?.customerName || 'N/A';
  const applicationId = currentLead?.appId || 'N/A';
  const derivedMobile = currentLead?.customerMobile ? `+91 ${currentLead.customerMobile}` : 'N/A';
  const defaultPaymentLink = currentLead?.appId
    ? `https://pay.saarathi.com/login-fee/${currentLead.appId}`
    : 'https://pay.saarathi.com/login-fee';

  const [remarks, setRemarks] = useState('');
  const [isWaveOffModalOpen, setIsWaveOffModalOpen] = useState(false);
  const [waveOffRemarks, setWaveOffRemarks] = useState('');
  const [hasSentLink, setHasSentLink] = useState(false);
  const [showSendLinkCard, setShowSendLinkCard] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pending');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [displayMobile, setDisplayMobile] = useState(derivedMobile);
  const [isResending, setIsResending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedState = useRef(false);

  // Waiver-related state
  const [waiverStatus, setWaiverStatus] = useState<WaiverStatus>('none');
  const [waiverDeviationId, setWaiverDeviationId] = useState<number | null>(null);
  const [isSubmittingWaiver, setIsSubmittingWaiver] = useState(false);
  const waiverRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getAuthorizationHeader = () => {
    const token = getAccessToken();
    if (!token) {
      toast({
        title: 'Authentication required',
        description: 'Your session has expired. Please sign in again to continue.',
        variant: 'destructive',
      });
      return null;
    }
    return `Bearer ${token}`;
  };

  const createdOn = useMemo(() => new Date(), []);
  const [receivedOn, setReceivedOn] = useState<Date | null>(null);

  const storageKey = applicationId ? `payment-state-${applicationId}` : null;

  useEffect(() => {
    if (!hasSentLink) {
      setDisplayMobile(derivedMobile);
    }
  }, [derivedMobile, hasSentLink]);

  useEffect(() => {
    return () => {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!storageKey || hasHydratedState.current) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setHasSentLink(Boolean(parsed.hasSentLink));
        setShowSendLinkCard(Boolean(parsed.showSendLinkCard));
        setPaymentStatus(parsed.paymentStatus as PaymentStatus ?? 'Pending');
        setPaymentUrl(parsed.paymentUrl ?? null);
        setPaymentOrderId(parsed.paymentOrderId ?? null);
        setDisplayMobile(parsed.displayMobile ?? derivedMobile);
        setRemarks(parsed.remarks ?? '');
        setReceivedOn(parsed.receivedOn ? new Date(parsed.receivedOn) : null);
        setWaiverStatus(parsed.waiverStatus ?? 'none');
        setWaiverDeviationId(parsed.waiverDeviationId ?? null);

        // Restart auto-refresh if waiver is pending
        if (parsed.waiverStatus === 'pending') {
          startWaiverAutoRefresh();
        }
      }
    } catch (error) {
      console.warn('Failed to hydrate payment state', error);
    } finally {
      hasHydratedState.current = true;
    }
  }, [storageKey, derivedMobile]);

  useEffect(() => {
    if (!storageKey) return;
    if (!hasHydratedState.current) {
      hasHydratedState.current = true;
      return;
    }
    const payload = {
      hasSentLink,
      showSendLinkCard,
      paymentStatus,
      paymentUrl,
      paymentOrderId,
      displayMobile,
      remarks,
      receivedOn: receivedOn ? receivedOn.toISOString() : null,
      waiverStatus,
      waiverDeviationId,
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to persist payment state', error);
    }
  }, [
    storageKey,
    hasSentLink,
    showSendLinkCard,
    paymentStatus,
    paymentUrl,
    paymentOrderId,
    displayMobile,
    remarks,
    receivedOn,
    waiverStatus,
    waiverDeviationId,
  ]);

  useEffect(() => {
    // Check paymentResult from detailed info first (authoritative source)
    if (currentLead?.paymentResult) {
      const result = currentLead.paymentResult;
      const statusValue = String(result.state || '').toLowerCase();
      let nextStatus: PaymentStatus = 'Pending';

      if (statusValue === 'completed') {
        nextStatus = 'Paid';
      } else if (statusValue === 'failed' || statusValue === 'cancelled') {
        nextStatus = 'Failed';
      } else if (statusValue === 'waived') {
        nextStatus = 'Waived';
        setWaiverStatus('approved');
      }

      // If we already have a definitive status (Paid or Waived), don't overwrite it with Pending
      // unless the new status is also definitive
      if ((paymentStatus === 'Paid' || paymentStatus === 'Waived') && nextStatus === 'Pending') {
        return;
      }

      setPaymentStatus(nextStatus);
      setHasSentLink(true);

      if (result.order_id) setPaymentOrderId(result.order_id);
      if (result.paid_on) {
        try {
          setReceivedOn(new Date(result.paid_on));
        } catch {
          setReceivedOn(null);
        }
      }
      return;
    }

    // Fallback to payments array if paymentResult is missing
    if (!currentLead?.payments || currentLead.payments.length === 0) return;
    const latestPayment: any = [...currentLead.payments].reverse().find((payment) => payment?.status);
    if (!latestPayment) return;

    const statusValue = String(latestPayment.status || '').toLowerCase();
    let nextStatus: PaymentStatus = 'Pending';
    if (statusValue === 'paid' || statusValue === 'completed') {
      nextStatus = 'Paid';
    } else if (statusValue === 'failed' || statusValue === 'expired' || statusValue === 'cancelled') {
      nextStatus = 'Failed';
    }

    // If we already have a definitive status (Paid or Waived), don't overwrite it with Pending
    // unless the new status is also definitive
    if ((paymentStatus === 'Paid' || paymentStatus === 'Waived') && nextStatus === 'Pending') {
      return;
    }

    setPaymentStatus(nextStatus);
    setHasSentLink(true);

    if (latestPayment.payment_url) {
      setPaymentUrl(latestPayment.payment_url);
    }
    if (latestPayment.order_id) {
      setPaymentOrderId(latestPayment.order_id);
    }
    if (latestPayment.paid_on && nextStatus === 'Paid') {
      try {
        setReceivedOn(new Date(latestPayment.paid_on));
      } catch {
        setReceivedOn(null);
      }
    }
  }, [currentLead?.payments, currentLead?.paymentResult]);

  // Fetch latest status on mount
  useEffect(() => {
    if (applicationId && applicationId !== 'N/A') {
      checkPaymentStatus(false);
    }
  }, [applicationId]);

  const handleWaveOffSubmit = async () => {
    if (!waveOffRemarks.trim()) {
      toast({
        title: 'Remarks Required',
        description: 'Please enter remarks for the waiver request.',
        variant: 'destructive',
      });
      return;
    }

    if (!applicationId || applicationId === 'N/A') {
      toast({
        title: 'Error',
        description: 'Application ID is missing.',
        variant: 'destructive',
      });
      return;
    }

    const applicantName = `${currentLead?.customerFirstName || ''} ${currentLead?.customerLastName || ''}`.trim() || 'Applicant';

    setIsSubmittingWaiver(true);

    try {
      const response = await requestPaymentWaiver({
        application_id: applicationId,
        applicant_name: applicantName,
        comment: waveOffRemarks.trim(),
        system_value: '0',
        branch_code: 'BR001',
        state_code: '10',
      });

      if (isApiError(response)) {
        toast({
          title: 'Request Failed',
          description: response.error || 'Failed to submit waiver request. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Success - update state
      setWaiverStatus('pending');
      setWaiverDeviationId(response.data?.deviation_id || null);
      setIsWaveOffModalOpen(false);
      setWaveOffRemarks('');

      toast({
        title: 'Request Submitted',
        description: 'Fee waiver request has been submitted successfully.',
      });

      // Start auto-refresh for waiver status
      startWaiverAutoRefresh();
    } catch (error: any) {
      toast({
        title: 'Request Failed',
        description: error?.message || 'Failed to submit waiver request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingWaiver(false);
    }
  };

  const handleSendToCustomer = async () => {
    if (isSending) return;

    if (!applicationId || applicationId === 'N/A') {
      toast({
        title: 'Cannot send link',
        description: 'Application ID is missing.',
        variant: 'destructive',
      });
      return;
    }

    const authorization = getAuthorizationHeader();
    if (!authorization) {
      return;
    }

    setIsSending(true);
    setPaymentStatus('Pending');
    setReceivedOn(null);

    try {
      const response = await fetch(`${API_BASE_URL}/payment-create/`, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        body: JSON.stringify({
          application_id: applicationId,
          metadata: 'string',
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to create payment link.');
      }

      const data = await response.json();
      const paymentData = data?.data;

      setPaymentUrl(paymentData?.payment_url ?? null);
      setPaymentOrderId(paymentData?.order_id ?? null);
      setDisplayMobile(derivedMobile);

      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
      sendTimeoutRef.current = setTimeout(() => {
        setHasSentLink(true);
        setIsSending(false);
        toast({
          title: 'Payment Link Sent',
          description: 'The payment link has been sent to the customer.',
        });
      }, 2000);
    } catch (error: any) {
      setIsSending(false);
      toast({
        title: 'Failed to send payment link',
        description: error?.message || 'Something went wrong while creating the payment link.',
        variant: 'destructive',
      });
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    await checkPaymentStatus(true);
    setIsRefreshing(false);
  };

  const checkPaymentStatus = async (showToast = false) => {
    if (!applicationId || applicationId === 'N/A') return;

    const authHeader = getAuthorizationHeader();
    if (!authHeader) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/payment-status/?application_id=${encodeURIComponent(applicationId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        return;
      }

      const result = await response.json();
      const statusData = result?.data;
      const apiState = (statusData?.state || '').toLowerCase();

      let nextStatus: PaymentStatus = 'Pending';
      if (apiState === 'completed') {
        nextStatus = 'Paid';
      } else if (apiState === 'failed' || apiState === 'cancelled') {
        nextStatus = 'Failed';
      } else if (apiState === 'waived') {
        nextStatus = 'Waived';
        setWaiverStatus('approved');
        // Stop auto-refresh if waiver is approved
        if (waiverRefreshIntervalRef.current) {
          clearInterval(waiverRefreshIntervalRef.current);
          waiverRefreshIntervalRef.current = null;
        }
      }

      setPaymentStatus(nextStatus);
      if (statusData?.paid_on && (nextStatus === 'Paid' || nextStatus === 'Waived')) {
        setReceivedOn(new Date(statusData.paid_on));
      }

      if (showToast) {
        toast({
          title: 'Status Refreshed',
          description: `Payment status is now ${nextStatus}.`,
        });
      }
    } catch (error) {
      // Silent fail for auto-refresh
      console.error('Failed to refresh payment status:', error);
      if (showToast) {
        toast({
          title: 'Failed to refresh status',
          description: 'Something went wrong while refreshing payment status.',
          variant: 'destructive',
        });
      }
    }
  };

  const startWaiverAutoRefresh = () => {
    // Clear any existing interval
    if (waiverRefreshIntervalRef.current) {
      clearInterval(waiverRefreshIntervalRef.current);
    }

    // Set up auto-refresh every 2 minutes
    waiverRefreshIntervalRef.current = setInterval(() => {
      checkPaymentStatus(false);
    }, 2 * 60 * 1000); // 2 minutes

    // Also do an immediate check
    checkPaymentStatus(false);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (waiverRefreshIntervalRef.current) {
        clearInterval(waiverRefreshIntervalRef.current);
      }
    };
  }, []);

  const handleResendPaymentLink = async () => {
    if (isResending) return;

    if (!applicationId || applicationId === 'N/A') {
      toast({
        title: 'Cannot resend link',
        description: 'Application ID is missing.',
        variant: 'destructive',
      });
      return;
    }

    const authorization = getAuthorizationHeader();
    if (!authorization) {
      return;
    }

    setIsResending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/payment-resend/`, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        body: JSON.stringify({
          application_id: applicationId,
          actor: 'string',
          reason: 'string',
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to resend payment link.');
      }

      toast({
        title: 'Payment Link Resent',
        description: 'The payment link has been resent to the customer.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to resend payment link',
        description: error?.message || 'Something went wrong while resending the payment link.',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  const resetPaymentState = () => {
    setHasSentLink(false);
    setShowSendLinkCard(false);
    setPaymentStatus('Pending');
    setRemarks('');
    setReceivedOn(null);
    setIsDetailsOpen(false);
    setPaymentUrl(null);
    setPaymentOrderId(null);
    setDisplayMobile(derivedMobile);
    if (storageKey) {
      sessionStorage.removeItem(storageKey);
    }
  };

  const handleDeleteLink = async () => {
    if (isDeleting) return;

    if (!applicationId || applicationId === 'N/A') {
      toast({
        title: 'Cannot delete link',
        description: 'Application ID is missing.',
        variant: 'destructive',
      });
      return;
    }

    const authorization = getAuthorizationHeader();
    if (!authorization) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/payment-delete/`, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        body: JSON.stringify({
          application_id: applicationId,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to delete payment link.');
      }

      resetPaymentState();

      toast({
        title: 'Payment Link Deleted',
        description: 'The payment link has been removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to delete payment link',
        description: error?.message || 'Something went wrong while deleting the payment link.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200 px-4 py-1 text-xs font-semibold">
            Paid
          </Badge>
        );
      case 'Failed':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200 px-4 py-1 text-xs font-semibold">
            Expired
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 px-4 py-1 text-xs font-semibold">
            Pending
          </Badge>
        );
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const displayedPaymentLink = paymentUrl ?? defaultPaymentLink;
  const maskedOrderId = paymentOrderId ? `****${paymentOrderId.slice(-4)}` : 'N/A';
  const isPaymentCompleted = paymentStatus === 'Paid' || paymentStatus === 'Waived';
  const isWaiverPending = waiverStatus === 'pending';

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };

  return (
    <DashboardLayout
      title="Payments"
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">


          <Card className="w-full border-l-4 border-blue-600 shadow-md">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold text-[#003366]">{headerName}</h3>
              <p className="text-sm text-gray-600 mt-1">Lead ID: {applicationId}</p>
            </CardContent>
          </Card>

          {isWaiverPending && (
            <Card className="border border-yellow-200 bg-yellow-50 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center border border-yellow-200">
                  <Wallet className="w-10 h-10 text-yellow-600" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-yellow-800">Application fee waiver request in progress</h3>
                  <p className="text-sm text-yellow-700">
                    Your request (Deviation ID: {waiverDeviationId}) is being processed.
                  </p>
                </div>
                <Button
                  onClick={() => checkPaymentStatus(true)}
                  className="h-12 px-8 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white font-semibold text-base flex items-center gap-2"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                  Check Status
                </Button>
              </CardContent>
            </Card>
          )}

          {!hasSentLink && !isPaymentCompleted && !showSendLinkCard && !isWaiverPending && (
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100">
                  <Wallet className="w-10 h-10 text-[#0072CE]" />
                </div>
                <h3 className="text-xl font-bold text-[#003366]">No payment created yet.</h3>
                <Button
                  onClick={() => setShowSendLinkCard(true)}
                  className="w-full max-w-sm h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] text-white font-semibold text-base"
                >
                  Create Payment Link
                </Button>
              </CardContent>
            </Card>
          )}

          {!hasSentLink && !isPaymentCompleted && showSendLinkCard && !isWaiverPending && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="p-6 space-y-6">
                <p className="text-sm text-gray-600 text-center">
                  Generate a secure link to collect the Login / IMD Fee from the customer.
                </p>

                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-gray-900">Payment Details</h3>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Fee Type</Label>
                    <div className="flex items-center px-4 h-12 bg-[#F3F4F6] border border-gray-300 rounded-lg">
                      <span className="text-[#003366] font-medium">Login / IMD Fee</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Amount</Label>
                    <div className="flex items-center px-4 h-12 bg-[#F3F4F6] border border-gray-300 rounded-lg">
                      <span className="text-[#003366] font-medium">₹ 1,180 (incl. GST)</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Standard Login / IMD Fee including GST.</p>
                  </div>

                </div>

                <Button
                  onClick={handleSendToCustomer}
                  className="w-full h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] text-white font-semibold"
                  disabled={isSending}
                >
                  {isSending ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send to Customer
                    </>
                  )}
                </Button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-gray-300"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">Or</span>
                  <div className="flex-grow border-t border-gray-300"></div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setIsWaveOffModalOpen(true)}
                  className="w-full h-12 rounded-lg border-2 border-[#0072CE] text-[#0072CE] hover:bg-blue-50 font-semibold"
                >
                  Request Wave Off
                </Button>
              </div>
            </div>
          )}
          {paymentStatus === 'Waived' && (
            <Card className="border border-blue-200 bg-blue-50 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center border border-blue-200">
                  <CheckCircle className="w-10 h-10 text-blue-600" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-blue-800">Application Fee Waived</h3>
                  <p className="text-sm text-blue-700">
                    The login/IMD fee has been successfully waived.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {(hasSentLink || isPaymentCompleted) && paymentStatus !== 'Waived' && (
          <Card className="border border-gray-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#003366]">Login / IMD Fee</h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(paymentStatus)}
                  {!isPaymentCompleted && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefreshStatus}
                      className="h-8 w-8 text-gray-500 hover:text-gray-700"
                      disabled={isRefreshing}
                      aria-label="Refresh payment status"
                    >
                      <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Application ID</p>
                  <p className="font-semibold text-[#0072CE]">{applicationId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Order ID</p>
                  <p className="font-medium text-gray-900">{maskedOrderId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Customer Mobile</p>
                  <p className="font-medium text-gray-900">{displayMobile}</p>
                </div>
                <div>
                  <p className="text-gray-500">{paymentStatus === 'Paid' ? 'Paid On' : 'Created On'}</p>
                  <p className="font-medium text-gray-900">
                    {paymentStatus === 'Paid' && receivedOn ? formatDate(receivedOn) : formatDate(createdOn)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Amount</p>
                  <p className="font-semibold text-gray-900">₹ 1,180 (incl. GST)</p>
                </div>
              </div>

              <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                  <h4 className="text-base font-semibold text-[#0072CE]">Payment Details</h4>
                  <ChevronDown
                    className={cn(
                      'w-5 h-5 text-[#0072CE] transition-transform',
                      isDetailsOpen && 'rotate-180'
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Payment Link</p>
                    <p className="text-xs text-blue-600 break-all">{displayedPaymentLink}</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {paymentStatus === 'Paid' && (
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700 font-medium">
                    Payment received successfully.
                  </p>
                </div>
              )}

              <div className="pt-2">
                {paymentStatus === 'Pending' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={handleResendPaymentLink}
                      className="h-11 border-2 border-[#0072CE] text-[#0072CE] hover:bg-blue-50 font-semibold"
                      disabled={isResending}
                    >
                      {isResending ? (
                        <span className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Resending...
                        </span>
                      ) : (
                        'Resend Link'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDeleteLink}
                      className="h-11 border-2 border-red-500 text-red-600 hover:bg-red-50 font-semibold"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <span className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Deleting...
                        </span>
                      ) : (
                        'Delete Link'
                      )}
                    </Button>
                  </div>
                )}

                {paymentStatus === 'Failed' && (
                  <Button
                    onClick={handleDeleteLink}
                    className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Deleting...
                      </span>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Link
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* {isPaymentCompleted && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
            Payment has been completed. This page is now view only.
          </div>
        )} */}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <Button
            onClick={handleExit}
            className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white"
          >
            Back to Hub
          </Button>
        </div>
      </div>

      <Dialog open={isWaveOffModalOpen} onOpenChange={setIsWaveOffModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#003366]">Request Fee Wave Off</DialogTitle>
            <DialogDescription>
              Please provide a reason for requesting the fee wave off.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wave-off-remarks" className="text-sm font-medium text-gray-700">
                Remarks <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="wave-off-remarks"
                value={waveOffRemarks}
                onChange={(e) => setWaveOffRemarks(e.target.value)}
                placeholder="Enter reason for wave off..."
                rows={4}
                className="resize-none"
              />
            </div>
            <Button
              onClick={handleWaveOffSubmit}
              disabled={!waveOffRemarks.trim()}
              className="w-full bg-[#0072CE] hover:bg-[#005a9e]"
            >
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout >
  );
}
