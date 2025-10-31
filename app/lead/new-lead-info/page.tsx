'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Play, Edit, CheckCircle, AlertCircle, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

  // Redirect if no current lead
  useEffect(() => {
    if (!currentLead) {
      router.replace('/leads');
    }
  }, [currentLead, router]);

  // Calculate section statuses
  const getApplicantDetailsStatus = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    
    const step2 = currentLead.formData?.step2;
    const step3 = currentLead.formData?.step3;
    
    // Check if all required fields are filled
    const hasStep2Data = step2 && 
      step2.dob &&
      ((step2.hasPan === 'yes' && currentLead.panNumber) || 
       (step2.hasPan === 'no' && step2.alternateIdType && step2.documentNumber));
    
    const hasStep3Data = step3?.addresses && 
      step3.addresses.length > 0 &&
      step3.addresses.every(addr => 
        addr.addressType && 
        addr.addressLine1 && 
        addr.landmark && 
        addr.postalCode && 
        addr.postalCode.length === 6
      );
    
    if (hasStep2Data && hasStep3Data) return 'completed';
    if ((hasStep2Data && !hasStep3Data) || (!hasStep2Data && hasStep3Data) || 
        (step2 || step3)) return 'in-progress';
    return 'incomplete';
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

  const sections: SectionInfo[] = [
    {
      id: 'applicant',
      title: 'Applicant Details',
      route: '/lead/applicant-details',
      status: getApplicantDetailsStatus()
    },
    {
      id: 'collateral',
      title: 'Collateral',
      route: '/lead/collateral',
      status: getCollateralStatus()
    },
    {
      id: 'loan-requirement',
      title: 'Loan Requirement',
      route: '/lead/loan-requirement',
      status: getLoanRequirementStatus()
    }
  ];

  const completedCount = sections.filter(s => s.status === 'completed').length;
  const totalModules = sections.length;

  // Helper function to generate required document list (matches step8 logic)
  const generateRequiredDocumentList = (lead: any): string[] => {
    const requiredDocs: string[] = [];
    const mainApplicantHasPan = lead?.formData?.step2?.hasPan === 'yes';
    
    // Required documents for main applicant - only PAN and Aadhaar
    if (mainApplicantHasPan) {
      requiredDocs.push('PAN');
    }
    requiredDocs.push('Adhaar');
    
    return requiredDocs;
  };

  // Check if all required documents are uploaded
  const areAllDocumentsUploaded = useMemo(() => {
    if (!currentLead) return false;
    
    const uploadedFiles = currentLead.formData?.step8?.files || [];
    if (!uploadedFiles || uploadedFiles.length === 0) return false;
    
    const successFiles = uploadedFiles.filter((f: any) => f.status === 'Success');
    const uploadedDocTypes = new Set(successFiles.map((f: any) => f.type));
    
    // Get required documents based on current lead data
    const requiredDocs = generateRequiredDocumentList(currentLead);
    
    // Check if all required documents are present
    const allUploaded = requiredDocs.every(docType => uploadedDocTypes.has(docType));
    
    return allUploaded;
  }, [currentLead]);

  const handleSectionClick = (route: string) => {
    router.push(route);
  };

  const handleUploadDocuments = () => {
    router.push('/lead/step8');
  };

  const handleSubmit = () => {
    if (!currentLead) return;
    
    // Check if all sections are completed
    const allCompleted = sections.every(s => s.status === 'completed');
    
    if (!allCompleted) {
      toast({
        title: 'Cannot Submit',
        description: 'Please complete all sections before submitting.',
        variant: 'destructive'
      });
      return;
    }
    
    // Check if all required documents are uploaded
    if (!areAllDocumentsUploaded) {
      toast({
        title: 'Cannot Submit',
        description: 'Please upload all required documents before submitting.',
        variant: 'destructive'
      });
      return;
    }
    
    // Submit the lead
    submitLead(currentLead.id);
    toast({
      title: 'Application Submitted',
      description: 'Your application has been submitted successfully.',
      className: 'bg-green-50 border-green-200'
    });
    
    // Navigate to leads page
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

  const getActionButton = (status: SectionStatus) => {
    switch (status) {
      case 'completed':
        return <Edit className="w-4 h-4 text-blue-600" />;
      case 'in-progress':
        return <Play className="w-4 h-4 text-blue-600" />;
      default:
        return <Play className="w-4 h-4 text-blue-600" />;
    }
  };

  const getActionTooltip = (status: SectionStatus) => {
    switch (status) {
      case 'completed':
        return 'Edit';
      case 'in-progress':
        return 'Continue';
      default:
        return 'Start';
    }
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
              Upload a Document
            </Button>
          </div>

        {/* Section Cards */}
        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.id} className="border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white">
              <CardContent className="p-5">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusBadge(section.status)}
                    <Button
                      onClick={() => handleSectionClick(section.route)}
                      variant="ghost"
                      size="icon"
                      className="w-9 h-9 rounded-full hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-all"
                      title={getActionTooltip(section.status)}
                    >
                      {getActionButton(section.status)}
                    </Button>
                  </div>
                </div>
                {/* Centered Status Content */}
                <div className="w-full p-5 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center min-h-[140px] bg-gray-50/50">
                  {section.status === 'incomplete' ? (
                    <>
                      <Upload className="w-10 h-10 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-500 text-center font-medium">No information added yet</p>
                    </>
                  ) : section.status === 'in-progress' ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mb-3">
                        <AlertCircle className="w-6 h-6 text-yellow-600" />
                      </div>
                      <p className="text-sm text-gray-700 text-center font-medium">Some information has been added</p>
                      <p className="text-xs text-gray-500 text-center mt-1">Please complete all required fields</p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center space-y-2 text-green-600">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold">Completed</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
    </DashboardLayout>
  );
}
