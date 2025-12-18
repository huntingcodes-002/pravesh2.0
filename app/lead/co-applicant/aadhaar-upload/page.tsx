'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead, CoApplicant } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader, UploadCloud, X, FileText, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { uploadDocument, uploadCoApplicantDocument, isApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function CoApplicantAadhaarUploadContent() {
    const { currentLead, updateCoApplicant } = useLead();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const coApplicantId = searchParams.get('coApplicantId');

    const coApplicant: CoApplicant | undefined = useMemo(() => {
        if (!currentLead || !coApplicantId) return undefined;
        return currentLead.formData?.coApplicants?.find((ca: CoApplicant) => ca.id === coApplicantId);
    }, [currentLead, coApplicantId]);

    const [frontFile, setFrontFile] = useState<File | null>(null);
    const [backFile, setBackFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!currentLead || !coApplicant) {
            router.replace('/lead/co-applicant-info');
        }
    }, [currentLead, coApplicant, router]);

    const handleUpload = async () => {
        if (!frontFile || !backFile || !currentLead?.appId || typeof coApplicant?.workflowIndex !== 'number') return;

        setIsUploading(true);

        try {
            // Use the specific co-applicant upload function
            const response = await uploadCoApplicantDocument({
                application_id: currentLead.appId,
                co_applicant_index: coApplicant.workflowIndex,
                document_type: 'aadhaar_card',
                front_file: frontFile,
                back_file: backFile,
                latitude: '0.0', // TODO: Get actual location if needed
                longitude: '0.0',
            });

            if (isApiError(response)) {
                throw new Error(response.error || 'Failed to upload document');
            }

            // Update local state
            updateCoApplicant(currentLead.id, coApplicantId!, {
                relationship: coApplicant.relationship,
                data: {
                    ...coApplicant.data,
                    step3: {
                        ...coApplicant.data?.step3,
                        autoFilledViaAadhaar: true // Mark as auto-filled/verified
                    }
                }
            });

            toast({
                title: 'Upload Successful',
                description: 'Aadhaar card uploaded and processed successfully.',
                className: 'bg-green-50 border-green-200',
            });

            // Redirect back to the info page
            router.push('/lead/co-applicant-info');

        } catch (error: any) {
            toast({
                title: 'Upload Failed',
                description: error.message || 'Something went wrong. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
    };

    if (!currentLead || !coApplicant) return null;

    return (
        <DashboardLayout
            title="Upload Aadhaar"
            showNotifications={false}
            showExitButton
            onExit={() => router.push('/lead/co-applicant-info')}
        >
            <div className="max-w-2xl mx-auto p-4">
                <Card className="border-0 shadow-none bg-transparent">
                    <CardContent className="p-0 space-y-6">
                        {/* Upload Card */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900">Upload Aadhaar</h2>
                                </div>
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Required</Badge>
                            </div>

                            {/* Info Alert */}
                            <div className="bg-blue-50 rounded-lg p-3 flex gap-3 mb-6">
                                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-800 leading-relaxed">
                                    Please upload Aadhaar card for {coApplicant.data?.basicDetails?.fullName || 'Co-Applicant'} to auto-fill address details and verify identity.
                                </p>
                            </div>

                            <div className="space-y-6">
                                <h3 className="font-semibold text-gray-900">Aadhaar - {coApplicant.data?.basicDetails?.fullName || 'Co-Applicant'}</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Front Side */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-600 block">Front Side</label>
                                        <div
                                            onClick={() => document.getElementById('aadhaar-front-input')?.click()}
                                            className={cn(
                                                "aspect-[4/3] rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden",
                                                frontFile ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-blue-500 hover:bg-gray-50"
                                            )}
                                        >
                                            <input
                                                id="aadhaar-front-input"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) setFrontFile(e.target.files[0]);
                                                }}
                                            />
                                            {frontFile ? (
                                                <div className="w-full h-full relative">
                                                    <img
                                                        src={URL.createObjectURL(frontFile)}
                                                        alt="Front Preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                        <CheckCircle className="w-8 h-8 text-white" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                                                    <span className="text-xs text-gray-500 font-medium">Upload Front</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Back Side */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-600 block">Back Side</label>
                                        <div
                                            onClick={() => document.getElementById('aadhaar-back-input')?.click()}
                                            className={cn(
                                                "aspect-[4/3] rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden",
                                                backFile ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-blue-500 hover:bg-gray-50"
                                            )}
                                        >
                                            <input
                                                id="aadhaar-back-input"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) setBackFile(e.target.files[0]);
                                                }}
                                            />
                                            {backFile ? (
                                                <div className="w-full h-full relative">
                                                    <img
                                                        src={URL.createObjectURL(backFile)}
                                                        alt="Back Preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                        <CheckCircle className="w-8 h-8 text-white" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                                                    <span className="text-xs text-gray-500 font-medium">Upload Back</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-xl text-sm"
                                    disabled={!frontFile || !backFile || isUploading}
                                    onClick={handleUpload}
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        'Upload Aadhaar'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

export default function CoApplicantAadhaarUploadPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
            <CoApplicantAadhaarUploadContent />
        </Suspense>
    );
}
