'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getDetailedInfo, isApiError, type ApiSuccess, triggerBre, type BreQuestion } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function RiskEligibilityPage() {
    const router = useRouter();
    const { currentLead } = useLead();
    const [detailedInfo, setDetailedInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [questions, setQuestions] = useState<BreQuestion[]>([]);
    const [isBreLoading, setIsBreLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            if (currentLead?.appId) {
                try {
                    const response = await getDetailedInfo(currentLead.appId);
                    if (!isApiError(response)) {
                        const data = (response as ApiSuccess<any>).data ?? response;
                        setDetailedInfo(data?.application_details ?? data);
                    }
                } catch (error) {
                    console.error('Failed to fetch details', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        const fetchBreQuestions = async () => {
            if (currentLead?.appId) {
                try {
                    const response = await triggerBre(currentLead.appId);
                    if (!isApiError(response) && response.success) {
                        setQuestions(response.saved_questions || []);
                    }
                } catch (error) {
                    console.error('Failed to fetch BRE questions', error);
                } finally {
                    setIsBreLoading(false);
                }
            } else {
                setIsBreLoading(false);
            }
        };

        fetchDetails();
        fetchBreQuestions();
    }, [currentLead]);

    const handleBack = () => {
        router.back();
    };

    // Extract Data for Header
    const primaryParticipant = detailedInfo?.participants?.find((p: any) => p.participant_type === 'primary_participant');
    const creditReport = primaryParticipant?.bureau_result?.data?.credit_report;

    const customerName = primaryParticipant?.personal_info?.full_name?.value
        || (currentLead?.customerFirstName ? `${currentLead.customerFirstName} ${currentLead.customerLastName || ''}` : '')
        || 'Raj Kumar Sharma';

    const loanAmount = detailedInfo?.loan_details?.loan_amount_requested
        || 'Fill Loan Requirements';

    const employmentType = primaryParticipant?.employment_details?.occupation_type
        || 'Fill employment Details';

    const monthlyIncome = primaryParticipant?.employment_details?.monthly_income
        || 'Fill employment Details';

    // Credit Assessment Data
    const creditScore = creditReport?.credit_score ?? '0';
    const totalExposure = creditReport?.total_liabilities ?? '0';
    const totalAccounts = creditReport?.total_accounts ?? '0';
    const activeLoans = creditReport?.total_credit_lines ?? '0';
    const dpdStatus = creditReport?.worst_dpd_3y ?? '0';

    const showUploadPan = !primaryParticipant?.bureau_result;

    // Format currency
    const formatCurrency = (value: string | number) => {
        if (!value) return '₹0';
        if (typeof value === 'string' && value.startsWith('Fill')) return value;
        const num = Number(String(value).replace(/[^0-9.]/g, ''));
        return isNaN(num) ? String(value) : '₹' + num.toLocaleString('en-IN');
    };

    return (
        <DashboardLayout
            title="Risk & Eligibility"
            showNotifications={true}
            showExitButton={true}
            onExit={handleBack}
        >
            <div className="max-w-3xl mx-auto p-4 space-y-6 pb-20">
                {/* Header Info Card */}
                <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Customer:</p>
                                <p className="text-sm font-bold text-blue-900">{customerName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Loan Amount:</p>
                                <p className="text-sm font-bold text-blue-900">{formatCurrency(loanAmount)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Employment:</p>
                                <p className="text-sm font-bold text-blue-900 capitalize">{employmentType}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Monthly Income:</p>
                                <p className="text-sm font-bold text-blue-900">{formatCurrency(monthlyIncome)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Business Rule Engine Result */}
                <Card className="border border-orange-200 overflow-hidden">
                    <div className="bg-orange-50 p-4 border-b border-orange-100">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-blue-900">Business Rule Engine Result</h3>
                                <Badge className="mt-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">
                                    ⚠️ Conditional Approval
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-6 space-y-6">
                        <p className="text-sm text-gray-600">
                            The application requires additional clarification before approval. Please answer the following questions:
                        </p>

                        {isBreLoading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            </div>
                        ) : questions.length > 0 ? (
                            <div className="space-y-4">
                                {questions.map((q) => (
                                    <div key={q.id} className="p-4 border border-gray-200 rounded-xl bg-white">
                                        <label className="block text-sm font-bold text-blue-900 mb-3">
                                            {q.question_text} *
                                        </label>
                                        <Textarea
                                            placeholder="Please provide a detailed explanation..."
                                            className="min-h-[100px] resize-none bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No additional questions at this time.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Credit Assessment */}
                <Card className="border border-gray-200">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                <CardTitle className="text-base font-bold text-blue-900">Credit Assessment</CardTitle>
                            </div>
                            {showUploadPan && (
                                <Button size="sm" variant="outline" onClick={() => router.push('/lead/documents')}>
                                    Upload Pan
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-blue-50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-blue-600">{creditScore}</p>
                                <p className="text-xs text-gray-500 font-medium mt-1">Credit Score</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalExposure)}</p>
                                <p className="text-xs text-gray-500 font-medium mt-1">Total Exposure</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                <span className="text-sm text-gray-600">Total Accounts:</span>
                                <span className="text-sm font-bold text-blue-900">{totalAccounts}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                <span className="text-sm text-gray-600">Active Loans:</span>
                                <span className="text-sm font-bold text-blue-900">{activeLoans}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                <span className="text-sm text-gray-600">DPD Status:</span>
                                <span className="text-sm font-bold text-orange-600">{dpdStatus === '0' || !dpdStatus ? '0' : `${dpdStatus} DPD in last 6 months`}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex gap-4 pt-4">
                    <Button variant="outline" className="flex-1 h-12 border-gray-300" onClick={handleBack}>
                        Cancel
                    </Button>
                    <Button className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white">
                        Submit Clarifications
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    );
}
