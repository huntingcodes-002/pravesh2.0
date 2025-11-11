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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { RefreshCw, CheckCircle, ChevronDown, Trash2, Send } from 'lucide-react';
import { useLead } from '@/contexts/LeadContext';

type PaymentStatus = 'Pending' | 'Paid' | 'Failed';

const API_BASE_URL = 'https://uatlb.api.saarathifinance.com/api/lead-collection/applications';
const AUTH_TOKEN =
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzYyOTM2OTAzLCJpYXQiOjE3NjI4NTA1MDMsImp0aSI6IjM5OTZiZDhhMDAxNzRiZjJhMTZkZWQ5ODk1MDg4YWViIiwidXNlcl9pZCI6NDF9.9qeKcZF_Mc9tdCbhSDvma3M-jTs7pkHhYWh3GqKeUD8';

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
  const [hasSentLink, setHasSentLink] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pending');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [displayMobile, setDisplayMobile] = useState(derivedMobile);
  const { toast } = useToast();
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createdOn = useMemo(() => new Date(), []);
  const [receivedOn, setReceivedOn] = useState<Date | null>(null);

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

    setIsSending(true);
    setPaymentStatus('Pending');
    setReceivedOn(null);

    try {
      const response = await fetch(`${API_BASE_URL}/payment-create/`, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          Authorization: AUTH_TOKEN,
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
    if (isRefreshing) return;

    if (!applicationId || applicationId === 'N/A') {
      toast({
        title: 'Cannot refresh status',
        description: 'Application ID is missing.',
        variant: 'destructive',
      });
      return;
    }

    setIsRefreshing(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/payment-status/?application_id=${encodeURIComponent(applicationId)}`,
        {
          method: 'GET',
          headers: {
            Accept: '*/*',
            Authorization: AUTH_TOKEN,
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to fetch payment status.');
      }

      const result = await response.json();
      const statusData = result?.data;

      if (statusData?.masked_customer_mobile) {
        setDisplayMobile(statusData.masked_customer_mobile);
      }

      const apiState = (statusData?.state || '').toLowerCase();
      let nextStatus: PaymentStatus = 'Pending';
      if (apiState === 'completed') {
        nextStatus = 'Paid';
      } else if (apiState === 'failed' || apiState === 'cancelled') {
        nextStatus = 'Failed';
      }

      setPaymentStatus(nextStatus);
      if (statusData?.paid_on && nextStatus === 'Paid') {
        setReceivedOn(new Date(statusData.paid_on));
      } else {
        setReceivedOn(null);
      }

      toast({
        title: 'Status Refreshed',
        description: `Payment status is now ${nextStatus}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to refresh status',
        description: error?.message || 'Something went wrong while refreshing payment status.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResendLink = () => {
    toast({
      title: 'Payment Link Resent',
      description: 'The payment link has been resent to the customer.',
    });
  };

  const handleDeleteLink = () => {
    setHasSentLink(false);
    setPaymentStatus('Pending');
    setRemarks('');
    setReceivedOn(null);
    setIsDetailsOpen(false);
    setPaymentUrl(null);
    setPaymentOrderId(null);
    setDisplayMobile(derivedMobile);
    toast({
      title: 'Payment Link Deleted',
      description: 'The payment link has been removed.',
      variant: 'destructive',
    });
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
          <p className="text-sm text-gray-600 text-center">
            Collect the processing (Login/IMD) fee before submitting the application.
          </p>

          <Card className="w-full border-l-4 border-blue-600 shadow-md">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold text-[#003366]">{headerName}</h3>
              <p className="text-sm text-gray-600 mt-1">Lead ID: {applicationId}</p>
            </CardContent>
          </Card>

          {!hasSentLink && (
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

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="remarks" className="text-sm font-medium text-gray-700">
                        Remarks
                      </Label>
                      <span className="text-xs text-gray-500">Optional</span>
                    </div>
                    <Textarea
                      id="remarks"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional note for internal reference."
                      maxLength={100}
                      rows={3}
                      className="rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-right">
                      {remarks.length}
                      /100
                    </p>
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
              </div>
            </div>
          )}
        </div>

        {hasSentLink && (
          <Card className="border border-gray-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#003366]">Login / IMD Fee</h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(paymentStatus)}
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
                  {remarks && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Remarks</p>
                      <p className="text-sm text-gray-700">{remarks}</p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {paymentStatus === 'Paid' && (
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700 font-medium">
                    Payment received successfully. You can now proceed to submit the application.
                  </p>
                </div>
              )}

              <div className="pt-2">
                {paymentStatus === 'Pending' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={handleResendLink}
                      className="h-11 border-2 border-[#0072CE] text-[#0072CE] hover:bg-blue-50 font-semibold"
                    >
                      Resend Link
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDeleteLink}
                      className="h-11 border-2 border-red-500 text-red-600 hover:bg-red-50 font-semibold"
                    >
                      Delete Link
                    </Button>
                  </div>
                )}

                {paymentStatus === 'Failed' && (
                  <Button
                    onClick={handleDeleteLink}
                    className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Link
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
