'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, Trash2, CheckCircle, ChevronDown } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressBar from '@/components/ProgressBar';
import { useLead, PaymentSession } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';

import CreatePaymentLink from '@/components/lead/CreatePaymentLink';

type PaymentView = 'main' | 'create';

export default function Step11PaymentPage() {
  const { currentLead, updateLead, addPaymentToLead, updatePaymentInLead, deletePaymentFromLead, submitLead } = useLead();
  const router = useRouter();
  const { toast } = useToast();

  const [view, setView] = useState<PaymentView>('main');
  const [prefillData, setPrefillData] = useState<{ feeType: 'Login / IMD Fee' | 'Other Fee', amount: number, remarks: string } | null>(null);
  const [openPaymentDetails, setOpenPaymentDetails] = useState<{ [key: string]: boolean }>({});

  const payments = currentLead?.payments || [];
  const hasSuccessfulPayment = payments.some(p => p.status === 'Paid');

  useEffect(() => {
    if (!currentLead) {
      router.replace('/leads');
    }
  }, [currentLead, router]);



  const handleCreateNewLink = () => {
    setPrefillData(null); // Clear any prefill data
    setView('create');
  }

  const handleLinkCreate = (feeType: 'Login / IMD Fee' | 'Other Fee', amount: number, remarks: string) => {
    if (!currentLead) return;

    const now = new Date().toISOString();
    const newPayment: PaymentSession = {
      id: `PAY-${Date.now()}`,
      feeType,
      amount,
      remarks,
      status: 'Pending',
      link: `https://pay.saarathi.com/${feeType === 'Login / IMD Fee' ? 'login-fee' : 'other-fee'}/${currentLead.appId}`,
      createdAt: now,
      updatedAt: now,
      timeline: {
        created: now,
        sent: now,
      }
    };

    addPaymentToLead(currentLead.id, newPayment);
    setView('main');
    toast({ title: 'Payment Link Sent!', description: `A new payment link has been sent to the customer.` });
  };

  const handleRefreshStatus = (paymentId: string) => {
    if (!currentLead) return;

    const paymentToUpdate = currentLead.payments.find(p => p.id === paymentId);
    if (!paymentToUpdate) {
      toast({ title: 'Error', description: 'Could not find payment to refresh.', variant: 'destructive' });
      return;
    }

    let newStatus: 'Paid' | 'Failed' = Math.random() > 0.3 ? 'Paid' : 'Failed';
    if (paymentToUpdate.status === 'Paid') newStatus = 'Paid';
    if (paymentToUpdate.status === 'Failed') newStatus = 'Failed';

    const updatedPayment: Partial<PaymentSession> = {
      status: newStatus,
      timeline: {
        ...paymentToUpdate.timeline,
        received: new Date().toISOString()
      }
    };

    updatePaymentInLead(currentLead.id, paymentId, updatedPayment);

    toast({ title: 'Status Refreshed', description: `Payment status is now ${newStatus}.` });
  };

  const handleResendLink = (paymentId: string) => {
    if (!currentLead) return;
    const paymentToUpdate = currentLead.payments.find(p => p.id === paymentId);
    if (!paymentToUpdate) return;

    updatePaymentInLead(currentLead.id, paymentId, {
      timeline: { ...paymentToUpdate.timeline, sent: new Date().toISOString() }
    });
    toast({ title: 'Link Resent', description: 'Payment link has been resent to the customer.' });
  };

  const handleDelete = (paymentId: string) => {
    if (!currentLead) return;
    deletePaymentFromLead(currentLead.id, paymentId);
    toast({ title: 'Payment Link Deleted', description: 'Payment link has been removed.', variant: 'destructive' });
  };

  const togglePaymentDetails = (paymentId: string) => {
    setOpenPaymentDetails(prev => ({
      ...prev,
      [paymentId]: !prev[paymentId]
    }));
  };

  const handleExit = () => {
    if (view === 'create') {
      setView('main');
    } else {
      router.push('/leads');
    }
  };

  const handleSubmit = () => {
    if (!currentLead) return;
    // Submit the application and set status to "Submitted"
    submitLead(currentLead.id);
    toast({
      title: 'Application Submitted',
      description: `Lead ${currentLead.appId} has been successfully submitted for review.`,
      className: 'bg-green-50 border-green-200',
    });
    router.push('/leads');
  };

  const handlePrevious = () => {
    router.push('/lead/step10');
  };

  const formatLoanAmount = (amount?: number) => {
    if (!amount) return 'N/A';
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN')}`;

  if (!currentLead) {
    return null;
  }

  const getTitle = () => {
    if (view === 'create') return 'Create Payment Link';
    return 'Payments';
  }
  
  const getStatusBadge = (status: 'Pending' | 'Paid' | 'Failed') => {
    switch(status) {
      case 'Paid':
        return <Badge className="bg-green-100 text-green-700 border-green-200 px-4 py-1">Paid</Badge>;
      case 'Failed':
        return <Badge className="bg-red-100 text-red-700 border-red-200 px-4 py-1">Expired</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 px-4 py-1">Pending</Badge>;
    }
  };

  return (
    <DashboardLayout
      title={getTitle()}
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24">
                <ProgressBar currentStep={10} totalSteps={10} />

        {view === 'main' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
              {/* Instruction Text */}
              <p className="text-sm text-gray-600 text-center">
                Collect the processing (Login/IMD) fee before submitting the application.
              </p>

              {/* Applicant Information Card */}
              <Card className="border-l-4 border-blue-600 shadow-md">
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold text-[#003366]">{currentLead.customerName || 'N/A'}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Lead ID: {currentLead.appId} &bull; {formatLoanAmount(currentLead.loanAmount)}
                  </p>
                </CardContent>
              </Card>

              {payments.length === 0 ? (
                /* No Payment Created Yet */
                <div className="flex flex-col items-center justify-center py-12">
                  {/* Icon */}
                  <div className="w-20 h-20 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  
                  {/* Text */}
                  <p className="text-gray-700 font-medium mb-8">No payment created yet.</p>
                  
                  {/* Create Payment Link Button */}
                  <Button 
                    onClick={handleCreateNewLink} 
                    className="w-full h-12 bg-[#0072CE] hover:bg-[#005a9e] text-white font-semibold rounded-lg"
                  >
                    Create Payment Link
                  </Button>
                </div>
              ) : (
                /* Payment Details Card */
                <div className="space-y-4">
                  {payments.map(p => (
                    <Card key={p.id} className="border-gray-200">
                      <CardContent className="p-6 space-y-4">
                        {/* Header with Fee Type and Status */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-[#003366]">{p.feeType}</h3>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(p.status)}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRefreshStatus(p.id)}
                              className="h-8 w-8 text-gray-500 hover:text-gray-700"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Payment Information Grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Application ID</p>
                            <p className="font-semibold text-[#0072CE]">{currentLead.appId}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Customer Mobile</p>
                            <p className="font-medium text-gray-900">+91 {currentLead.customerMobile}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">{p.status === 'Paid' ? 'Paid On' : 'Created On'}</p>
                            <p className="font-medium text-gray-900">
                              {p.status === 'Paid' && p.timeline.received 
                                ? format(new Date(p.timeline.received), 'dd MMM yyyy, h:mm a')
                                : format(new Date(p.createdAt), 'dd MMM yyyy, h:mm a')
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Amount</p>
                            <p className="font-semibold text-gray-900">{formatCurrency(p.amount)} (incl. GST)</p>
                          </div>
                        </div>

                        {/* Collapsible Payment Details */}
                        <Collapsible open={openPaymentDetails[p.id]} onOpenChange={() => togglePaymentDetails(p.id)}>
                          <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                            <h4 className="text-base font-semibold text-[#0072CE]">Payment Details</h4>
                            <ChevronDown className={cn("w-5 h-5 text-[#0072CE] transition-transform", openPaymentDetails[p.id] && "rotate-180")} />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-4 space-y-4">
                            {/* Payment Link */}
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Payment Link</p>
                              <p className="text-xs text-blue-600 break-all">{p.link}</p>
                            </div>
                            
                            {/* Remarks if any */}
                            {p.remarks && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Remarks</p>
                                <p className="text-sm text-gray-700">{p.remarks}</p>
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Success Message for Paid Status */}
                        {p.status === 'Paid' && (
                          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-green-700 font-medium">
                              Payment received successfully. You can now proceed to submit the application.
                            </p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-2">
                          {p.status === 'Pending' && (
                            <div className="grid grid-cols-2 gap-3">
                              <Button 
                                variant="outline" 
                                onClick={() => handleResendLink(p.id)}
                                className="h-11 border-2 border-[#0072CE] text-[#0072CE] hover:bg-blue-50 font-semibold"
                              >
                                Resend Link
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => handleDelete(p.id)}
                                className="h-11 border-2 border-red-500 text-red-600 hover:bg-red-50 font-semibold"
                              >
                                Delete Link
                              </Button>
                            </div>
                          )}
                          
                          {(p.status === 'Failed') && (
                            <Button 
                              onClick={() => handleDelete(p.id)}
                              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold"
                            >
                              Delete Link
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
              <div className="flex gap-3 max-w-2xl mx-auto">
                <Button onClick={handlePrevious} variant="outline" className="flex-1 h-12 rounded-lg">
                  Previous
                </Button>
                {payments.length > 0 && (
                  <Button 
                    onClick={handleSubmit} 
                    disabled={!hasSuccessfulPayment}
                    className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Application
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {view === 'create' && <CreatePaymentLink onLinkCreate={handleLinkCreate} prefillData={prefillData} />}

      </div>
    </DashboardLayout>
  );
}