'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Play, Edit, CheckCircle, AlertCircle, X, UserCheck, MapPin, Home, IndianRupee, FileText, Eye, Image as ImageIcon } from 'lucide-react';
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

  // Calculate Step 2 status (Basic Details)
  const getStep2Status = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    
    const step2 = currentLead.formData?.step2;
    const hasData = step2 && 
      step2.dob &&
      currentLead.gender && // Gender is required
      currentLead.panNumber && // PAN is always required
      currentLead.panNumber.length === 10;
    
    if (hasData) return 'completed';
    if (step2) return 'in-progress';
    return 'incomplete';
  };

  // Calculate Step 3 status (Address Details)
  const getStep3Status = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    
    const step3 = currentLead.formData?.step3;
    const hasData = step3?.addresses && 
      step3.addresses.length > 0 &&
      step3.addresses.every((addr: any) => 
        addr.addressType && 
        addr.addressLine1 && 
        addr.landmark && 
        addr.postalCode && 
        addr.postalCode.length === 6
      );
    
    if (hasData) return 'completed';
    if (step3) return 'in-progress';
    return 'incomplete';
  };

  // Calculate Applicant Details overall status
  const getApplicantDetailsStatus = (): SectionStatus => {
    const step2Status = getStep2Status();
    const step3Status = getStep3Status();
    
    if (step2Status === 'completed' && step3Status === 'completed') return 'completed';
    if (step2Status === 'incomplete' && step3Status === 'incomplete') return 'incomplete';
    return 'in-progress';
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

  const completedCount = [getApplicantDetailsStatus(), getCollateralStatus(), getLoanRequirementStatus()].filter(s => s === 'completed').length;
  const totalModules = 3;

  // Helper function to generate required document list
  const generateRequiredDocumentList = (lead: any): string[] => {
    // PAN and Aadhaar are always required
    return ['PAN', 'Adhaar'];
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
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 text-xs">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-yellow-100 text-yellow-700 text-xs">In Progress</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 text-xs">No Data</Badge>;
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
                      {step2Status === 'incomplete' && (
                        <p className="text-xs text-gray-500 mt-0.5">Upload Pan to auto-fetch user details</p>
                      )}
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
                      {step3Status === 'incomplete' && (
                        <p className="text-xs text-gray-500 mt-0.5">Upload Aadhaar to auto-fetch Address</p>
                      )}
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

          {/* Collateral Card */}
          <Card className="border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4 border-l-blue-600">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Collateral Details</h3>
                <div className="flex items-center gap-2">
                  {collateralStatus !== 'incomplete' && (
                    <Badge className="bg-gray-100 text-gray-700 text-xs">Manual Entry</Badge>
                  )}
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
                  {loanStatus !== 'incomplete' && (
                    <Badge className="bg-gray-100 text-gray-700 text-xs">Manual Entry</Badge>
                  )}
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
                        <p className="text-xs text-gray-500 mt-0.5">Click to start manually</p>
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
