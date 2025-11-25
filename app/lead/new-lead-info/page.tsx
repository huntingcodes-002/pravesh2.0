'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Play, Edit, CheckCircle, AlertCircle, X, UserCheck, MapPin, Home, IndianRupee, FileText, Image as ImageIcon, Users, Loader2, Briefcase, Database } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead, type PaymentStatus } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { fetchPaymentStatus, getDetailedInfo, isApiError, type ApiSuccess, type ApplicationDetails, type Participant, type CollateralDetails, type LoanDetails, type PaymentResult } from '@/lib/api';

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
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pending');
  const [isPaymentStatusLoading, setIsPaymentStatusLoading] = useState(false);
  const [apiCoApplicants, setApiCoApplicants] = useState<Array<{ index: number; name: string }>>([]);
  const [isCoApplicantsLoading, setIsCoApplicantsLoading] = useState(false);
  const [detailedInfo, setDetailedInfo] = useState<ApplicationDetails | null>(null);
  const [isLoadingDetailedInfo, setIsLoadingDetailedInfo] = useState(false);

  // Redirect if no current lead
  useEffect(() => {
    if (!currentLead) {
      router.replace('/leads');
    }
  }, [currentLead, router]);

  useEffect(() => {
    if (!currentLead) return;

    let derivedStatus: PaymentStatus | null = null;

    if (currentLead.payments && currentLead.payments.length > 0) {
      const latestPayment = [...currentLead.payments].reverse().find(payment => payment?.status);
      if (latestPayment?.status) {
        derivedStatus = latestPayment.status;
      }
    }

    if (!derivedStatus && typeof window !== 'undefined' && currentLead.appId) {
      const storageKey = `payment-state-${currentLead.appId}`;
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.paymentStatus === 'Paid' || parsed?.paymentStatus === 'Pending' || parsed?.paymentStatus === 'Failed') {
            derivedStatus = parsed.paymentStatus;
          }
        }
      } catch (error) {
        console.warn('Failed to hydrate payment status from storage', error);
      }
    }

    if (derivedStatus) {
      setPaymentStatus(derivedStatus);
    }
  }, [currentLead]);

  // Fetch all detailed info from API
  useEffect(() => {
    if (!currentLead?.appId) {
      setDetailedInfo(null);
      return;
    }

    let isMounted = true;

    const fetchAllDetails = async () => {
      setIsLoadingDetailedInfo(true);
      try {
        const response = await getDetailedInfo(currentLead.appId);
        if (!isMounted) return;

        if (isApiError(response)) {
          console.warn('Failed to fetch detailed info', response.error);
          return;
        }

        // Extract application_details from response
        const successResponse = response as ApiSuccess<any>;
        const applicationDetails = successResponse.data?.application_details || successResponse.application_details;
        
        if (applicationDetails) {
          setDetailedInfo(applicationDetails);
          
          // Update payment status from payment_result
          if (applicationDetails.payment_result) {
            const paymentState = applicationDetails.payment_result.state?.toLowerCase();
            let nextStatus: PaymentStatus = 'Pending';
            if (paymentState === 'completed') {
              nextStatus = 'Paid';
            } else if (paymentState === 'failed' || paymentState === 'cancelled') {
              nextStatus = 'Failed';
            }
            setPaymentStatus(nextStatus);
          }
          
          // Extract co-applicants from participants
          const participants = applicationDetails.participants || [];
          const coApplicants = participants
            .filter((participant: Participant) => participant?.participant_type === 'co-applicant')
            .map((participant: Participant) => {
              const fullName = participant?.personal_info?.full_name;
              const name = fullName?.value || (typeof fullName === 'string' ? fullName : 'Unnamed Co-applicant');
              const index = typeof participant?.co_applicant_index === 'number' 
                ? participant.co_applicant_index 
                : -1;
              return { index, name };
            })
            .filter((coApp: { index: number; name: string }) => coApp.index >= 0)
            .sort((a: { index: number; name: string }, b: { index: number; name: string }) => a.index - b.index);
          
          setApiCoApplicants(coApplicants);
        }
      } catch (error) {
        console.warn('Failed to fetch detailed info', error);
      } finally {
        if (isMounted) {
          setIsLoadingDetailedInfo(false);
        }
      }
    };

    void fetchAllDetails();

    return () => {
      isMounted = false;
    };
  }, [currentLead?.appId]);

  // Fallback: Load payment status separately if not in detailed info
  useEffect(() => {
    if (!currentLead?.appId || detailedInfo?.payment_result) return;

    let isMounted = true;

    const loadPaymentStatus = async () => {
      setIsPaymentStatusLoading(true);
      try {
        const response = await fetchPaymentStatus(currentLead.appId);
        if (!isMounted) return;

        if (isApiError(response)) {
          return;
        }

        const statusData = response.data ?? (response as any);
        const normalizedState = String(statusData?.state ?? '').toLowerCase();

        let nextStatus: PaymentStatus = 'Pending';
        if (normalizedState === 'completed') {
          nextStatus = 'Paid';
        } else if (normalizedState === 'failed' || normalizedState === 'cancelled') {
          nextStatus = 'Failed';
        }

        setPaymentStatus(nextStatus);
      } catch (error) {
        console.warn('Failed to fetch payment status', error);
      } finally {
        if (isMounted) {
          setIsPaymentStatusLoading(false);
        }
      }
    };

    void loadPaymentStatus();

    return () => {
      isMounted = false;
    };
  }, [currentLead?.appId, detailedInfo?.payment_result]);

  // Get primary participant from detailed info
  const primaryParticipant = useMemo(() => {
    if (!detailedInfo?.participants) return null;
    return detailedInfo.participants.find((p: Participant) => p.participant_type === 'primary_participant');
  }, [detailedInfo]);

  const coApplicantRecords = useMemo(
    () => currentLead?.formData?.coApplicants || [],
    [currentLead?.formData?.coApplicants]
  );

  // Get uploaded documents (include all owners and statuses)
  const uploadedDocuments = useMemo(() => {
    return currentLead?.formData?.step8?.files || [];
  }, [currentLead?.formData?.step8?.files]);

  const getDocumentOwnerLabel = useCallback(
    (file: any) => {
      if (file.ownerType === 'coapplicant') {
        const coApp = coApplicantRecords.find((coApp: any) => coApp.id === file.coApplicantId);
        if (coApp) {
          const basic = coApp?.data?.basicDetails ?? coApp?.data?.step1 ?? {};
          const fullName = [basic.firstName, basic.lastName].filter(Boolean).join(' ');
          return fullName ? `Co-Applicant – ${fullName}` : 'Co-Applicant';
        }
        return 'Co-Applicant';
      }
      if (file.ownerType === 'collateral') {
        return 'Collateral';
      }
      return 'Applicant';
    },
    [coApplicantRecords]
  );

  const getDocumentStatusClasses = useCallback((status?: string) => {
    switch (status) {
      case 'Success':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Failed':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Processing':
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  }, []);

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

  // Calculate Step 2 status (Basic Details) - based on completion flag
  const getStep2Status = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    
    // If we have primary participant data from API, consider it completed
    if (primaryParticipant?.personal_info) {
      const personalInfo = primaryParticipant.personal_info;
      if (personalInfo.full_name?.value || personalInfo.pan_number?.value || personalInfo.mobile_number?.value) {
        return 'completed';
      }
    }
    
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
    
    // If we have addresses from API, consider it completed
    if (primaryParticipant?.addresses && primaryParticipant.addresses.length > 0) {
      return 'completed';
    }
    
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
    
    // If we have collateral details from API, consider it completed
    if (detailedInfo?.collateral_details) {
      return 'completed';
    }
    
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
    
    // If we have loan details from API, consider it completed
    if (detailedInfo?.loan_details) {
      return 'completed';
    }
    
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

  const getEmploymentStatus = (): SectionStatus => {
    if (!currentLead) return 'incomplete';
    
    const step5 = currentLead.formData?.step5;
    if (!step5 || !step5.occupationType) return 'incomplete';
    
    // Check if required fields are filled based on occupation type
    switch (step5.occupationType) {
      case 'others':
        if (step5.natureOfOccupation) return 'completed';
        return 'in-progress';
      case 'salaried':
        const salariedValid = step5.employerName && step5.natureOfBusiness && step5.industry && step5.employmentStatus && step5.employedFrom;
        if (step5.employmentStatus === 'past' && !step5.employedTo) return 'in-progress';
        return salariedValid ? 'completed' : 'in-progress';
      case 'self-employed-non-professional':
        const senpValid = step5.orgNameSENP && step5.natureOfBusinessSENP && step5.industrySENP && step5.yearsInProfessionSENP && step5.monthsInProfessionSENP;
        return senpValid ? 'completed' : 'in-progress';
      case 'self-employed-professional':
        const sepValid = step5.orgNameSEP && step5.natureOfProfession && step5.industrySEP && step5.registrationNumber && step5.yearsInProfessionSEP && step5.monthsInProfessionSEP;
        return sepValid ? 'completed' : 'in-progress';
      default:
        return 'incomplete';
    }
  };

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
    
    if (!canSubmitApplication) {
      toast({
        title: 'Cannot Submit',
        description: 'Please complete all steps before submitting.',
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
    const baseClasses = "rounded-full border text-xs font-medium px-3 py-1";
    switch (status) {
      case 'completed':
        return <Badge className={cn(baseClasses, "bg-green-100 border-green-200 text-green-700")}>Completed</Badge>;
      case 'in-progress':
        return <Badge className={cn(baseClasses, "bg-yellow-100 border-yellow-200 text-yellow-700")}>In Progress</Badge>;
      default:
        return <Badge className={cn(baseClasses, "bg-gray-50 border-gray-200 text-gray-600")}>No Data</Badge>;
    }
  };

  const renderPaymentStatusBadge = () => {
    const baseClasses = "rounded-full border text-xs font-medium px-3 py-1";
    if (isPaymentStatusLoading) {
      return <Badge className={cn(baseClasses, "bg-gray-100 border-gray-200 text-gray-600")}>Checking...</Badge>;
    }

    switch (paymentStatus) {
      case 'Paid':
        return <Badge className={cn(baseClasses, "bg-green-100 border-green-200 text-green-700")}>Completed</Badge>;
      case 'Failed':
        return <Badge className={cn(baseClasses, "bg-red-100 border-red-200 text-red-600")}>Failed</Badge>;
      default:
        return <Badge className={cn(baseClasses, "bg-yellow-100 border-yellow-200 text-yellow-700")}>Pending</Badge>;
    }
  };

  const getDocumentDisplayName = (docType: string): string => {
    const mapping: Record<string, string> = {
      'PAN': 'Pan',
      'Adhaar': 'Aadhaar',
      'Passport': 'Passport',
      'VoterID': 'Voter ID',
      'DrivingLicense': 'Driving License',
      'CollateralPapers': 'Sale Deed',
      'PropertyPhotos': 'Property Photos',
    };
    
    // Handle co-applicant documents (e.g., "PAN_123" -> "Pan")
    const baseType = docType.split('_')[0];
    const displayName = mapping[baseType] || baseType;
    return `Document ${displayName} Uploaded`;
  };

  // Helper function to map loan purpose backend values to display labels
  const getLoanPurposeLabel = (purpose: string): string => {
    const mapping: Record<string, string> = {
      'business_expansion': 'Business Expansion',
      'working_capital': 'Working Capital',
      'home-purchase': 'Home Purchase',
      'home-construction': 'Home Construction',
      'home-renovation': 'Home Renovation',
      'plot-purchase': 'Plot Purchase',
    };
    return mapping[purpose] || purpose || 'N/A';
  };

  // Calculate status values (must be before early returns)
  const step2Status = currentLead ? getStep2Status() : 'incomplete';
  const step3Status = currentLead ? getStep3Status() : 'incomplete';
  const applicantStatus = currentLead ? getApplicantDetailsStatus() : 'incomplete';
  const collateralStatus = currentLead ? getCollateralStatus() : 'incomplete';
  const loanStatus = currentLead ? getLoanRequirementStatus() : 'incomplete';
  const coApplicantStatus = currentLead ? getCoApplicantStatus() : 'incomplete';
  const coApplicantCount = detailedInfo?.participants?.filter((p: Participant) => p.participant_type === 'co-applicant').length || apiCoApplicants.length;
  const hasCoApplicants = coApplicantCount > 0;

  const isPaymentCompleted = paymentStatus === 'Paid';
  const paymentStepStatus: SectionStatus = isPaymentCompleted ? 'completed' : paymentStatus === 'Failed' ? 'in-progress' : 'in-progress';
  const documentsStepStatus: SectionStatus = areAllDocumentsUploaded
    ? 'completed'
    : uploadedDocuments.length > 0
      ? 'in-progress'
      : 'incomplete';
  const isDocumentsCompleted = documentsStepStatus === 'completed';
  const isCoApplicantStepCompleted = hasCoApplicants ? coApplicantStatus === 'completed' : true;

  // All hooks must be called before any early returns
  const progressSteps = useMemo(() => {
    if (!currentLead) return [];
    const steps: Array<{ id: string; label: string; status: SectionStatus }> = [
      { id: 'applicant', label: 'Applicant Details', status: applicantStatus },
      { id: 'payment', label: 'Payment', status: paymentStepStatus },
      { id: 'documents', label: 'Documents', status: documentsStepStatus },
      { id: 'collateral', label: 'Collateral', status: collateralStatus },
      { id: 'loan', label: 'Loan Requirement', status: loanStatus },
    ];
    if (hasCoApplicants) {
      steps.push({ id: 'coapplicant', label: 'Co-Applicant', status: coApplicantStatus });
    }
    // Add 2 more steps to match the new total (x/7 or x/8)
    steps.push({ id: 'employment', label: 'Employment', status: getEmploymentStatus() });
    steps.push({ id: 'account-aggregator', label: 'Account Aggregator', status: 'incomplete' });
    return steps;
  }, [currentLead, applicantStatus, paymentStepStatus, documentsStepStatus, collateralStatus, loanStatus, coApplicantStatus, hasCoApplicants]);

  const totalSteps = progressSteps.length;
  const completedStepsCount = progressSteps.filter((step) => step.status === 'completed').length;
  const progressPercent = totalSteps === 0 ? 0 : (completedStepsCount / totalSteps) * 100;

  const applicationStatus = useMemo(() => {
    if (totalSteps === 0 || completedStepsCount === 0) {
      return { status: 'Yet to begin' as const, label: 'Yet to begin' };
    }
    if (completedStepsCount === totalSteps) {
      return { status: 'Completed' as const, label: 'Completed' };
    }
    return { status: 'In Progress' as const, label: 'In Progress' };
  }, [completedStepsCount, totalSteps]);

  // Early returns must come AFTER all hooks
  if (!currentLead) {
    return null;
  }

  // Show loading state while fetching detailed info
  if (isLoadingDetailedInfo && !detailedInfo) {
    return (
      <DashboardLayout 
        title="New Lead Information" 
        showNotifications={false}
        showExitButton={true}
        onExit={handleExit}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600">Loading application details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const canSubmitApplication = [
    applicantStatus === 'completed',
    isPaymentCompleted,
    isDocumentsCompleted,
    collateralStatus === 'completed',
    loanStatus === 'completed',
    isCoApplicantStepCompleted,
  ].every(Boolean);

  const showDocsWarning =
    applicantStatus === 'completed' &&
    isPaymentCompleted &&
    collateralStatus === 'completed' &&
    loanStatus === 'completed' &&
    isCoApplicantStepCompleted &&
    !isDocumentsCompleted;

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
              <span className="text-sm font-semibold text-blue-600">
                {completedStepsCount}/{totalSteps} Modules Started
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-green-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
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
          <Card className={cn(
            "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
            isPaymentCompleted ? "border-l-green-600" : "border-l-blue-600"
          )}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
                {renderPaymentStatusBadge()}
              </div>
              
              {isPaymentCompleted ? (
                <div className="mb-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Payment received successfully</p>
                      <p className="text-xs text-gray-500">Login fee has been confirmed and recorded.</p>
                    </div>
                  </div>
                  {detailedInfo?.payment_result && (
                    <div className="ml-[60px] space-y-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">Amount:</span>
                        <span className="text-sm font-semibold text-gray-900">₹{detailedInfo.payment_result.amount.toLocaleString('en-IN')}</span>
                      </div>
                      {detailedInfo.payment_result.order_id && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600">Order ID:</span>
                          <span className="text-xs text-gray-700 font-mono">{detailedInfo.payment_result.order_id}</span>
                        </div>
                      )}
                      {detailedInfo.payment_result.paid_on && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600">Paid On:</span>
                          <span className="text-xs text-gray-700">
                            {new Date(detailedInfo.payment_result.paid_on).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {detailedInfo.payment_result.masked_customer_mobile && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600">Mobile:</span>
                          <span className="text-xs text-gray-700">{detailedInfo.payment_result.masked_customer_mobile}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="ml-[60px]">
                    <Button
                      onClick={handleGeneratePaymentLink}
                      variant="outline"
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {detailedInfo?.payment_result && (
                    <div className="mb-4 space-y-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">Amount:</span>
                        <span className="text-sm font-semibold text-gray-900">₹{detailedInfo.payment_result.amount.toLocaleString('en-IN')}</span>
                      </div>
                      {detailedInfo.payment_result.order_id && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600">Order ID:</span>
                          <span className="text-xs text-gray-700 font-mono">{detailedInfo.payment_result.order_id}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={handleGeneratePaymentLink}
                    className="w-full h-12 rounded-xl bg-[#0B63F6] hover:bg-[#0954d4] text-white font-semibold transition-colors"
                  >
                    Generate Payment Link
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Applicant Details Card */}
          <Card className={cn(
            "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
            applicantStatus === 'completed' ? "border-l-green-600" : "border-l-blue-600"
          )}>
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
                    {step2Status !== 'incomplete' && currentLead?.formData?.step2?.autoFilledViaPAN && (
                      <Badge className="bg-green-100 text-green-700 text-xs">Verified via PAN</Badge>
                    )}
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
                
                {step2Status !== 'incomplete' && (primaryParticipant || currentLead) && (
                  <div className="ml-[52px] space-y-1">
                    {(() => {
                      // Prefer API data, fallback to currentLead
                      const fullName = primaryParticipant?.personal_info?.full_name;
                      const nameValue = fullName?.value || (typeof fullName === 'string' ? fullName : null);
                      const displayName = nameValue || 
                        (currentLead?.customerFirstName || currentLead?.customerLastName 
                          ? [currentLead.customerFirstName, currentLead.customerLastName].filter(Boolean).join(' ')
                          : null);
                      const isVerified = fullName?.verified || currentLead?.formData?.step2?.autoFilledViaPAN;
                      
                      if (displayName) {
                        return (
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            {isVerified && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
                            <span><span className="font-medium">First Name:</span> {displayName}</span>
                          </p>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      const dob = primaryParticipant?.personal_info?.date_of_birth;
                      const dobValue = dob?.value || (typeof dob === 'string' ? dob : null) || currentLead?.dob;
                      const isVerified = dob?.verified || currentLead?.formData?.step2?.autoFilledViaPAN;
                      
                      if (dobValue) {
                        const dobDate = new Date(dobValue);
                        return (
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            {isVerified && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
                            <span><span className="font-medium">Date of Birth:</span> {dobDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                          </p>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      const pan = primaryParticipant?.personal_info?.pan_number;
                      const panValue = pan?.value || (typeof pan === 'string' ? pan : null) || currentLead?.panNumber;
                      const isVerified = pan?.verified || currentLead?.formData?.step2?.autoFilledViaPAN;
                      
                      if (panValue) {
                        return (
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            {isVerified && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
                            <span><span className="font-medium">PAN Number:</span> {panValue}</span>
                          </p>
                        );
                      }
                      
                      // Fallback to currentLead formData
                      const step2 = currentLead?.formData?.step2;
                      if (step2?.hasPan === 'no' && step2?.alternateIdType && step2?.documentNumber) {
                        return (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">{step2.alternateIdType}:</span> {step2.documentNumber}
                          </p>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      const mobile = primaryParticipant?.personal_info?.mobile_number;
                      const mobileValue = mobile?.value || (typeof mobile === 'string' ? mobile : null) || currentLead?.customerMobile;
                      const isVerified = mobile?.verified;
                      
                      if (mobileValue) {
                        return (
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            {isVerified && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
                            <span><span className="font-medium">Mobile:</span> {mobileValue}</span>
                          </p>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      const gender = primaryParticipant?.personal_info?.gender || currentLead?.gender;
                      if (gender) {
                        return (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Gender:</span> {gender.charAt(0).toUpperCase() + gender.slice(1)}
                          </p>
                        );
                      }
                      return null;
                    })()}
                    {(currentLead?.formData?.step2?.autoFilledViaPAN || primaryParticipant?.personal_info?.pan_number?.verified) && (
                      <p className="text-xs text-gray-400 mt-2">Auto-filled and verified via PAN & NSDL workflow.</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">Submitted by RM</p>
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
                      if (step3?.autoFilledViaAadhaar || step3?.addresses?.some((addr: any) => addr?.autoFilledViaAadhaar)) {
                        return <Badge className="bg-green-100 text-green-700 text-xs">Verified via Aadhaar</Badge>;
                      }
                      return null;
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
                
                {step3Status !== 'incomplete' && ((primaryParticipant?.addresses && primaryParticipant.addresses.length > 0) || (currentLead?.formData?.step3?.addresses && currentLead.formData.step3.addresses.length > 0)) && (
                  <div className="ml-[52px] space-y-3">
                    {(() => {
                      // Prefer API data, fallback to currentLead
                      const apiAddresses = primaryParticipant?.addresses || [];
                      const formAddresses = currentLead?.formData?.step3?.addresses || [];
                      const isVerified = currentLead?.formData?.step3?.autoFilledViaAadhaar || formAddresses.some((addr: any) => addr?.autoFilledViaAadhaar);
                      
                      // Use API addresses if available, otherwise use form addresses
                      const addressesToShow = apiAddresses.length > 0 
                        ? apiAddresses.map(addr => ({
                            address_line_1: addr.address_line_1,
                            address_line_2: addr.address_line_2,
                            address_line_3: addr.address_line_3,
                            landmark: addr.landmark,
                            city: addr.city,
                            state: addr.state,
                            pincode: addr.pincode,
                            address_type: addr.address_type,
                            is_primary: addr.is_primary
                          }))
                        : formAddresses.map((addr: any) => ({
                            address_line_1: addr.addressLine1,
                            address_line_2: addr.addressLine2,
                            address_line_3: addr.addressLine3,
                            landmark: addr.landmark,
                            city: addr.city,
                            state: addr.state,
                            pincode: addr.postalCode,
                            address_type: addr.addressType,
                            is_primary: addr.isPrimary
                          }));
                      
                      if (addressesToShow.length === 0) return null;
                      
                      const primaryAddress = addressesToShow.find((addr: any) => addr.is_primary) || addressesToShow[0];
                      
                      return (
                        <>
                          {primaryAddress.address_line_1 && (
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              {isVerified && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
                              <span><span className="font-medium">Address:</span> {primaryAddress.address_line_1}</span>
                            </p>
                          )}
                          {primaryAddress.city && (
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              {isVerified && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
                              <span><span className="font-medium">City:</span> {primaryAddress.city}</span>
                            </p>
                          )}
                          {primaryAddress.pincode && (
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              {isVerified && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
                              <span><span className="font-medium">Pincode:</span> {primaryAddress.pincode}</span>
                            </p>
                          )}
                          {isVerified && (
                            <p className="text-xs text-gray-400 mt-2">Auto-filled and verified via Aadhaar OCR workflow.</p>
                          )}
                        </>
                      );
                    })()}
                    <p className="text-xs text-gray-400 mt-2">Submitted by RM</p>
                  </div>
                )}
              </div>

              {/* Employment Details Section */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Employment Details</p>
                      {getEmploymentStatus() === 'incomplete' ? (
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-gray-900">No employment details added yet</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getEmploymentStatus() !== 'incomplete' && (
                      <Badge className={cn(
                        "text-xs",
                        getEmploymentStatus() === 'completed' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        {getEmploymentStatus() === 'completed' ? 'Completed' : 'In Progress'}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/lead/employment-details')}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      Edit
                    </Button>
                  </div>
                </div>
                
                {getEmploymentStatus() !== 'incomplete' && currentLead?.formData?.step5 && (
                  <div className="ml-[52px] space-y-1">
                    {(() => {
                      const step5 = currentLead.formData.step5;
                      const occupationTypeLabels: Record<string, string> = {
                        'salaried': 'Salaried',
                        'self-employed-non-professional': 'Self Employed Non Professional',
                        'self-employed-professional': 'Self Employed Professional',
                        'others': 'Others'
                      };
                      
                      return (
                        <>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Occupation Type:</span> {occupationTypeLabels[step5.occupationType] || step5.occupationType}
                          </p>
                          {step5.occupationType === 'salaried' && (
                            <>
                              {step5.employerName && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Employer:</span> {step5.employerName}
                                </p>
                              )}
                              {step5.employmentStatus && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Status:</span> {step5.employmentStatus === 'present' ? 'Present' : 'Past'}
                                </p>
                              )}
                            </>
                          )}
                          {(step5.occupationType === 'self-employed-non-professional' || step5.occupationType === 'self-employed-professional') && (
                            <>
                              {(step5.orgNameSENP || step5.orgNameSEP) && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Organization:</span> {step5.orgNameSENP || step5.orgNameSEP}
                                </p>
                              )}
                            </>
                          )}
                          {step5.occupationType === 'others' && step5.natureOfOccupation && (
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Nature:</span> {step5.natureOfOccupation.charAt(0).toUpperCase() + step5.natureOfOccupation.slice(1)}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    <p className="text-xs text-gray-400 mt-2">Submitted by RM</p>
                  </div>
                )}
              </div>

              {/* Account Aggregator Section */}
              <div className="mb-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Database className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Account Aggregator</p>
                      <p className="text-xs text-gray-500">Coming soon</p>
                    </div>
                  </div>
                </div>
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
          <Card className={cn(
            "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
            hasCoApplicants && coApplicantStatus === 'completed' ? "border-l-green-600" : "border-l-blue-600"
          )}>
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Co-Applicant(s)</h3>
                {isCoApplicantsLoading ? (
                  <Badge className="rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                    Loading...
                  </Badge>
                ) : (
                  <Badge
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium',
                      hasCoApplicants ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-50 text-gray-500 border border-gray-200'
                    )}
                  >
                    {hasCoApplicants ? `${coApplicantCount} Added` : 'No Data'}
                  </Badge>
                )}
              </div>

              {isCoApplicantsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading co-applicants...</span>
                  </div>
                </div>
              ) : !hasCoApplicants ? (
                <div className="flex items-start justify-between gap-4">
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
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 flex-shrink-0"
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
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 flex-shrink-0"
                    >
                      Manage
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {detailedInfo?.participants
                      ?.filter((p: Participant) => p.participant_type === 'co-applicant')
                      .map((participant: Participant) => {
                        const fullName = participant?.personal_info?.full_name;
                        const name = fullName?.value || (typeof fullName === 'string' ? fullName : 'Unnamed Co-applicant');
                        const index = participant?.co_applicant_index ?? -1;
                        const pan = participant?.personal_info?.pan_number;
                        const mobile = participant?.personal_info?.mobile_number;
                        const dob = participant?.personal_info?.date_of_birth;
                        
                        return (
                          <div
                            key={`co-applicant-${index}`}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-900">
                                Co-Applicant {index + 1} – {name}
                              </p>
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              {pan?.value && (
                                <p>
                                  <span className="font-medium">PAN:</span> {pan.value}
                                  {pan.verified && <span className="ml-2 text-green-600 text-[10px]">✓ Verified</span>}
                                </p>
                              )}
                              {mobile?.value && (
                                <p>
                                  <span className="font-medium">Mobile:</span> {mobile.value}
                                  {mobile.verified && <span className="ml-2 text-green-600 text-[10px]">✓ Verified</span>}
                                </p>
                              )}
                              {dob?.value && (
                                <p>
                                  <span className="font-medium">DOB:</span> {new Date(dob.value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  {dob.verified && <span className="ml-2 text-green-600 text-[10px]">✓ Verified</span>}
                                </p>
                              )}
                              {participant?.addresses && participant.addresses.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <p className="font-medium mb-1">Addresses:</p>
                                  {participant.addresses.map((addr, addrIdx) => (
                                    <div key={addrIdx} className="ml-2 mb-2 last:mb-0">
                                      <p className="text-[11px] text-gray-600">
                                        {addr.address_type.charAt(0).toUpperCase() + addr.address_type.slice(1)}
                                        {addr.is_primary && <span className="ml-1 text-blue-600">(Primary)</span>}
                                      </p>
                                      <p className="text-[11px] text-gray-500">
                                        {[addr.address_line_1, addr.address_line_2, addr.address_line_3].filter(Boolean).join(', ')}
                                      </p>
                                      <p className="text-[11px] text-gray-500">
                                        {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {apiCoApplicants.length > 0 && !detailedInfo?.participants && (
                      // Fallback to simple list if detailed info not available
                      apiCoApplicants.map((coApp) => (
                        <div
                          key={`co-applicant-${coApp.index}`}
                          className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900"
                        >
                          {`Co-Applicant ${coApp.index + 1} – ${coApp.name}`}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              <p className="text-xs text-gray-400">Each co-applicant requires PAN & Aadhaar verification</p>
            </CardContent>
          </Card>

          {/* Collateral Card */}
          <Card className={cn(
            "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
            collateralStatus === 'completed' ? "border-l-green-600" : "border-l-blue-600"
          )}>
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
                    {collateralStatus !== 'incomplete' && (detailedInfo?.collateral_details || currentLead?.formData?.step6) ? (
                      <div className="space-y-1">
                        {(() => {
                          const collateral = detailedInfo?.collateral_details;
                          const step6 = currentLead?.formData?.step6;
                          
                          const collateralType = collateral?.collateral_type || step6?.collateralType || '';
                          const typeLabel = collateralType === 'ready-property' ? 'Apartment' :
                                          collateralType === 'builder-property-under-construction' ? 'Builder Property' :
                                          collateralType === 'construction-on-land' ? 'Construction on Land' :
                                          collateralType === 'plot-self-construction' ? 'Plot + Self Construction' :
                                          collateralType === 'purchase-plot' ? 'Plot' :
                                          collateralType || 'Property';
                          const value = collateral?.estimated_property_value || step6?.propertyValue || 0;
                          const formattedValue = typeof value === 'string' 
                            ? parseFloat(value).toLocaleString('en-IN')
                            : value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                          
                          return (
                            <p className="text-sm font-semibold text-gray-900">
                              {typeLabel} ₹{formattedValue}
                            </p>
                          );
                        })()}
                        {detailedInfo?.collateral_details?.ownership_type && (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Ownership:</span> {
                              detailedInfo.collateral_details.ownership_type === 'self_ownership' ? 'Self Ownership' :
                              detailedInfo.collateral_details.ownership_type === 'joint_ownership' ? 'Joint Ownership' :
                              detailedInfo.collateral_details.ownership_type
                            }
                          </p>
                        )}
                        {detailedInfo?.collateral_details?.address && (
                          <div className="mt-2 space-y-0.5">
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Address:</span> {[
                                detailedInfo.collateral_details.address.address_line_1,
                                detailedInfo.collateral_details.address.address_line_2,
                                detailedInfo.collateral_details.address.address_line_3
                              ].filter(Boolean).join(', ')}
                            </p>
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Location:</span> {[
                                detailedInfo.collateral_details.address.city,
                                detailedInfo.collateral_details.address.state,
                                detailedInfo.collateral_details.address.pincode
                              ].filter(Boolean).join(', ')}
                            </p>
                            {detailedInfo.collateral_details.address.landmark && (
                              <p className="text-xs text-gray-600">
                                <span className="font-medium">Landmark:</span> {detailedInfo.collateral_details.address.landmark}
                              </p>
                            )}
                          </div>
                        )}
                        {detailedInfo?.collateral_details?.collateral_description && (
                          <p className="text-xs text-gray-500 mt-1">
                            {detailedInfo.collateral_details.collateral_description}
                          </p>
                        )}
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
          <Card className={cn(
            "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
            loanStatus === 'completed' ? "border-l-green-600" : "border-l-blue-600"
          )}>
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
                    {loanStatus !== 'incomplete' && (detailedInfo?.loan_details || currentLead?.formData?.step7) ? (
                      <div className="space-y-1">
                        {(() => {
                          const loanDetails = detailedInfo?.loan_details;
                          const step7 = currentLead?.formData?.step7;
                          
                          const amount = loanDetails?.loan_amount_requested || step7?.loanAmount || currentLead?.loanAmount || 0;
                          const formattedAmount = typeof amount === 'string' 
                            ? parseFloat(amount).toLocaleString('en-IN')
                            : amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                          
                          const tenureMonths = loanDetails?.tenure_months || step7?.tenure || 0;
                          const tenureYears = Math.floor(Number(tenureMonths) / 12);
                          const tenureMonthsRemainder = Number(tenureMonths) % 12;
                          
                          const purpose = loanDetails?.loan_purpose || step7?.loanPurpose || currentLead?.loanPurpose || '';
                          const purposeLabel = getLoanPurposeLabel(purpose);
                          
                          return (
                            <>
                              <p className="text-sm font-semibold text-gray-900">
                                ₹{formattedAmount}
                                {tenureYears > 0 && ` · ${tenureYears} Year${tenureYears > 1 ? 's' : ''}`}
                                {tenureMonthsRemainder > 0 && ` ${tenureMonthsRemainder} Month${tenureMonthsRemainder > 1 ? 's' : ''}`}
                                {tenureYears === 0 && tenureMonthsRemainder > 0 && ` · ${tenureMonthsRemainder} Month${tenureMonthsRemainder > 1 ? 's' : ''}`}
                                {purposeLabel && ` · ${purposeLabel}`}
                              </p>
                              {loanDetails?.interest_rate && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Interest Rate:</span> {loanDetails.interest_rate}%
                                </p>
                              )}
                              {loanDetails?.product_code && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Product:</span> {loanDetails.product_code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </p>
                              )}
                              {loanDetails?.loan_purpose_description && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {loanDetails.loan_purpose_description}
                                </p>
                              )}
                              {loanDetails?.sourcing_channel && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Sourcing Channel:</span> {loanDetails.sourcing_channel.charAt(0).toUpperCase() + loanDetails.sourcing_channel.slice(1)}
                                </p>
                              )}
                            </>
                          );
                        })()}
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
          <Card className={cn(
            "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
            documentsStepStatus === 'completed' ? "border-l-green-600" : "border-l-blue-600"
          )}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Documents Added</h3>
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "rounded-full border text-xs font-medium px-3 py-1",
                    uploadedDocuments.length === 0 ? "bg-gray-50 border-gray-200 text-gray-600" : "bg-green-100 border-green-200 text-green-700"
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
                  {(() => {
                    // Get unique document types that have been successfully uploaded
                    const successFiles = uploadedDocuments.filter((f: any) => f.status === 'Success');
                    const uniqueDocTypes = Array.from(new Set(successFiles.map((f: any) => f.type))) as string[];
                    
                    return uniqueDocTypes.map((docType: string) => (
                      <div
                        key={docType}
                        className="p-3 border border-gray-200 rounded-lg bg-white"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {getDocumentDisplayName(docType)}
                        </p>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {showDocsWarning && (
            <div className="mt-5 text-sm font-semibold text-red-600">
              Please upload all required documents to submit
            </div>
          )}

        </div>

        {/* Fixed Submit Button Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmitApplication}
              className={cn(
                "flex-1 h-12 rounded-lg font-medium text-white",
                canSubmitApplication
                  ? "bg-[#0072CE] hover:bg-[#005a9e]" 
                  : "bg-gray-300 text-gray-600 cursor-not-allowed"
              )}
            >
              Submit Application
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
