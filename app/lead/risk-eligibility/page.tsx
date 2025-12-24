'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { getDetailedInfo, isApiError, type ApiSuccess, getBreQuestions, triggerBre, submitBreAnswers, type BreQuestion, type BreDbUpdateResponse } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function RiskEligibilityPage() {
    const router = useRouter();
    const { currentLead } = useLead();
    const { toast } = useToast();
    const [detailedInfo, setDetailedInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [questions, setQuestions] = useState<BreQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [isBreLoading, setIsBreLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            if (currentLead?.appId) {
                try {
                    const response = await getDetailedInfo(currentLead.appId);
                    if (!isApiError(response)) {
                        // Handle both response structures: response.data.application_details or response.application_details
                        const successResponse = response as ApiSuccess<any>;
                        const applicationDetails = successResponse.data?.application_details || successResponse.application_details || (response as any).application_details;
                        // Set the application_details (which contains participants and loan_details)
                        setDetailedInfo(applicationDetails || successResponse.data || response);
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
                    // Step 1: Try to fetch existing questions from db-update
                    let response = await getBreQuestions(currentLead.appId);
                    
                    if (!isApiError(response) && response.success) {
                        // Extract questions from response - data is at top level or in response.data
                        const responseData = (response as any).data || response;
                        const questionsData = Array.isArray(responseData) ? responseData : (responseData.data || []);
                        
                        // If no questions exist, trigger BRE to create questions
                        if (questionsData.length === 0) {
                            // Step 2: Trigger BRE to create questions
                            const triggerResponse = await triggerBre(currentLead.appId);
                            
                            if (!isApiError(triggerResponse) && triggerResponse.success) {
                                // Step 3: Fetch questions again after triggering
                                response = await getBreQuestions(currentLead.appId);
                                
                                if (!isApiError(response) && response.success) {
                                    const refreshData = (response as any).data || response;
                                    const refreshQuestions = Array.isArray(refreshData) ? refreshData : (refreshData.data || []);
                                    setQuestions(refreshQuestions);
                                } else {
                                    setQuestions([]);
                                }
                            } else {
                                setQuestions([]);
                            }
                        } else {
                            // Questions exist, use them
                            setQuestions(questionsData);
                            // Pre-fill answers if questions are already answered
                            const answeredAnswers: Record<number, string> = {};
                            questionsData.forEach((q: BreQuestion) => {
                                if (q.status === 'answered' && q.answer_text) {
                                    answeredAnswers[q.id] = q.answer_text;
                                }
                            });
                            if (Object.keys(answeredAnswers).length > 0) {
                                setAnswers(answeredAnswers);
                            }
                        }
                    } else {
                        setQuestions([]);
                    }
                } catch (error) {
                    console.error('Failed to fetch BRE questions', error);
                    setQuestions([]);
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

    const handleAnswerChange = (questionId: number, answer: string) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: answer
        }));
    };

    const handleSubmit = async () => {
        if (!currentLead?.appId) {
            toast({
                title: 'Error',
                description: 'Application ID not found',
                variant: 'destructive',
            });
            return;
        }

        // Check if all questions are already answered
        const allAnswered = questions.length > 0 && questions.every(q => q.status === 'answered');
        if (allAnswered) {
            // All questions already answered, just redirect
            router.push('/lead/new-lead-info');
            return;
        }

        // Validate all questions are answered
        const unansweredQuestions = questions.filter(q => {
            // Check if question is not already answered and user hasn't provided an answer
            return q.status !== 'answered' && (!answers[q.id] || answers[q.id].trim() === '');
        });
        if (unansweredQuestions.length > 0) {
            toast({
                title: 'Validation Error',
                description: 'Please answer all questions before submitting',
                variant: 'destructive',
            });
            return;
        }

        // Only submit answers for questions that are not already answered
        const pendingQuestions = questions.filter(q => q.status !== 'answered');
        if (pendingQuestions.length === 0) {
            // All answered, just redirect
            router.push('/lead/new-lead-info');
            return;
        }

        setIsSubmitting(true);
        try {
            // Prepare answers array for pending questions only
            const answersArray = pendingQuestions.map(q => ({
                question_id: q.id,
                answer_text: answers[q.id] || '',
            }));

            const response = await submitBreAnswers(currentLead.appId, answersArray);

            if (!isApiError(response) && response.success) {
                toast({
                    title: 'Success',
                    description: 'Answers submitted successfully',
                    className: 'bg-green-50 border-green-200',
                });
                // Redirect to new-lead-info page after successful submission
                router.push('/lead/new-lead-info');
            } else {
                toast({
                    title: 'Error',
                    description: response.error || 'Failed to submit answers',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Failed to submit BRE answers', error);
            toast({
                title: 'Error',
                description: 'An error occurred while submitting answers',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Extract Data for Header from detailed-info API
    // The response structure is: { success: true, application_details: { participants: [...], loan_details: {...} } }
    // detailedInfo is set to application_details, so participants are directly in detailedInfo
    const participants = detailedInfo?.participants || [];
    
    // Find primary participant (participant_type: "primary_participant")
    const primaryParticipant = participants.find((p: any) => 
        p.participant_type === 'primary_participant'
    ) || participants.find((p: any) => 
        p.participant_type === 'applicant'
    ) || participants[0];
    
    const creditReport = primaryParticipant?.bureau_result?.data?.credit_report;

    // Customer Name from detailed-info API
    const customerName = primaryParticipant?.personal_info?.full_name?.value
        || (typeof primaryParticipant?.personal_info?.full_name === 'string' 
            ? primaryParticipant.personal_info.full_name 
            : null)
        || (currentLead?.customerFirstName ? `${currentLead.customerFirstName} ${currentLead.customerLastName || ''}` : '')
        || 'N/A';

    // Loan Amount from detailed-info API
    const loanAmount = detailedInfo?.loan_details?.loan_amount_requested
        || 'N/A';

    // Occupation Type from detailed-info API
    // Path: application_details.participants[0].employment_details.occupation_type
    const occupationType = primaryParticipant?.employment_details?.occupation_type
        || 'N/A';

    // Monthly Income from detailed-info API
    // Path: application_details.participants[0].employment_details.monthly_income
    const monthlyIncome = primaryParticipant?.employment_details?.monthly_income
        || 'N/A';

    // Credit Assessment Data
    const creditScore = creditReport?.credit_score ?? '0';
    const totalExposure = creditReport?.total_liabilities ?? '0';
    const totalAccounts = creditReport?.total_accounts ?? '0';
    const activeLoans = creditReport?.total_credit_lines ?? '0';
    const dpdStatus = creditReport?.worst_dpd_3y ?? '0';

    const showUploadPan = !primaryParticipant?.bureau_result;

    // Format currency
    const formatCurrency = (value: string | number) => {
        if (!value || value === 'N/A') return 'N/A';
        if (typeof value === 'string' && (value.startsWith('Fill') || value === 'N/A')) return value;
        const num = Number(String(value).replace(/[^0-9.]/g, ''));
        return isNaN(num) || num === 0 ? 'N/A' : '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    return (
        <DashboardLayout
            title="Risk & Eligibility"
            showNotifications={false}
            showExitButton={true}
            onExit={handleBack}
        >
            <div className="max-w-3xl mx-auto p-4 space-y-6 pb-24">
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
                                <p className="text-xs text-gray-500 mb-1">Occupation Type:</p>
                                <p className="text-sm font-bold text-blue-900 capitalize">{occupationType}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Monthly Income:</p>
                                <p className="text-sm font-bold text-blue-900">{formatCurrency(monthlyIncome)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Business Rule Engine Result */}
                <Card className={cn(
                    "border overflow-hidden border-l-4",
                    questions.length > 0 && questions.every(q => q.status === 'answered') 
                        ? "border-l-green-600 border-orange-200" 
                        : "border-l-blue-600 border-orange-200"
                )}>
                    <div className="bg-orange-50 p-4 border-b border-orange-100">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-blue-900">Business Rule Engine Result</h3>
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
                                            value={answers[q.id] || q.answer_text || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                            placeholder="Please provide a detailed explanation..."
                                            className="min-h-[100px] resize-none bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                                            disabled={q.status === 'answered' || q.status === 'completed' || q.status !== 'pending'}
                                        />
                                        {q.status === 'answered' || q.status === 'completed' || (q.answer_text && q.answer_text.trim() !== '') ? (
                                            <p className="text-xs text-green-600 mt-2">✓ Answer submitted</p>
                                        ) : null}
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

                <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
                    <div className="flex gap-3 max-w-3xl mx-auto">
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || questions.length === 0}
                            className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </span>
                            ) : (
                                'Save Information'
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
