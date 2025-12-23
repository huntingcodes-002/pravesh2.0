'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Play, Edit, CheckCircle, AlertCircle, X, UserCheck, MapPin, Home, IndianRupee, FileText, Image as ImageIcon, Users, Loader2, Briefcase, Database, CreditCard, Check, AlertTriangle, RefreshCw, ShieldCheck, Info } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead, type PaymentStatus } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { fetchPaymentStatus, getDetailedInfo, isApiError, type ApiSuccess, type ApplicationDetails, type Participant, type CollateralDetails, type LoanDetails, type PaymentResult, getRequiredDocuments, getCoApplicantRequiredDocuments, type DocumentStatus, initiateAccountAggregator, resendAccountAggregatorConsent, getAccountAggregatorStatus, initiateCoApplicantAccountAggregator, resendCoApplicantAccountAggregatorConsent, getCoApplicantAccountAggregatorStatus, uploadDocument, getBreQuestions, type BreQuestion } from '@/lib/api';

const DOC_LABELS: Record<string, string> = {
  aadhaar_card: 'Aadhaar Card',
  pan_card: 'PAN Card',
  bank_statement: 'Bank Statement',
  driving_license: 'Driving License',
  voter_id: 'Voter ID',
  passport: 'Passport',
  form_60: 'Form 60',
  current_address_proof: 'Current Address Proof',
  permanent_address_proof: 'Permanent Address Proof',
  office_current_address_proof: 'Office Current Address Proof',
  office_permanent_address_proof: 'Office Permanent Address Proof',
  collateral_images_front: 'Front View',
  collateral_images_inside: 'Inside View',
  collateral_images_road: 'Road View',
  collateral_images_selfie: 'Selfie',
  collateral_images_side: 'Side View',
  collateral_images_surrounding: 'Surrounding View',
  collateral_legal: 'Legal Document',
  collateral_ownership: 'Ownership Document',
};

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
  const [workflowState, setWorkflowState] = useState<any>(null);
  const [applicantDocs, setApplicantDocs] = useState<Record<string, DocumentStatus> | null>(null);
  const [coApplicantDocs, setCoApplicantDocs] = useState<Record<number, Record<string, DocumentStatus>>>({});
  const [isDocsLoading, setIsDocsLoading] = useState(false);
  const [isLoadingDetailedInfo, setIsLoadingDetailedInfo] = useState(false);
  const [isWaiverPending, setIsWaiverPending] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [showAadhaarModal, setShowAadhaarModal] = useState(false);
  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null);
  const [isAadhaarUploading, setIsAadhaarUploading] = useState(false);
  const [aaStatus, setAaStatus] = useState<Record<string, { status: string; loading: boolean }>>({});
  const [locationCoords, setLocationCoords] = useState<{ latitude: string; longitude: string } | null>(null);
  const [breQuestions, setBreQuestions] = useState<BreQuestion[]>([]);

  // Get location for upload
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationCoords({
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6),
          });
        },
        (error) => {
          console.warn('Location access denied:', error);
          // Fallback or handle error - for now we might proceed without or show error on upload
        }
      );
    }
  }, []);

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
        const wfState = successResponse.data?.workflow_state || successResponse.workflow_state;

        if (applicationDetails) {
          setDetailedInfo(applicationDetails);
          setWorkflowState(wfState);

          // Check payment status from detailed info
          if (applicationDetails.payment_result) {
            const status = String(applicationDetails.payment_result.state || '').toLowerCase();
            if (status === 'completed') {
              setPaymentStatus('Paid');
            } else if (status === 'failed' || status === 'cancelled') {
              setPaymentStatus('Failed');
            } else if (status === 'waived') {
              setPaymentStatus('Waived');
            }
            setIsPaymentStatusLoading(false);
          } else {
            setIsPaymentStatusLoading(false);
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
          setIsPaymentStatusLoading(false);
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
        } else if (normalizedState === 'waived') {
          nextStatus = 'Waived';
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

  useEffect(() => {
    // Show Aadhaar modal if Aadhaar is missing
    if (currentLead && applicantDocs) {
      const hasAadhaar = applicantDocs.aadhaar_card?.uploaded;
      const hasPan = applicantDocs.pan_card?.uploaded;

      if (!hasAadhaar) {
        setShowAadhaarModal(true);
        setShowKycModal(false);
      } else {
        setShowAadhaarModal(false);
        // If Aadhaar is uploaded, check for PAN
        if (!hasPan) {
          setShowKycModal(true);
        } else {
          setShowKycModal(false);
        }
      }
    }
  }, [currentLead, applicantDocs]);

  // Check for pending waiver in session storage
  useEffect(() => {
    if (!currentLead?.appId) return;

    const storageKey = `payment-state-${currentLead.appId}`;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.waiverStatus === 'pending') {
          setIsWaiverPending(true);
        }
      }
    } catch (e) {
      console.error('Failed to read payment state', e);
    }
  }, [currentLead?.appId]);

  // Fetch required documents status
  useEffect(() => {
    if (!currentLead?.appId) return;

    const fetchDocs = async () => {
      setIsDocsLoading(true);
      try {
        // Fetch Applicant Docs
        const appDocsRes = await getRequiredDocuments(currentLead.appId);
        if (!isApiError(appDocsRes)) {
          const data = (appDocsRes as any).required_documents || (appDocsRes as any).data?.required_documents;
          setApplicantDocs(data);
        }

        // Fetch Co-Applicant Docs
        if (detailedInfo?.participants) {
          const coApps = detailedInfo.participants.filter((p: any) => p.participant_type === 'co-applicant' || p.participant_type === 'co_applicant');
          const coAppDocsMap: Record<number, Record<string, DocumentStatus>> = {};

          await Promise.all(coApps.map(async (p: any) => {
            const idx = p.co_applicant_index;
            if (typeof idx === 'number') {
              const res = await getCoApplicantRequiredDocuments(currentLead.appId, idx);
              if (!isApiError(res)) {
                const data = (res as any).required_documents || (res as any).data?.required_documents;
                coAppDocsMap[idx] = data;
              }
            }
          }));
          setCoApplicantDocs(coAppDocsMap);
        }
      } catch (e) {
        console.error('Failed to fetch document statuses', e);
      } finally {
        setIsDocsLoading(false);
      }
    };

    fetchDocs();
  }, [currentLead?.appId, detailedInfo]);

  // Fetch BRE questions to determine Risk & Eligibility status
  useEffect(() => {
    if (!currentLead?.appId) {
      setBreQuestions([]);
      return;
    }

    const fetchBreQuestions = async () => {
      try {
        const response = await getBreQuestions(currentLead.appId);
        if (!isApiError(response) && response.success) {
          const responseData = (response as any).data || response;
          const questionsData = Array.isArray(responseData) ? responseData : (responseData.data || []);
          setBreQuestions(questionsData);
        } else {
          setBreQuestions([]);
        }
      } catch (error) {
        console.error('Failed to fetch BRE questions', error);
        setBreQuestions([]);
      }
    };

    fetchBreQuestions();
  }, [currentLead?.appId]);

  useEffect(() => {
    if (!currentLead?.appId) return;

    const fetchAaStatus = async () => {
      // Primary
      try {
        const res = await getAccountAggregatorStatus(currentLead.appId);
        if (!isApiError(res)) {
          setAaStatus(prev => ({ ...prev, primary: { status: res.status || 'PENDING', loading: false } }));
        } else {
          setAaStatus(prev => ({ ...prev, primary: { status: 'NOT_INITIATED', loading: false } }));
        }
      } catch {
        setAaStatus(prev => ({ ...prev, primary: { status: 'NOT_INITIATED', loading: false } }));
      }

      // Co-Applicants
      if (apiCoApplicants.length > 0) {
        apiCoApplicants.forEach(async (coApp) => {
          try {
            const res = await getCoApplicantAccountAggregatorStatus(currentLead.appId, coApp.index);
            if (!isApiError(res)) {
              setAaStatus(prev => ({ ...prev, [`coapplicant_${coApp.index}`]: { status: res.status || 'PENDING', loading: false } }));
            } else {
              setAaStatus(prev => ({ ...prev, [`coapplicant_${coApp.index}`]: { status: 'NOT_INITIATED', loading: false } }));
            }
          } catch {
            setAaStatus(prev => ({ ...prev, [`coapplicant_${coApp.index}`]: { status: 'NOT_INITIATED', loading: false } }));
          }
        });
      }
    };

    fetchAaStatus();
  }, [currentLead?.appId, apiCoApplicants]);

  const handleAaAction = async (action: 'initiate' | 'resend' | 'refresh', type: 'primary' | 'coapplicant', index?: number) => {
    if (!currentLead?.appId) return;

    const key = type === 'primary' ? 'primary' : `coapplicant_${index}`;
    setAaStatus(prev => ({ ...prev, [key]: { ...prev[key] || { status: 'NOT_INITIATED' }, loading: true } }));

    try {
      let response;
      if (type === 'primary') {
        if (action === 'initiate') response = await initiateAccountAggregator(currentLead.appId);
        else if (action === 'resend') response = await resendAccountAggregatorConsent(currentLead.appId);
        else if (action === 'refresh') response = await getAccountAggregatorStatus(currentLead.appId);
      } else if (typeof index === 'number') {
        if (action === 'initiate') response = await initiateCoApplicantAccountAggregator(currentLead.appId, index);
        else if (action === 'resend') response = await resendCoApplicantAccountAggregatorConsent(currentLead.appId, index);
        else if (action === 'refresh') response = await getCoApplicantAccountAggregatorStatus(currentLead.appId, index);
      }

      if (response && !isApiError(response)) {
        if (action === 'initiate') {
          toast({ title: 'Success', description: 'Account Aggregator flow initiated successfully.', className: 'bg-green-50 border-green-200' });
          setAaStatus(prev => ({ ...prev, [key]: { status: 'PENDING', loading: false } }));
        } else if (action === 'resend') {
          toast({ title: 'Success', description: 'Consent SMS resent successfully.', className: 'bg-green-50 border-green-200' });
          setAaStatus(prev => ({ ...prev, [key]: { ...prev[key], loading: false } }));
        } else if (action === 'refresh') {
          const status = response.status || 'PENDING';
          setAaStatus(prev => ({ ...prev, [key]: { status: status, loading: false } }));
          if (status === 'COMPLETED' || status === 'COMPLETE' || status === 'SUCCESS') {
            toast({ title: 'Completed', description: 'Account Aggregator flow completed.', className: 'bg-green-50 border-green-200' });
          } else {
            toast({ title: 'Status Updated', description: `Current status: ${status}` });
          }
        }
      } else {
        throw new Error(response?.error || 'Action failed');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to perform action', variant: 'destructive' });
      setAaStatus(prev => ({ ...prev, [key]: { ...prev[key], loading: false } }));
    }
  };

  const handleKycModalAction = (action: 'aadhaar' | 'pan' | 'skip') => {
    if (action === 'skip') {
      setShowKycModal(false);
    } else if (action === 'aadhaar') {
      router.push('/lead/documents?preselect=aadhaar');
    } else if (action === 'pan') {
      router.push('/lead/documents?preselect=pan');
    }
  };

  const handleAadhaarUpload = async () => {
    if (!aadhaarFront || !aadhaarBack || !currentLead?.appId) return;

    if (!locationCoords) {
      toast({
        title: "Location Required",
        description: "Please allow location access to upload documents.",
        variant: "destructive"
      });
      return;
    }

    setIsAadhaarUploading(true);
    try {
      const response = await uploadDocument({
        application_id: currentLead.appId,
        document_type: 'aadhaar_card',
        front_file: aadhaarFront,
        back_file: aadhaarBack,
        document_name: 'Aadhaar Card',
        latitude: locationCoords.latitude,
        longitude: locationCoords.longitude
      });

      if (isApiError(response) || !response.success) {
        throw new Error(response.error || 'Upload failed');
      }

      toast({
        title: 'Success',
        description: 'Aadhaar card uploaded successfully.',
        className: 'bg-green-50 border-green-200'
      });

      // Refresh docs status
      const appDocsRes = await getRequiredDocuments(currentLead.appId);
      if (!isApiError(appDocsRes)) {
        const data = (appDocsRes as any).required_documents || (appDocsRes as any).data?.required_documents;
        setApplicantDocs(data);
      }

      setShowAadhaarModal(false);
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload Aadhaar card.',
        variant: 'destructive'
      });
    } finally {
      setIsAadhaarUploading(false);
    }
  };

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

  // Count uploaded documents from required-documents API
  const uploadedDocumentsCount = useMemo(() => {
    let count = 0;
    
    // Count applicant documents
    if (applicantDocs) {
      count += Object.entries(applicantDocs).filter(([_, status]) => status.uploaded === true).length;
    }
    
    // Count co-applicant documents
    if (coApplicantDocs) {
      Object.values(coApplicantDocs).forEach((docs) => {
        if (docs) {
          count += Object.entries(docs).filter(([_, status]) => status.uploaded === true).length;
        }
      });
    }
    
    return count;
  }, [applicantDocs, coApplicantDocs]);

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
      // Require Name AND Mobile AND (PAN OR DOB) for completion
      if (personalInfo.full_name?.value && personalInfo.mobile_number?.value && (personalInfo.pan_number?.value || personalInfo.date_of_birth?.value)) {
        return 'completed';
      }
      // If we have some data but not all, return in-progress
      if (personalInfo.full_name?.value || personalInfo.mobile_number?.value || personalInfo.pan_number?.value) {
        return 'in-progress';
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
  // All four sections (Basic Details, Address Details, Employment Details, Account Aggregator) must be completed
  const getApplicantDetailsStatus = (): SectionStatus => {
    if (!currentLead) return 'incomplete';

    // Get status for each section
    const step2Status = getStep2Status();
    const step3Status = getStep3Status();
    const employmentStatus = getEmploymentStatus();
    
    // Check Account Aggregator status
    const isAACompleted = aaStatus.primary?.status === 'COMPLETED' || 
                         aaStatus.primary?.status === 'COMPLETE' || 
                         aaStatus.primary?.status === 'SUCCESS' || 
                         aaStatus.primary?.status === 'FAILED';

    // All four sections must be completed
    if (step2Status === 'completed' && 
        step3Status === 'completed' && 
        employmentStatus === 'completed' && 
        isAACompleted) {
      return 'completed';
    }

    // If any section has been started, mark as in-progress
    if (step2Status !== 'incomplete' || 
        step3Status !== 'incomplete' || 
        employmentStatus !== 'incomplete' || 
        isAACompleted) {
    return 'in-progress';
    }

    return 'incomplete';
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

    // If we have collateral details from API
    if (detailedInfo?.collateral_details) {
      const { estimated_property_value, collateral_type, ownership_type } = detailedInfo.collateral_details;

      // If we have a value > 0, consider it completed (as it implies successful submission)
      if (estimated_property_value && Number(estimated_property_value) > 0) {
        return 'completed';
      }

      // If we have some data but value is 0, it's in progress
      if (collateral_type || ownership_type) {
        return 'in-progress';
      }

      // If object exists but empty, fall through to local check
    }

    const step6 = currentLead.formData?.step6;
    if (!step6) return 'incomplete';

    const hasRequiredFields = step6.collateralType &&
      (step6.collateralType !== 'property' || step6.collateralSubType) &&
      step6.ownershipType &&
      step6.propertyValue;

    if (hasRequiredFields) return 'in-progress';
    if (step6.collateralType || step6.ownershipType || step6.propertyValue) return 'in-progress';
    return 'incomplete';
  };

  const getLoanRequirementStatus = (): SectionStatus => {
    if (!currentLead) return 'incomplete';

    // If we have loan details from API
    if (detailedInfo?.loan_details) {
      const { loan_amount_requested, loan_purpose } = detailedInfo.loan_details;

      // If we have amount > 0, consider it completed
      if (loan_amount_requested && Number(loan_amount_requested) > 0) {
        return 'completed';
      }

      // If we have purpose but 0 amount, it's in progress
      if (loan_purpose) {
        return 'in-progress';
      }

      // If object exists but empty, fall through to local check
    }

    const step7 = currentLead.formData?.step7;
    if (!step7) return 'incomplete';

    const hasRequiredFields = step7.loanAmount > 0 &&
      step7.loanPurpose &&
      step7.sourcingChannel &&
      step7.interestRate &&
      step7.tenure;

    if (hasRequiredFields) return 'in-progress';
    if (step7.loanAmount > 0 || step7.loanPurpose || step7.sourcingChannel || step7.interestRate || step7.tenure) return 'in-progress';
    return 'incomplete';
  };

  const getRiskEligibilityStatus = (): SectionStatus => {
    if (!currentLead?.appId) return 'incomplete';

    // If we have BRE questions, check if all are answered
    if (breQuestions.length > 0) {
      const allAnswered = breQuestions.every(q => q.status === 'answered');
      if (allAnswered) {
        return 'completed';
      }
      // If there are questions but not all answered, it's in progress
      return 'in-progress';
    }

    // If no questions exist, it's incomplete
    return 'incomplete';
  };

  const getEmploymentStatus = (): SectionStatus => {
    if (!currentLead) return 'incomplete';

    // If we have employment details from API, consider it completed
    // @ts-ignore - employment_details might not be in the strict type definition yet
    if (primaryParticipant?.employment_details) {
      // @ts-ignore
      const { occupation_type } = primaryParticipant.employment_details;
      if (occupation_type) {
        return 'completed';
      }
    }

    const step5 = currentLead.formData?.step5;
    if (!step5 || !step5.occupationType) return 'incomplete';

    // Check if required fields are filled based on occupation type
    switch (step5.occupationType) {
      case 'others':
        if (step5.natureOfOccupation) return 'in-progress';
        return 'in-progress';
      case 'salaried':
        const salariedValid = step5.employerName && step5.natureOfBusiness && step5.industry && step5.employmentStatus && step5.employedFrom;
        if (step5.employmentStatus === 'past' && !step5.employedTo) return 'in-progress';
        return salariedValid ? 'in-progress' : 'in-progress';
      case 'self-employed-non-professional':
        const senpValid = step5.orgNameSENP && step5.natureOfBusinessSENP && step5.industrySENP && step5.yearsInProfessionSENP && step5.monthsInProfessionSENP;
        return senpValid ? 'in-progress' : 'in-progress';
      case 'self-employed-professional':
        const sepValid = step5.orgNameSEP && step5.natureOfProfession && step5.industrySEP && step5.registrationNumber && step5.yearsInProfessionSEP && step5.monthsInProfessionSEP;
        return sepValid ? 'in-progress' : 'in-progress';
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
      case 'Waived':
        return <Badge className={cn(baseClasses, "bg-blue-100 border-blue-200 text-blue-700")}>Waived</Badge>;
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

  const isPaymentCompleted = paymentStatus === 'Paid' || paymentStatus === 'Waived' || isWaiverPending;
  const paymentStepStatus: SectionStatus = isPaymentCompleted ? 'completed' : paymentStatus === 'Failed' ? 'in-progress' : 'in-progress';
  const documentsStepStatus: SectionStatus = areAllDocumentsUploaded
    ? 'completed'
    : uploadedDocumentsCount > 0
      ? 'in-progress'
      : 'incomplete';
  const isDocumentsCompleted = documentsStepStatus === 'completed';

  const isCoApplicantStepCompleted = hasCoApplicants ? coApplicantStatus === 'completed' : true;
  const employmentStatus = currentLead ? getEmploymentStatus() : 'incomplete';

  const isAllOtherStepsCompleted =
    applicantStatus === 'completed' &&
    paymentStepStatus === 'completed' &&
    documentsStepStatus === 'completed' &&
    loanStatus === 'completed' &&
    isCoApplicantStepCompleted &&
    employmentStatus === 'completed';

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
        title="Application Hub"
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

  const tileWrapperClass =
    'flex flex-row items-start justify-between gap-3 border-b border-gray-100 pb-4 mb-4 last:border-0 last:mb-0';
  const tileButtonClass =
    'border-blue-600 text-blue-600 hover:bg-blue-50 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent';

  const renderSectionStatusPill = (status: SectionStatus) => {
    const base = 'rounded-full text-[10px] font-semibold px-3 py-0.5 border';
    switch (status) {
      case 'completed':
        return <Badge className={`${base} bg-green-100 border-green-200 text-green-700`}>Completed</Badge>;
      case 'in-progress':
        return <Badge className={`${base} bg-yellow-100 border-yellow-200 text-yellow-700`}>In Progress</Badge>;
      default:
        return <Badge className={`${base} bg-gray-100 border-gray-200 text-gray-600`}>No Data</Badge>;
    }
  };

  const renderBasicDetailsTile = () => {
    const hasDetails = step2Status !== 'incomplete' && (primaryParticipant || currentLead);
    const showPanVerifiedPill =
      hasDetails &&
      (applicantDocs?.pan_card?.uploaded ||
        currentLead?.formData?.step2?.autoFilledViaPAN ||
        Boolean(primaryParticipant?.personal_info?.pan_number?.verified));

    return (
      <div className="border-b border-gray-300 pb-4 mb-4 last:border-0 last:mb-0">
        {/* Title with Badge */}
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-gray-900">Basic Details</h3>
          {showPanVerifiedPill && (
            <Badge className="rounded-full bg-white border border-green-200 text-green-700 text-[10px] px-2.5 py-0.5 font-medium whitespace-nowrap">
              Verified via PAN
            </Badge>
          )}
            </div>

        {/* Fields */}
              {hasDetails ? (
          <div className="space-y-1 mb-4">
                  {(() => {
                    const fullName = primaryParticipant?.personal_info?.full_name;
                    const nameValue = fullName?.value || (typeof fullName === 'string' ? fullName : null);
                    const displayName =
                      nameValue ||
                      (currentLead?.customerFirstName || currentLead?.customerLastName
                        ? [currentLead?.customerFirstName, currentLead?.customerLastName].filter(Boolean).join(' ')
                        : null);
                    const isVerified = fullName?.verified || currentLead?.formData?.step2?.autoFilledViaPAN;

                    if (!displayName) return null;
                    return (
                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                  <div className="w-5 flex items-center justify-start">
                    {isVerified && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                  </div>
                  <span className="font-semibold text-gray-700 text-sm">Name:</span>
                  <span className="text-gray-900 text-sm">{displayName}</span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const dob = primaryParticipant?.personal_info?.date_of_birth;
                    const dobValue = dob?.value || (typeof dob === 'string' ? dob : null) || currentLead?.dob;
                    const isVerified = dob?.verified || currentLead?.formData?.step2?.autoFilledViaPAN;

                    if (!dobValue) return null;
                    const dobDate = new Date(dobValue);
                    const formatted = isNaN(dobDate.getTime())
                      ? dobValue
                      : dobDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

                    return (
                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                  <div className="w-5 flex items-center justify-start">
                    {isVerified && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                  </div>
                  <span className="font-semibold text-gray-700 text-sm">Date of Birth:</span>
                  <span className="text-gray-900 text-sm">{formatted}</span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const pan = primaryParticipant?.personal_info?.pan_number;
                    const panValue = pan?.value || (typeof pan === 'string' ? pan : null) || currentLead?.panNumber;
                    const isVerified = pan?.verified || currentLead?.formData?.step2?.autoFilledViaPAN;

                    if (panValue) {
                      return (
                  <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                    <div className="w-5 flex items-center justify-start">
                      {isVerified && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                    </div>
                    <span className="font-semibold text-gray-700 text-sm">PAN Number:</span>
                    <span className="text-gray-900 text-sm">{panValue}</span>
                        </div>
                      );
                    }

                    const step2 = currentLead?.formData?.step2;
                    if (step2?.hasPan === 'no' && step2?.alternateIdType && step2?.documentNumber) {
                      return (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700 text-sm">{step2.alternateIdType}</span>
                    <span className="text-gray-900 text-sm">{step2.documentNumber}</span>
                  </div>
                      );
                    }
                    return null;
                  })()}
                  {(() => {
                    const mobile = primaryParticipant?.personal_info?.mobile_number;
                    const mobileValue = mobile?.value || (typeof mobile === 'string' ? mobile : null) || currentLead?.customerMobile;
                    const isVerified = mobile?.verified;

                    if (!mobileValue) return null;
                    return (
                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                  <div className="w-5 flex items-center justify-start">
                    {isVerified && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                  </div>
                  <span className="font-semibold text-gray-700 text-sm">Mobile Number:</span>
                  <span className="text-gray-900 text-sm">{mobileValue}</span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const gender = primaryParticipant?.personal_info?.gender || currentLead?.gender;
                    if (!gender) return null;
                    return (
                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                  <div className="w-5"></div>
                  <span className="font-semibold text-gray-700 text-sm">Gender:</span>
                  <span className="text-gray-900 text-sm">{gender.charAt(0).toUpperCase() + gender.slice(1)}</span>
                </div>
                    );
                  })()}
                </div>
              ) : (
          <div className="space-y-1 mb-4">
                  <p className="font-semibold text-gray-900 text-sm">No basic details added yet</p>
                  <p className="text-xs text-gray-500">Upload PAN to auto-fill Name, DOB & PAN Number</p>
                </div>
              )}

        {/* Information Box */}
        {hasDetails && (currentLead?.formData?.step2?.autoFilledViaPAN || primaryParticipant?.personal_info?.pan_number?.verified) && (
          <div className="bg-blue-50 rounded-lg p-3 flex gap-3 mb-4">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">Auto-filled and verified via PAN & NSDL workflow</p>
          </div>
        )}

        {/* Edit Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/lead/basic-details')}
              className={tileButtonClass}
            >
              Edit
            </Button>
      </div>
    );
  };

  const renderAddressDetailsTile = () => {
    const hasDetails =
      step3Status !== 'incomplete' &&
      ((primaryParticipant?.addresses && primaryParticipant.addresses.length > 0) ||
        (currentLead?.formData?.step3?.addresses && currentLead.formData.step3.addresses.length > 0));
    const apiAddresses = primaryParticipant?.addresses || [];
    const formAddresses = currentLead?.formData?.step3?.addresses || [];
    const showAadhaarVerifiedPill = Boolean(
      applicantDocs?.aadhaar_card?.uploaded ||
      currentLead?.formData?.step3?.autoFilledViaAadhaar ||
      formAddresses.some((addr: any) => addr?.autoFilledViaAadhaar) ||
      apiAddresses.some((addr: any) => addr?.autoFilledViaAadhaar || addr?.auto_filled_via_aadhaar)
    );

    // Get primary address (residential/current address)
                  const addressesToShow =
                    apiAddresses.length > 0
                      ? apiAddresses.map((addr) => ({
                        address_line_1: addr.address_line_1,
          address_line_2: addr.address_line_2,
          address_line_3: addr.address_line_3,
                        pincode: addr.pincode,
                        is_primary: addr.is_primary,
          address_type: addr.address_type,
                      }))
                      : formAddresses.map((addr: any) => ({
                        address_line_1: addr.addressLine1,
          address_line_2: addr.addressLine2,
          address_line_3: addr.addressLine3,
                        pincode: addr.postalCode,
                        is_primary: addr.isPrimary,
          address_type: addr.addressType,
                      }));

    const primaryAddress = addressesToShow.find((addr: any) => 
      addr.is_primary || addr.address_type === 'residential' || addr.address_type === 'current'
    ) || addressesToShow[0];

                  return (
      <div className="border-b border-gray-300 pb-4 mb-4 last:border-0 last:mb-0">
        {/* Title with Badge */}
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-gray-900">Address Details</h3>
          {showAadhaarVerifiedPill && (
            <Badge className="rounded-full bg-white border border-green-200 text-green-700 text-[10px] px-2.5 py-0.5 font-medium whitespace-nowrap">
              Verified via Aadhaar
            </Badge>
          )}
        </div>

        {/* Fields */}
        {hasDetails && primaryAddress ? (
          <div className="space-y-1 mb-4">
                      {primaryAddress.address_line_1 && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Address Line 1:</span>
                <span className="text-gray-900 text-sm">{primaryAddress.address_line_1}</span>
                        </div>
                      )}
            {primaryAddress.address_line_2 && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Address Line 2:</span>
                <span className="text-gray-900 text-sm">{primaryAddress.address_line_2}</span>
              </div>
            )}
            {primaryAddress.address_line_3 && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Address Line 3:</span>
                <span className="text-gray-900 text-sm">{primaryAddress.address_line_3}</span>
                        </div>
                      )}
                      {primaryAddress.pincode && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Pincode:</span>
                <span className="text-gray-900 text-sm">{primaryAddress.pincode}</span>
                        </div>
                      )}
              </div>
            ) : (
          <div className="space-y-1 mb-4">
                <p className="font-semibold text-gray-900 text-sm">Address details</p>
                <p className="text-xs text-gray-500">Upload Aadhaar to auto-fill address</p>
              </div>
            )}

        {/* Information Box */}
        {hasDetails && showAadhaarVerifiedPill && (
          <div className="bg-blue-50 rounded-lg p-3 flex gap-3 mb-4">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">Auto-filled and verified via Aadhaar OCR workflow</p>
          </div>
        )}

        {/* Edit Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/lead/address-details')}
            className={tileButtonClass}
          >
            Edit
          </Button>
      </div>
    );
  };

  const renderEmploymentDetailsTile = () => {
    const employmentStatus = getEmploymentStatus();
    // Check if we have API details or form data
    const apiEmploymentDetails = primaryParticipant?.employment_details;
    const formEmploymentDetails = currentLead?.formData?.step5;

    const hasDetails = employmentStatus !== 'incomplete' && (apiEmploymentDetails || formEmploymentDetails);
    const isCompleted = employmentStatus === 'completed';

                  // Prioritize API data
                  const data = apiEmploymentDetails || formEmploymentDetails;
                  const occupationType = apiEmploymentDetails ? apiEmploymentDetails.occupation_type : formEmploymentDetails?.occupationType;

                  const occupationTypeLabels: Record<string, string> = {
                    salaried: 'Salaried',
                    'self-employed-non-professional': 'Self Employed Non Professional',
                    'self-employed-professional': 'Self Employed Professional',
                    others: 'Others',
                  };

    const displayOccupation = occupationType ? (occupationTypeLabels[occupationType] || occupationType) : null;

    // Format monthly income
    const formatMonthlyIncome = (income: string | number | undefined): string => {
      if (!income) return '';
      const numValue = typeof income === 'string' ? parseFloat(income) : income;
      if (isNaN(numValue)) return '';
      return `₹${numValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const monthlyIncome = apiEmploymentDetails?.monthly_income || formEmploymentDetails?.monthlyIncome;
    const formattedIncome = formatMonthlyIncome(monthlyIncome);

    // Format date
    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toISOString().split('T')[0];
      } catch {
        return dateStr;
      }
    };

    const employedFrom = apiEmploymentDetails?.employed_from || formEmploymentDetails?.employedFrom;
    const formattedEmployedFrom = formatDate(employedFrom);

                  return (
      <div className="border-b border-gray-300 pb-4 mb-4 last:border-0 last:mb-0">
        {/* Title with Badge */}
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-gray-900">Employment Details</h3>
          {isCompleted && (
            <Badge className="rounded-full bg-green-100 border border-green-200 text-green-700 text-[10px] px-2.5 py-0.5 font-medium whitespace-nowrap">
              Completed
            </Badge>
          )}
        </div>

        {/* Fields */}
        {hasDetails && data ? (
          <div className="space-y-1 mb-4">
            {displayOccupation && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Occupation:</span>
                <span className="text-gray-900 text-sm">{displayOccupation}</span>
              </div>
            )}
            {(apiEmploymentDetails?.organization_name || formEmploymentDetails?.employerName || formEmploymentDetails?.orgNameSENP || formEmploymentDetails?.orgNameSEP) && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Company:</span>
                <span className="text-gray-900 text-sm">
                  {apiEmploymentDetails?.organization_name || formEmploymentDetails?.employerName || formEmploymentDetails?.orgNameSENP || formEmploymentDetails?.orgNameSEP}
                </span>
              </div>
            )}
            {(apiEmploymentDetails?.designation || formEmploymentDetails?.designation) && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Designation:</span>
                <span className="text-gray-900 text-sm">
                  {apiEmploymentDetails?.designation || formEmploymentDetails?.designation}
                </span>
              </div>
            )}
            {formattedIncome && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Monthly Income:</span>
                <span className="text-gray-900 text-sm">{formattedIncome}</span>
              </div>
            )}
            {formattedEmployedFrom && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Employed From:</span>
                <span className="text-gray-900 text-sm">{formattedEmployedFrom}</span>
              </div>
            )}
            {(apiEmploymentDetails?.nature_of_occupation || formEmploymentDetails?.natureOfOccupation) && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Nature:</span>
                <span className="text-gray-900 text-sm">
                  {(apiEmploymentDetails?.nature_of_occupation || formEmploymentDetails?.natureOfOccupation).charAt(0).toUpperCase() + (apiEmploymentDetails?.nature_of_occupation || formEmploymentDetails?.natureOfOccupation).slice(1)}
                </span>
              </div>
            )}
              </div>
            ) : (
          <div className="space-y-1 mb-4">
            <p className="font-semibold text-gray-900 text-sm">Employment details</p>
                <p className="text-xs text-gray-500">Enter employment details</p>
              </div>
            )}

        {/* Edit Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/lead/employment-details')}
            className={tileButtonClass}
          >
            Edit
          </Button>
      </div>
    );
  };

  const renderAccountAggregatorTile = () => {
    const status = aaStatus.primary;
    const isCompleted = status?.status === 'COMPLETED' || status?.status === 'COMPLETE' || status?.status === 'SUCCESS';
    const isFailed = status?.status === 'FAILED';
    const isPending = status?.status === 'PENDING';

    return (
      <div className="border-b border-gray-300 pb-4 mb-4 last:border-0 last:mb-0">
        {/* Title with Badge */}
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-gray-900">Account Aggregator</h3>
          {isCompleted && (
            <Badge className="rounded-full bg-green-100 border border-green-200 text-green-700 text-[10px] px-2.5 py-0.5 font-medium whitespace-nowrap">
              Fetch Complete
            </Badge>
          )}
          {isFailed && (
            <Badge className="rounded-full bg-red-100 border border-red-200 text-red-700 text-[10px] px-2.5 py-0.5 font-medium whitespace-nowrap">
              Failed
            </Badge>
          )}
          {isPending && (
            <Badge className="rounded-full bg-yellow-100 border border-yellow-200 text-yellow-700 text-[10px] px-2.5 py-0.5 font-medium whitespace-nowrap">
              Pending
            </Badge>
          )}
          </div>

        {/* Success Message Box */}
        {isCompleted && (
          <div className="bg-green-50 rounded-lg p-3 flex gap-3 mb-4">
            <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-white" />
          </div>
            <p className="text-sm text-gray-700 leading-relaxed">Bank statement data received via Account Aggregator.</p>
        </div>
        )}

        {/* Error Message */}
        {isFailed && (
          <div className="bg-red-50 rounded-lg p-3 flex gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-gray-700 leading-relaxed">Account Aggregator verification failed</p>
          </div>
        )}

        {/* Pending Message */}
        {isPending && (
          <div className="bg-yellow-50 rounded-lg p-3 flex gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-gray-700 leading-relaxed">Verification Pending</p>
          </div>
        )}

        {/* No Status Message */}
        {!isCompleted && !isFailed && !isPending && (
          <div className="mb-4">
            <p className="text-xs text-gray-500">Initiate to fetch customer's bank statements digitally</p>
          </div>
        )}

        {/* Action Buttons */}
        {!isCompleted && (
            <div className="flex items-center gap-2">
            {isPending ? (
              <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAaAction('resend', 'primary')}
                disabled={status?.loading}
                className={tileButtonClass}
              >
                Resend
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleAaAction('refresh', 'primary')}
                disabled={status?.loading}
                className="h-8 w-8 text-gray-500 hover:text-blue-600"
              >
                <RefreshCw className={cn("w-4 h-4", status?.loading && "animate-spin")} />
              </Button>
              </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAaAction('initiate', 'primary')}
              disabled={status?.loading}
              className={tileButtonClass}
            >
              {status?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Initiate'}
            </Button>
          )}
        </div>
        )}
      </div>
    );
  };



  const isAadhaarUploaded = applicantDocs?.aadhaar_card?.uploaded;
  const isAACompleted = aaStatus.primary?.status === 'COMPLETED' || aaStatus.primary?.status === 'COMPLETE' || aaStatus.primary?.status === 'SUCCESS' || aaStatus.primary?.status === 'FAILED';
  const isEmploymentAndAACompleted = employmentStatus === 'completed' && isAACompleted;
  const shouldHideCards = isAadhaarUploaded && !isEmploymentAndAACompleted;

  const areAllDataCardsCompleted =
    step2Status === 'completed' &&
    step3Status === 'completed' &&
    employmentStatus === 'completed' &&
    isAACompleted &&
    isCoApplicantStepCompleted &&
    collateralStatus === 'completed' &&
    loanStatus === 'completed';

  return (
    <DashboardLayout
      title="Application Hub"
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto">
        {showAadhaarModal ? (
          <>
            <div className="p-4 pb-32">
              <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="p-0 space-y-6">


                  {/* Upload Card */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
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

                    <div className="bg-blue-50 rounded-lg p-3 flex gap-3 mb-6">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800 leading-relaxed">
                        Please upload your Aadhaar card to auto-fill address details and verify your identity.
                      </p>
                    </div>

                    <div className="space-y-6">
                      <h3 className="font-semibold text-gray-900">Aadhaar - {currentLead?.customerName || 'Applicant'}</h3>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Front Side */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-600 block">Front Side</label>
                          <div
                            onClick={() => document.getElementById('aadhaar-front-input')?.click()}
                            className={cn(
                              "aspect-[4/3] rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden",
                              aadhaarFront ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-blue-500 hover:bg-gray-50"
                            )}
                          >
                            <input
                              id="aadhaar-front-input"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) setAadhaarFront(e.target.files[0]);
                              }}
                            />
                            {aadhaarFront ? (
                              <div className="w-full h-full relative">
                                <img
                                  src={URL.createObjectURL(aadhaarFront)}
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
                              aadhaarBack ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-blue-500 hover:bg-gray-50"
                            )}
                          >
                            <input
                              id="aadhaar-back-input"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) setAadhaarBack(e.target.files[0]);
                              }}
                            />
                            {aadhaarBack ? (
                              <div className="w-full h-full relative">
                                <img
                                  src={URL.createObjectURL(aadhaarBack)}
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
                        disabled={!aadhaarFront || !aadhaarBack || isAadhaarUploading}
                        onClick={handleAadhaarUpload}
                      >
                        {isAadhaarUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Upload Aadhaar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {/* Instructions */}
                  <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                    <h4 className="text-sm font-bold text-blue-900 mb-3">How to upload:</h4>
                    <ul className="space-y-2">
                      <li className="text-xs text-blue-800 flex items-start gap-2">
                        <span className="font-medium">1.</span>
                        Ensure the photo is clear and text is readable.
                      </li>
                      <li className="text-xs text-blue-800 flex items-start gap-2">
                        <span className="font-medium">2.</span>
                        Capture both front and back sides of the card.
                      </li>
                    </ul>
                  </div>

                </CardContent>
              </Card>
            </div>
            {/* Fixed Back to Dashboard Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 z-20">
              <div className="flex gap-3 max-w-2xl mx-auto">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-lg font-medium border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={() => router.push('/leads')}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="grid grid-cols-2 gap-0.5">
                      <div className="w-1.5 h-1.5 bg-current rounded-[1px]"></div>
                      <div className="w-1.5 h-1.5 bg-current rounded-[1px]"></div>
                      <div className="w-1.5 h-1.5 bg-current rounded-[1px]"></div>
                      <div className="w-1.5 h-1.5 bg-current rounded-[1px]"></div>
                    </div>
                    Back to Dashboard
                  </div>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="pb-32 px-2 sm:px-3 pt-4">
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
                  className="w-full h-14 bg-[#0072CE] hover:bg-[#005a9e] text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Add a Document
                </Button>
              </div>

              {/* Applicant Details Card */}
              <Card className={cn(
                "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
                applicantStatus === 'completed' ? "border-l-green-600" : "border-l-blue-600"
              )}>
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Applicant Details</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(applicantStatus)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {renderBasicDetailsTile()}
                    {renderAddressDetailsTile()}
                    {(!isAadhaarUploaded || (step2Status === 'completed' && step3Status === 'completed')) && renderEmploymentDetailsTile()}
                    {(!isAadhaarUploaded || (step2Status === 'completed' && step3Status === 'completed')) && renderAccountAggregatorTile()}
                  </div>

                  {/* Footer */}
                  {/* <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {uploadedDocuments.length === 0 ? 'No documents linked yet' : 
                   'Documents linked and verified'}
                </p>
              </div> */}
                </CardContent>
              </Card>

              {/* Co-Applicants Card */}
              <Card className={cn(
                "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
                hasCoApplicants && coApplicantStatus === 'completed' ? "border-l-green-600" : "border-l-blue-600",
                shouldHideCards && "hidden"
              )}>
                <CardContent className="p-4 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Co-Applicant(s)</h3>
                    </div>
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">No co-applicants added yet</p>
                          <p className="text-xs text-gray-500">Add a co-applicant to continue joint application processing</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/lead/co-applicant-info')}
                        className={tileButtonClass}
                      >
                        Manage
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {coApplicantCount} co-applicant{coApplicantCount > 1 ? 's' : ''} added
                            </p>
                            <p className="text-xs text-gray-500">
                              Manage details and documents for each co-applicant.
                            </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push('/lead/co-applicant-info')}
                          className={tileButtonClass}
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
                            const key = `coapplicant_${index}`;
                            const status = aaStatus[key];
                            const isCompleted = status?.status === 'COMPLETED' || status?.status === 'COMPLETE' || status?.status === 'SUCCESS';
                            const isPending = status?.status === 'PENDING';

                            return (
                              <div
                                key={`co-applicant-${index}`}
                                className="rounded-lg border border-gray-200 bg-white p-4"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm font-medium text-gray-900">{`Co-Applicant ${index + 1} – ${name}`}</span>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-gray-400" />
                                    <div className="flex flex-col">
                                      <span className="text-xs text-gray-600">Account Aggregator</span>
                                      {isCompleted && <span className="text-[10px] text-green-600">Fetched successfully</span>}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isCompleted ? (
                                      <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Completed</Badge>
                                    ) : isPending ? (
                                      <>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleAaAction('resend', 'coapplicant', index)} disabled={status?.loading}>Resend</Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAaAction('refresh', 'coapplicant', index)} disabled={status?.loading}>
                                          <RefreshCw className={cn("w-3 h-3", status?.loading && "animate-spin")} />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button variant="outline" size="sm" className="h-7 text-xs border-blue-600 text-blue-600" onClick={() => handleAaAction('initiate', 'coapplicant', index)} disabled={status?.loading}>
                                        {status?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Initiate'}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        {apiCoApplicants.length > 0 && !detailedInfo?.participants && (
                          // Fallback to simple list if detailed info not available
                          apiCoApplicants.map((coApp) => {
                            const key = `coapplicant_${coApp.index}`;
                            const status = aaStatus[key];
                            const isCompleted = status?.status === 'COMPLETED' || status?.status === 'COMPLETE' || status?.status === 'SUCCESS';
                            const isPending = status?.status === 'PENDING';

                            return (
                              <div
                                key={`co-applicant-${coApp.index}`}
                                className="rounded-lg border border-gray-200 bg-white p-4"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm font-medium text-gray-900">{`Co-Applicant ${coApp.index + 1} – ${coApp.name}`}</span>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-gray-400" />
                                    <div className="flex flex-col">
                                      <span className="text-xs text-gray-600">Account Aggregator</span>
                                      {isCompleted && <span className="text-[10px] text-green-600">Fetched successfully</span>}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isCompleted ? (
                                      <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Completed</Badge>
                                    ) : isPending ? (
                                      <>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleAaAction('resend', 'coapplicant', coApp.index)} disabled={status?.loading}>Resend</Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAaAction('refresh', 'coapplicant', coApp.index)} disabled={status?.loading}>
                                          <RefreshCw className={cn("w-3 h-3", status?.loading && "animate-spin")} />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button variant="outline" size="sm" className="h-7 text-xs border-blue-600 text-blue-600" onClick={() => handleAaAction('initiate', 'coapplicant', coApp.index)} disabled={status?.loading}>
                                        {status?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Initiate'}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })
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
                collateralStatus === 'completed' ? "border-l-green-600" : "border-l-blue-600",
                shouldHideCards && "hidden"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Home className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Collateral Details</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(collateralStatus)}
                    </div>
                  </div>

                  {/* Fields */}
                        {collateralStatus !== 'incomplete' && (detailedInfo?.collateral_details || currentLead?.formData?.step6) ? (
                      <div className="space-y-1 mb-4">
                            {(() => {
                              const collateral = detailedInfo?.collateral_details;
                              const step6 = currentLead?.formData?.step6;

                              const collateralType = collateral?.collateral_type || step6?.collateralType || '';
                          const ownershipType = collateral?.ownership_type || step6?.ownershipType || '';
                              const value = collateral?.estimated_property_value || step6?.propertyValue || 0;
                          const description = collateral?.collateral_description || step6?.description || '';

                          // Format value
                              const formattedValue = typeof value === 'string'
                            ? parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                          // Get location
                          const location = collateral?.location || collateral?.address || step6?.location;
                          const locationParts = [];
                          if (location?.address_line_1) locationParts.push(location.address_line_1);
                          if (location?.address_line_2) locationParts.push(location.address_line_2);
                          if (location?.address_line_3) locationParts.push(location.address_line_3);
                          if (location?.pincode) locationParts.push(location.pincode);
                          const locationString = locationParts.length > 0 ? locationParts.join(', ') : '';

                              return (
                            <>
                              {collateralType && (
                                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                  <div className="w-5"></div>
                                  <span className="font-semibold text-gray-700 text-sm">Collateral Type:</span>
                                  <span className="text-gray-900 text-sm">{collateralType}</span>
                                </div>
                              )}
                              {ownershipType && (
                                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                  <div className="w-5"></div>
                                  <span className="font-semibold text-gray-700 text-sm">Ownership Type:</span>
                                  <span className="text-gray-900 text-sm">
                                    {ownershipType === 'self_ownership' ? 'self_ownership' :
                                     ownershipType === 'joint_ownership' ? 'joint_ownership' :
                                     ownershipType}
                                  </span>
                                </div>
                              )}
                              {locationString && (
                                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                  <div className="w-5"></div>
                                  <span className="font-semibold text-gray-700 text-sm">Location:</span>
                                  <span className="text-gray-900 text-sm">{locationString}</span>
                              </div>
                            )}
                              {value && (
                                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                  <div className="w-5"></div>
                                  <span className="font-semibold text-gray-700 text-sm">Estimated Value:</span>
                                  <span className="text-gray-900 text-sm">₹ {formattedValue}</span>
                                </div>
                              )}
                              {description && (
                                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                  <div className="w-5"></div>
                                  <span className="font-semibold text-gray-700 text-sm">Description:</span>
                                  <span className="text-gray-900 text-sm">{description}</span>
                          </div>
                        )}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="space-y-1 mb-4">
                        <p className="font-semibold text-gray-900 text-sm">No property document uploaded</p>
                        <p className="text-xs text-gray-500">Upload or add property details manually</p>
                    </div>
                    )}

                    {/* Edit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/lead/collateral')}
                      className={tileButtonClass}
                    >
                      Edit
                    </Button>
                </CardContent>
              </Card>

              {/* Loan Requirement Card */}
              <Card className={cn(
                "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
                loanStatus === 'completed' ? "border-l-green-600" : "border-l-blue-600",
                shouldHideCards && "hidden"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Loan Requirement</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(loanStatus)}
                    </div>
                  </div>

                  {/* Fields */}
                        {loanStatus !== 'incomplete' && (detailedInfo?.loan_details || currentLead?.formData?.step7) ? (
                      <div className="space-y-1 mb-4">
                            {(() => {
                              const loanDetails = detailedInfo?.loan_details;
                              const step7 = currentLead?.formData?.step7;

                              const amount = loanDetails?.loan_amount_requested || step7?.loanAmount || currentLead?.loanAmount || 0;
                              const formattedAmount = typeof amount === 'string'
                            ? parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                              const tenureMonths = loanDetails?.tenure_months || step7?.tenure || 0;
                              const purpose = loanDetails?.loan_purpose || step7?.loanPurpose || currentLead?.loanPurpose || '';

                              return (
                                <>
                              {amount > 0 && (
                                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                  <div className="w-5"></div>
                                  <span className="font-semibold text-gray-700 text-sm">Loan Amount:</span>
                                  <span className="text-gray-900 text-sm">{formattedAmount}</span>
                                </div>
                              )}
                              {purpose && (
                                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                  <div className="w-5"></div>
                                  <span className="font-semibold text-gray-700 text-sm">Loan Purpose:</span>
                                  <span className="text-gray-900 text-sm">{purpose}</span>
                                </div>
                              )}
                              {tenureMonths > 0 && (
                                <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                  <div className="w-5"></div>
                                  <span className="font-semibold text-gray-700 text-sm">Tenure:</span>
                                  <span className="text-gray-900 text-sm">{tenureMonths} months</span>
                                </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                      <div className="space-y-1 mb-4">
                        <p className="font-semibold text-gray-900 text-sm">No loan requirement details available</p>
                        <p className="text-xs text-gray-500">Upload supporting docs or start manually</p>
                          </div>
                        )}

                    {/* Edit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/lead/loan-requirement')}
                      className={tileButtonClass}
                    >
                      Edit
                    </Button>
                </CardContent>
              </Card>

              {/* Risk & Eligibility Card */}
              <Card className={cn(
                "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4 border-l-blue-600",
                shouldHideCards && "hidden"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Risk & Eligibility</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderSectionStatusPill(getRiskEligibilityStatus())}
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-gray-900">
                            Pending Assessment
                          </p>
                          <p className="text-xs text-gray-500">
                            Complete application to view risk assessment
                          </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/lead/risk-eligibility')}
                      className={tileButtonClass}
                    >
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>



              {/* Payment Details Card */}
              <Card className={cn(
                "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
                isPaymentCompleted ? "border-l-green-600" : "border-l-blue-600",
                !areAllDataCardsCompleted && "hidden"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
                    </div>
                    <div className="flex items-center gap-2">
                    {renderPaymentStatusBadge()}
                    </div>
                  </div>

                  {isPaymentCompleted || isWaiverPending ? (
                    <div className="mb-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {paymentStatus === 'Waived' || isWaiverPending ? 'Payment Waiver Request' : 'Payment received successfully'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {paymentStatus === 'Waived'
                              ? 'Login fee has been waived.'
                              : isWaiverPending
                                ? 'Waiver request is in progress.'
                                : 'Login fee has been confirmed and recorded.'}
                          </p>
                      </div>
                      <Button
                        onClick={handleGeneratePaymentLink}
                        variant="outline"
                        className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
                      >
                        View Details
                      </Button>
                    </div>
                  ) : (
                    <>
                      {detailedInfo?.payment_result && (
                        <div className="mb-4 space-y-2 p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-gray-600">Amount:</span>
                            <span className="text-sm font-semibold text-gray-900">₹{detailedInfo.payment_result.amount?.toLocaleString('en-IN') || '0'}</span>
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

              {/* Documents Added Card */}
              <Card className={cn(
                "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4",
                documentsStepStatus === 'completed' ? "border-l-green-600" : "border-l-blue-600"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Documents Added</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "rounded-full border text-xs font-medium px-3 py-1",
                        uploadedDocumentsCount === 0 ? "bg-gray-50 border-gray-200 text-gray-600" : "bg-green-100 border-green-200 text-green-700"
                      )}>
                        {uploadedDocumentsCount === 0 ? 'No Files' : `${uploadedDocumentsCount} File(s)`}
                      </Badge>
                    </div>
                  </div>

                  {isDocsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span className="text-sm text-gray-500">Loading documents...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Applicant Section */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 mb-2">Applicant</h4>
                        <div className="space-y-1">
                          {applicantDocs && Object.entries(applicantDocs)
                            .filter(([key, status]) => status.uploaded && !key.startsWith('collateral_'))
                            .map(([key]) => (
                              <div key={key} className="flex items-center justify-between py-1 px-1">
                                <p className="text-sm text-gray-700">{DOC_LABELS[key] || key.replace(/_/g, ' ')}</p>
                                <CheckCircle className="w-5 h-5 text-green-600 fill-green-50" />
                              </div>
                            ))}
                          {(!applicantDocs || !Object.entries(applicantDocs).some(([key, status]) => status.uploaded && !key.startsWith('collateral_'))) && (
                            <p className="text-xs text-gray-500 italic pl-1">No documents uploaded</p>
                          )}
                        </div>
                      </div>

                      {/* Co-Applicants Section */}
                      {Object.keys(coApplicantDocs).length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-gray-800 mb-2 mt-4">Co-Applicant(s)</h4>
                          {Object.entries(coApplicantDocs).map(([indexStr, docs]) => {
                            const index = parseInt(indexStr);
                            const coAppName = detailedInfo?.participants?.find((p: any) => p.co_applicant_index === index)?.personal_info?.full_name?.value || `Co-Applicant ${index + 1}`;
                            const uploaded = Object.entries(docs).filter(([_, status]) => status.uploaded);

                            if (uploaded.length === 0) return null;

                            return (
                              <div key={index} className="mb-3 last:mb-0">
                                <p className="text-xs font-semibold text-gray-600 mb-1">{coAppName}</p>
                                <div className="space-y-1 pl-2 border-l-2 border-gray-100">
                                  {uploaded.map(([key]) => (
                                    <div key={key} className="flex items-center justify-between py-1 px-1">
                                      <p className="text-sm text-gray-700">{DOC_LABELS[key] || key.replace(/_/g, ' ')}</p>
                                      <CheckCircle className="w-5 h-5 text-green-600 fill-green-50" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Collateral Section */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 mb-2 mt-4">Collateral</h4>
                        <div className="space-y-1">
                          {(() => {
                            const collateralDocs = applicantDocs ? Object.entries(applicantDocs).filter(([key, status]) => status.uploaded && key.startsWith('collateral_')) : [];

                            const COLLATERAL_IMAGE_KEYS = [
                              'collateral_images_front',
                              'collateral_images_inside',
                              'collateral_images_road',
                              'collateral_images_selfie',
                              'collateral_images_side',
                              'collateral_images_surrounding'
                            ];

                            const hasAllImages = COLLATERAL_IMAGE_KEYS.every(key => applicantDocs?.[key]?.uploaded);

                            const otherCollateralDocs = collateralDocs.filter(([key]) => !COLLATERAL_IMAGE_KEYS.includes(key));

                            const hasAnyCollateral = hasAllImages || otherCollateralDocs.length > 0;

                            if (!hasAnyCollateral) {
                              return <p className="text-xs text-gray-500 italic pl-1">No collateral documents uploaded</p>;
                            }

                            return (
                              <>
                                {hasAllImages && (
                                  <div className="flex items-center justify-between py-1 px-1">
                                    <p className="text-sm text-gray-700">Property Images</p>
                                    <CheckCircle className="w-5 h-5 text-green-600 fill-green-50" />
                                  </div>
                                )}
                                {otherCollateralDocs.map(([key]) => (
                                  <div key={key} className="flex items-center justify-between py-1 px-1">
                                    <p className="text-sm text-gray-700">{DOC_LABELS[key] || key.replace(/_/g, ' ')}</p>
                                    <CheckCircle className="w-5 h-5 text-green-600 fill-green-50" />
                                  </div>
                                ))}
                              </>
                            );
                          })()}
                        </div>
                      </div>
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
                  disabled={!isPaymentCompleted}
                  className="flex-1 h-12 rounded-lg font-medium text-white bg-[#0072CE] hover:bg-[#005a9e]"
                >
                  Submit Application
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* KYC Modal */}
      <Dialog open={showKycModal} onOpenChange={setShowKycModal}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
          <div className="bg-gradient-to-b from-blue-50 to-white p-5 pb-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-1 shadow-inner">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-gray-900">Complete Your KYC</h2>
                <p className="text-xs text-gray-500 max-w-[240px] mx-auto leading-relaxed">
                  Upload your PAN card to verify your identity and speed up the application process.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3 px-2">
              {!applicantDocs?.pan_card?.uploaded && (
                <Button
                  onClick={() => handleKycModalAction('pan')}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Upload PAN Card
                </Button>
              )}

              <button
                onClick={() => handleKycModalAction('skip')}
                className="w-full py-2 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
              >
                I'll do this later
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout >
  );
}

