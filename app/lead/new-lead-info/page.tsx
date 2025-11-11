'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Play, Edit, CheckCircle, AlertCircle, X, UserCheck, MapPin, Home, IndianRupee, FileText, Eye, Image as ImageIcon, Users } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type SectionStatus = 'incomplete' | 'in-progress' | 'completed';

interface SectionInfo {
  id: string;
  title: string;
  route: string;
  status: SectionStatus;
}

export default function NewLeadInfoPage() {
  const { currentLead, updateLead, submitLead } = useLead();
  const router = useRouter();
  const { toast } = useToast();
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Redirect if no current lead
  useEffect(() => {
    if (!currentLead) {
      router.replace('/leads');
    }
  }, [currentLead, router]);

  // Calculate Step 2 status (Basic Details) - based on completion flag
  const getStep2Status = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    
    if (currentLead.step2Completed === true) return 'completed';
    
    const step2 = currentLead.formData?.step2;
    if (!step2) return 'incomplete';

    const gender = currentLead.gender || step2.gender;
    const dob = currentLead.dob || step2.dob;
    const maritalStatus = step2.maritalStatus;

    const hasAnyData = Boolean(
      (step2.hasPan === 'yes' && (step2.pan || currentLead.panNumber)) ||
      (step2.hasPan === 'no' && (step2.alternateIdType || step2.documentNumber || step2.panUnavailabilityReason)) ||
      gender || dob || maritalStatus
    );

    const hasAllData = step2.hasPan === 'yes'
      ? Boolean(
          (currentLead.panNumber && currentLead.panNumber.length === 10) ||
          (step2.pan && step2.pan.length === 10)
        ) && Boolean(gender && dob)
      : Boolean(
          dob &&
          gender &&
          maritalStatus &&
          step2.alternateIdType &&
          step2.documentNumber &&
          step2.panUnavailabilityReason
        );
    
    if (hasAllData || hasAnyData) return 'in-progress';
    return 'incomplete';
  };

  // Calculate Step 3 status (Address Details) - based on completion flag
  const getStep3Status = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    
    // Check completion flag first (from successful API submission)
    if (currentLead.step3Completed === true) return 'completed';
    
    const step3 = currentLead.formData?.step3;
    const addresses = step3?.addresses || [];
    const hasAnyData = addresses.length > 0 && addresses.some((addr: any) =>
      addr.addressType ||
      addr.addressLine1 ||
      addr.addressLine2 ||
      addr.landmark ||
      addr.postalCode
    );
    const hasRequiredData = addresses.length > 0 && addresses.every((addr: any) =>
      addr.addressType &&
      addr.addressLine1 &&
      addr.landmark &&
      addr.postalCode &&
      addr.postalCode.length === 6
    );
    
    if (hasRequiredData || hasAnyData) return 'in-progress';
    return 'incomplete';
  };

  // Calculate Applicant Details overall status
  // Both sections must be completed (via API) for this to be marked as completed
  const getApplicantDetailsStatus = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    
    // Check completion flags - both must be true
    if (currentLead.step2Completed === true && currentLead.step3Completed === true) {
      return 'completed';
    }
    
    // Check if either section has been submitted
    const step2Status = getStep2Status();
    const step3Status = getStep3Status();
    
    if (step2Status === 'incomplete' && step3Status === 'incomplete') return 'incomplete';
    return 'in-progress';
  };

  const getCoApplicantStatus = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    const coApplicants = currentLead.formData?.coApplicants || [];
    if (!coApplicants.length) return 'completed';
    const allComplete = coApplicants.every((coApp: any) => coApp.isComplete);
    return allComplete ? 'completed' : 'in-progress';
  };

  const getCollateralStatus = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    
    const step6 = currentLead.formData?.step6;
    if (!step6) return 'incomplete';
    
    const hasRequiredFields = step6.collateralType && 
      (step6.collateralType !== 'property' || step6.collateralSubType) &&
      step6.ownershipType && 
      step6.propertyValue;
    
    if (hasRequiredFields) return 'completed';
    if (step6.collateralType || step6.ownershipType || step6.propertyValue) return 'in-progress';
    return 'incomplete';
  };

  const getLoanRequirementStatus = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    
    const step7 = currentLead.formData?.step7;
    if (!step7) return 'incomplete';
    
    const hasRequiredFields = step7.loanAmount > 0 && 
      step7.loanPurpose && 
      step7.sourcingChannel && 
      step7.interestRate && 
      step7.tenure;
    
    if (hasRequiredFields) return 'completed';
    if (step7.loanAmount > 0 || step7.loanPurpose || step7.sourcingChannel || step7.interestRate || step7.tenure) return 'in-progress';
    return 'incomplete';
  };

  // Get uploaded documents
  const uploadedDocuments = useMemo(() => {
    if (!currentLead?.formData?.step8?.files) return [];
    return currentLead.formData.step8.files.filter((f: any) => f.status === 'Success');
  }, [currentLead]);

  const completedCount = [
    getApplicantDetailsStatus(),
    getCoApplicantStatus(),
    getCollateralStatus(),
    getLoanRequirementStatus()
  ].filter(s => s === 'completed').length;
  const totalModules = 4;

  // Helper function to generate required document list
  const mapAlternateIdTypeToDocumentValue = (alternateIdType: string): string => {
    const mapping: Record<string, string> = {
      'Passport': 'Passport',
      'Voter ID': 'VoterID',
      'Driving License': 'DrivingLicense',
    };
    return mapping[alternateIdType] || alternateIdType;
  };

  const generateRequiredDocumentList = (lead: any): string[] => {
    const requiredDocs: string[] = [];
    const step2 = lead?.formData?.step2 || {};

    if (step2.hasPan !== 'no') {
      requiredDocs.push('PAN');
    } else if (step2.alternateIdType) {
      requiredDocs.push(mapAlternateIdTypeToDocumentValue(step2.alternateIdType));
    }

    requiredDocs.push('Adhaar');

    const coApplicants = lead?.formData?.coApplicants || [];
    coApplicants.forEach((coApp: any) => {
      const coApplicantId = coApp?.id;
      if (!coApplicantId) return;

      const coAppStep2 = coApp?.data?.step2 || {};
      if (coAppStep2.hasPan !== 'no') {
        requiredDocs.push(`PAN_${coApplicantId}`);
      } else if (coAppStep2.alternateIdType) {
        requiredDocs.push(`${mapAlternateIdTypeToDocumentValue(coAppStep2.alternateIdType)}_${coApplicantId}`);
      }

      requiredDocs.push(`Adhaar_${coApplicantId}`);
    });

    requiredDocs.push('CollateralPapers');

    return requiredDocs;
  };

  // Check if all required documents are uploaded
  const areAllDocumentsUploaded = useMemo(() => {
    if (!currentLead) return false;
    
    const uploadedFiles = currentLead.formData?.step8?.files || [];
    if (!uploadedFiles || uploadedFiles.length === 0) return false;
    
    const successFiles = uploadedFiles.filter((f: any) => f.status === 'Success');
    const uploadedDocTypes = new Set(successFiles.map((f: any) => f.type));
    
    const requiredDocs = generateRequiredDocumentList(currentLead);
    const allUploaded = requiredDocs.every(docType => uploadedDocTypes.has(docType));
    
    return allUploaded;
  }, [currentLead]);

  const handleSectionClick = (route: string) => {
    router.push(route);
  };

  const handleUploadDocuments = () => {
    router.push('/lead/documents');
  };

  const handleGeneratePaymentLink = () => {
    router.push('/payments');
  };

  const handleSubmit = () => {
    if (!currentLead) return;
    
    const allCompleted = completedCount === totalModules;
    
    if (!allCompleted) {
      toast({
        title: 'Cannot Submit',
        description: 'Please complete all sections before submitting.',
        variant: 'destructive'
      });
      return;
    }
    
    if (!areAllDocumentsUploaded) {
      toast({
        title: 'Cannot Submit',
        description: 'Please upload all required documents before submitting.',
        variant: 'destructive'
      });
      return;
    }
    
    submitLead(currentLead.id);
    toast({
      title: 'Application Submitted',
      description: 'Your application has been submitted successfully.',
      className: 'bg-green-50 border-green-200'
    });
    
    router.push('/leads');
  };

  const handleExit = () => {
    router.push('/leads');
  };

  const getStatusBadge = (status: SectionStatus) => {
    const baseClasses = "rounded-full border text-[11px] font-medium px-3 py-1";
    switch (status) {
      case 'completed':
        return <Badge className={cn(baseClasses, "bg-green-50 border-green-200 text-green-700")}>Completed</Badge>;
      case 'in-progress':
        return <Badge className={cn(baseClasses, "bg-yellow-50 border-yellow-200 text-yellow-700")}>In Progress</Badge>;
      default:
        return <Badge className={cn(baseClasses, "bg-gray-50 border-gray-200 text-gray-600")}>No Data</Badge>;
    }
  };

  const handlePreview = (file: any) => {
    setPreviewFile(file);
    setShowPreview(true);
  };

  // Calculate overall application status
  const getApplicationStatus = (): { status: 'Yet to begin' | 'In Progress' | 'Completed'; label: string } => {
    if (completedCount === 0 && !areAllDocumentsUploaded) {
      return { status: 'Yet to begin', label: 'Yet to begin' };
    }
    if (completedCount === totalModules && areAllDocumentsUploaded) {
      return { status: 'Completed', label: 'Completed' };
    }
    return { status: 'In Progress', label: 'In Progress' };
  };

  const applicationStatus = getApplicationStatus();

  if (!currentLead) {
    return null;
  }

  const step2Status = getStep2Status();
  const step3Status = getStep3Status();
  const applicantStatus = getApplicantDetailsStatus();
  const collateralStatus = getCollateralStatus();
  const loanStatus = getLoanRequirementStatus();
  const coApplicantStatus = getCoApplicantStatus();
  const coApplicants = currentLead?.formData?.coApplicants || [];
  const coApplicantCount = coApplicants.length;
  const hasCoApplicants = coApplicantCount > 0;

  return (
    <DashboardLayout 
      title="New Lead Information" 
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-120px)] relative">
        {/* Scrollable Content - Hidden Scrollbar */}
        <div className="flex-1 overflow-y-auto pb-32 scrollbar-hide" style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-semibold text-blue-600">{completedCount}/{totalModules} Modules Started</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-green-600 transition-all duration-300"
                style={{ width: `${(completedCount / totalModules) * 100}%` }}
              />
            </div>
          </div>

          {/* Application Status Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="mb-2">
              <span className="text-sm font-semibold text-gray-700">Application Status: </span>
              <span className={cn(
                "text-sm font-semibold",
                applicationStatus.status === 'Completed' ? "text-green-600" :
                applicationStatus.status === 'In Progress' ? "text-yellow-600" :
                "text-gray-600"
              )}>
                {applicationStatus.label}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Upload Documents or manually enter details to start the application
            </p>
          </div>

          {/* Upload Documents Button */}
          <div className="mb-6">
            <Button 
              onClick={handleUploadDocuments}
              className="w-full h-14 bg-[#0072CE] hover:bg-[#005a9e] text-white font-semibold rounded-xl"
            >
              <Upload className="w-5 h-5 mr-2" />
              Add a Document
            </Button>
          </div>

          {/* Payment Details Card */}
          <Card className="border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4 border-l-blue-600">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
                <Badge className="rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs font-medium px-3 py-1">
                  Pending
                </Badge>
              </div>
              <Button
                onClick={handleGeneratePaymentLink}
                className="w-full h-12 rounded-xl bg-[#0B63F6] hover:bg-[#0954d4] text-white font-semibold transition-colors"
              >
                Generate Payment Link
              </Button>
            </CardContent>
          </Card>

          {/* Applicant Details Card */}
          <Card className="border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4 border-l-blue-600">
            <CardContent className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Applicant Details</h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(applicantStatus)}
                </div>
              </div>

              {/* Basic Details Section */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <UserCheck className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Basic Details</p>
                      {step2Status === 'incomplete' ? (
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-gray-900">No basic details added yet</p>
                          <p className="text-xs text-gray-500">Upload PAN to auto-fill Name, DOB & PAN Number</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {step2Status !== 'incomplete' && (() => {
                      const step2 = currentLead?.formData?.step2;
                      if (step2?.autoFilledViaPAN) {
                        return <Badge className="bg-green-100 text-green-700 text-xs">Verified via PAN</Badge>;
                      }
                      return <Badge className="bg-gray-100 text-gray-700 text-xs">Manual Entry</Badge>;
                    })()}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/lead/basic-details')}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      Edit
                    </Button>
                  </div>
                </div>
                
                {step2Status !== 'incomplete' && currentLead && (
                  <div className="ml-[52px] space-y-1">
                    {(currentLead.customerFirstName || currentLead.customerLastName) && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">First Name:</span> {[currentLead.customerFirstName, currentLead.customerLastName].filter(Boolean).join(' ') || 'N/A'}
                      </p>
                    )}
                    {currentLead.dob && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Date of Birth:</span> {new Date(currentLead.dob).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    )}
                    {(() => {
                      const step2 = currentLead.formData?.step2;
                      if (step2?.hasPan === 'yes' && currentLead.panNumber) {
                        return (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">PAN Number:</span> {currentLead.panNumber}
                          </p>
                        );
                      } else if (step2?.hasPan === 'no' && step2?.alternateIdType && step2?.documentNumber) {
                        return (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">{step2.alternateIdType}:</span> {step2.documentNumber}
                          </p>
                        );
                      }
                      return null;
                    })()}
                    {currentLead.formData?.step2?.autoFilledViaPAN ? (
                      <p className="text-xs text-gray-400 mt-2">Auto-filled and verified via PAN & NSDL workflow</p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2">Values entered manually by RM.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Address Details Section */}
              <div className="mb-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Address Details</p>
                      {step3Status === 'incomplete' ? (
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-gray-900">No address details added yet</p>
                          <p className="text-xs text-gray-500">Upload Aadhaar to auto-fill Address & Pincode</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {step3Status !== 'incomplete' && (() => {
                      const step3 = currentLead?.formData?.step3;
                      if (step3?.autoFilledViaAadhaar || currentLead?.formData?.step3?.addresses?.[0]?.autoFilledViaAadhaar) {
                        return <Badge className="bg-green-100 text-green-700 text-xs">Verified via Aadhaar</Badge>;
                      }
                      return <Badge className="bg-gray-100 text-gray-700 text-xs">Manual Entry</Badge>;
                    })()}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/lead/address-details')}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      Edit
                    </Button>
                  </div>
                </div>
                
                {step3Status !== 'incomplete' && currentLead?.formData?.step3?.addresses?.[0] && (
                  <div className="ml-[52px] space-y-1">
                    {currentLead.formData.step3.addresses[0].addressLine1 && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Address:</span> {currentLead.formData.step3.addresses[0].addressLine1}
                        {currentLead.formData.step3.addresses[0].addressLine2 && `, ${currentLead.formData.step3.addresses[0].addressLine2}`}
                      </p>
                    )}
                    {currentLead.formData.step3.addresses[0].postalCode && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Pincode:</span> {currentLead.formData.step3.addresses[0].postalCode}
                      </p>
                    )}
                    {currentLead.formData?.step3?.autoFilledViaAadhaar || currentLead.formData.step3.addresses[0]?.autoFilledViaAadhaar ? (
                      <p className="text-xs text-gray-400 mt-2">Auto-filled and verified via Aadhaar OCR workflow</p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2">Values added manually by RM.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {uploadedDocuments.length === 0 ? 'No documents linked yet' : 
                   'Documents linked and verified'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Co-Applicants Card */}
          <Card className="border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4 border-l-blue-600">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Co-Applicant(s)</h3>
                <Badge
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium',
                    hasCoApplicants ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-50 text-gray-500 border border-gray-200'
                  )}
                >
                  {hasCoApplicants ? `${coApplicantCount} Added` : 'No Data'}
                </Badge>
              </div>

              {!hasCoApplicants ? (
                <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-white px-4 py-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">No co-applicants added yet</p>
                      <p className="text-xs text-gray-500">Add a co-applicant to continue joint application processing</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/lead/co-applicant-info')}
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    Manage
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {coApplicantCount} co-applicant{coApplicantCount > 1 ? 's' : ''} added
                        </p>
                        <p className="text-xs text-gray-500">
                          Manage details and documents for each co-applicant.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/lead/co-applicant-info')}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      Manage
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {coApplicants.map((coApp: any, index: number) => {
                      const basic = coApp?.data?.basicDetails ?? coApp?.data?.step1 ?? {};
                      const fullName =
                        [basic.firstName, basic.lastName].filter(Boolean).join(' ') || 'Unnamed Co-applicant';
                      return (
                        <div
                          key={coApp.id}
                          className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900"
                        >
                          {`Co-Applicant ${index + 1} – ${fullName}`}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <p className="text-xs text-gray-400">Each co-applicant requires PAN & Aadhaar verification</p>
            </CardContent>
          </Card>

          {/* Collateral Card */}
          <Card className="border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4 border-l-blue-600">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Collateral Details</h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(collateralStatus)}
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Home className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {collateralStatus !== 'incomplete' && currentLead?.formData?.step6 ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {(() => {
                            const step6 = currentLead.formData.step6;
                            const collateralType = step6.collateralSubType || step6.collateralType || '';
                            const typeLabel = collateralType === 'ready-property' ? 'Apartment' :
                                            collateralType === 'builder-property-under-construction' ? 'Builder Property' :
                                            collateralType === 'construction-on-land' ? 'Construction on Land' :
                                            collateralType === 'plot-self-construction' ? 'Plot + Self Construction' :
                                            collateralType === 'purchase-plot' ? 'Plot' :
                                            collateralType || 'Property';
                            const value = step6.propertyValue || 0;
                            const formattedValue = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                            return `${typeLabel} ₹${formattedValue}`;
                          })()}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-gray-900">No property document uploaded</p>
                        <p className="text-xs text-gray-500 mt-0.5">Upload or add property details manually</p>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/lead/collateral')}
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 flex-shrink-0"
                >
                  Edit
                </Button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">No document linked</p>
              </div>
            </CardContent>
          </Card>

          {/* Loan Requirement Card */}
          <Card className="border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4 border-l-blue-600">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Loan Requirement</h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(loanStatus)}
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <IndianRupee className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {loanStatus !== 'incomplete' && currentLead?.formData?.step7 ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {(() => {
                            const step7 = currentLead.formData.step7;
                            const amount = step7.loanAmount || currentLead.loanAmount || 0;
                            const formattedAmount = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                            const tenureMonths = step7.tenure || 0;
                            const tenureYears = Math.floor(tenureMonths / 12);
                            const purpose = step7.loanPurpose || currentLead.loanPurpose || '';
                            const purposeLabel = purpose === 'home-purchase' ? 'Home Purchase' :
                                                 purpose === 'home-construction' ? 'Home Construction' :
                                                 purpose === 'home-renovation' ? 'Home Renovation' :
                                                 purpose === 'plot-purchase' ? 'Plot Purchase' :
                                                 purpose || 'N/A';
                            return `₹${formattedAmount}${tenureYears > 0 ? ` · ${tenureYears} Years` : ''} · ${purposeLabel}`;
                          })()}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-gray-900">No loan requirement details available</p>
                        <p className="text-xs text-gray-500 mt-0.5">Upload supporting docs or start manually</p>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/lead/loan-requirement')}
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 flex-shrink-0"
                >
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Documents Added Card */}
          <Card className="border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4 border-l-blue-600">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Documents Added</h3>
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    uploadedDocuments.length === 0 ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-700",
                    "text-xs"
                  )}>
                    {uploadedDocuments.length === 0 ? 'No Files' : `${uploadedDocuments.length} File(s)`}
                  </Badge>
                </div>
              </div>

              {uploadedDocuments.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm font-semibold text-gray-900 mb-1">No documents added yet</p>
                  <p className="text-xs text-gray-500">Uploaded files will appear here once added</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadedDocuments.map((file: any) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => handlePreview(file)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {file.fileType === 'pdf' ? (
                            <FileText className="w-5 h-5 text-red-600" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.frontName && file.backName 
                              ? `${file.frontName} / ${file.backName}`
                              : file.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{file.type}</p>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Eye className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Fixed Submit Button Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              onClick={handleSubmit}
              disabled={completedCount < totalModules || !areAllDocumentsUploaded}
              className={cn(
                "flex-1 h-12 rounded-lg font-medium text-white",
                completedCount === totalModules && areAllDocumentsUploaded
                  ? "bg-[#0072CE] hover:bg-[#005a9e]" 
                  : "bg-gray-300 text-gray-600 cursor-not-allowed"
              )}
            >
              Submit Application
            </Button>
            {completedCount === totalModules && !areAllDocumentsUploaded && (
              <p className="text-xs text-red-600 mt-2 text-center w-full">
                Please upload all required documents to submit
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Document Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewFile?.name || 'Document Preview'}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {previewFile?.fileType === 'pdf' ? (
              <iframe
                src={previewFile.previewUrl || previewFile.frontPreviewUrl}
                className="w-full h-[600px] border rounded-lg"
                title="PDF Preview"
              />
            ) : (
              <div className="space-y-4">
                {previewFile?.frontPreviewUrl && (
                  <div>
                    <p className="text-sm font-medium mb-2">Front</p>
                    <img
                      src={previewFile.frontPreviewUrl}
                      alt="Front"
                      className="w-full rounded-lg border"
                    />
                  </div>
                )}
                {previewFile?.backPreviewUrl && (
                  <div>
                    <p className="text-sm font-medium mb-2">Back</p>
                    <img
                      src={previewFile.backPreviewUrl}
                      alt="Back"
                      className="w-full rounded-lg border"
                    />
                  </div>
                )}
                {previewFile?.previewUrl && !previewFile?.frontPreviewUrl && (
                  <img
                    src={previewFile.previewUrl}
                    alt="Preview"
                    className="w-full rounded-lg border"
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
