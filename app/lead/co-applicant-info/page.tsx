'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, MapPin, Trash2, Briefcase, Database, ChevronDown, ChevronUp, CheckCircle, AlertCircle, RefreshCw, Loader2, Info, Upload } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteCoApplicantFromApi, getDetailedInfo, isApiError, getCoApplicantRequiredDocuments, type ApiSuccess, type DocumentStatus, initiateCoApplicantAccountAggregator, resendCoApplicantAccountAggregatorConsent, getCoApplicantAccountAggregatorStatus } from '@/lib/api';

type SectionStatus = 'incomplete' | 'in-progress' | 'completed';

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: 'Spouse',
  father: 'Father',
  mother: 'Mother',
  son: 'Son',
  daughter: 'Daughter',
  brother: 'Brother',
  sister: 'Sister',
  friend: 'Friend',
  business_partner: 'Business Partner',
  other: 'Other',
  Father: 'Father',
  Mother: 'Mother',
  Sister: 'Sister',
  Brother: 'Brother',
  Husband: 'Spouse',
  Wife: 'Spouse',
  Son: 'Son',
  Daughter: 'Daughter',
  Partner: 'Friend',
  Friend: 'Friend',
  'Business Partner': 'Business Partner',
  Other: 'Other',
  Spouse: 'Spouse',
  'Father in Law': 'Father',
  'Mother in Law': 'Mother',
};

export default function CoApplicantInfoPage() {
  const { currentLead, deleteCoApplicant } = useLead();
  const router = useRouter();
  const { toast } = useToast();

  const coApplicants = currentLead?.formData?.coApplicants ?? [];
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const [requiredDocuments, setRequiredDocuments] = useState<Record<number, Record<string, DocumentStatus>>>({});

  const toggleCard = (index: number) => {
    setExpandedCards((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Interface for co-applicant data from detailed-info API
  interface CoApplicantFromDetailedInfo {
    co_applicant_index: number;
    personal_info?: {
      date_of_birth?: {
        value?: string;
        verified?: boolean;
      };
      email?: string | null;
      full_name?: {
        value?: string;
        verified?: boolean;
      };
      gender?: string | null;
      marital_status?: string | null;
      mobile_number?: {
        value?: string;
        verified?: boolean;
      };
      pan_number?: {
        value?: string;
        verified?: boolean;
      };
    };
    addresses?: Array<{
      address_line_1?: string;
      address_line_2?: string;
      address_line_3?: string;
      landmark?: string;
      pincode?: string;
      city?: string;
      state?: string;
      state_code?: string;
      address_type?: string;
      is_primary?: boolean;
      latitude?: string;
      longitude?: string;
    }>;
    employment_details?: any;
  }

  const [apiCoApplicants, setApiCoApplicants] = useState<CoApplicantFromDetailedInfo[]>([]);
  const [isLoadingCoApplicants, setIsLoadingCoApplicants] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
    index: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Account Aggregator status state
  const [aaStatus, setAaStatus] = useState<Record<string, { status: string; loading: boolean }>>({});

  // Fetch co-applicants from detailed-info API when page loads
  useEffect(() => {
    if (!currentLead?.appId) {
      setApiCoApplicants([]);
      return;
    }

    let isMounted = true;

    const fetchCoApplicants = async () => {
      setIsLoadingCoApplicants(true);
      try {
        const response = await getDetailedInfo(currentLead.appId!);
        if (!isMounted) return;

        let apiParticipants: any[] = [];
        if (!isApiError(response)) {
          const responseData = response.data ?? (response as any);
          const applicationDetails = responseData?.application_details ?? responseData;
          apiParticipants = applicationDetails?.participants ?? [];
        }

        // Map API participants to our internal structure
        const apiCoAppsMap = new Map<number, CoApplicantFromDetailedInfo>();
        apiParticipants.forEach((p: any) => {
          const pt = p?.participant_type as string;
          if ((pt === 'co-applicant' || pt === 'co_applicant') && typeof p?.co_applicant_index === 'number') {
            apiCoAppsMap.set(p.co_applicant_index, {
              co_applicant_index: p.co_applicant_index,
              personal_info: p.personal_info,
              addresses: p.addresses ?? [],
              employment_details: p.employment_details,
            });
          }
        });

        // Combine with local co-applicants
        // We prioritize local co-applicants list to ensure newly added ones show up
        const combinedList: CoApplicantFromDetailedInfo[] = coApplicants.map((localCoApp: any) => {
          const apiData = apiCoAppsMap.get(localCoApp.workflowIndex);
          return {
            co_applicant_index: localCoApp.workflowIndex,
            personal_info: apiData?.personal_info,
            addresses: apiData?.addresses,
            employment_details: apiData?.employment_details,
          };
        });

        // Also include any API co-applicants that might be missing locally (edge case sync issue)
        apiCoAppsMap.forEach((apiCoApp, index) => {
          if (!coApplicants.some((c: any) => c.workflowIndex === index)) {
            combinedList.push(apiCoApp);
          }
        });

        combinedList.sort((a, b) => a.co_applicant_index - b.co_applicant_index);
        setApiCoApplicants(combinedList);

        // Fetch required documents for all co-applicants in the list
        combinedList.forEach(coApp => {
          if (typeof coApp.co_applicant_index === 'number') {
            console.log(`Fetching docs for co-app index: ${coApp.co_applicant_index}`);
            getCoApplicantRequiredDocuments(currentLead.appId!, coApp.co_applicant_index)
              .then(docsResponse => {
                console.log(`Docs response for index ${coApp.co_applicant_index}:`, docsResponse);
                if (!isApiError(docsResponse) && docsResponse.success && isMounted) {
                  setRequiredDocuments(prev => {
                    const newState = {
                      ...prev,
                      [coApp.co_applicant_index]: docsResponse.required_documents
                    };
                    console.log('Updated requiredDocuments state:', newState);
                    return newState;
                  });
                }
              })
              .catch(err => console.error('Failed to fetch docs for co-app', coApp.co_applicant_index, err));
          }
        });
      } catch (error) {
        console.warn('Error fetching co-applicants from API', error);
        // Fallback to showing local co-applicants if API fails
        const fallbackList = coApplicants.map((c: any) => ({
          co_applicant_index: c.workflowIndex,
        }));
        setApiCoApplicants(fallbackList);
      } finally {
        if (isMounted) {
          setIsLoadingCoApplicants(false);
        }
      }
    };

    void fetchCoApplicants();

    return () => {
      isMounted = false;
    };
  }, [currentLead?.appId, currentLead?.formData?.coApplicants]);

  // Fetch Account Aggregator status for each co-applicant
  useEffect(() => {
    if (!currentLead?.appId || apiCoApplicants.length === 0) return;

    const fetchAaStatus = async () => {
      for (const coApp of apiCoApplicants) {
        if (typeof coApp.co_applicant_index === 'number') {
          try {
            const res = await getCoApplicantAccountAggregatorStatus(currentLead.appId, coApp.co_applicant_index);
            if (!isApiError(res)) {
              setAaStatus(prev => ({ 
                ...prev, 
                [`coapplicant_${coApp.co_applicant_index}`]: { 
                  status: res.status || 'PENDING', 
                  loading: false 
                } 
              }));
            } else {
              setAaStatus(prev => ({ 
                ...prev, 
                [`coapplicant_${coApp.co_applicant_index}`]: { 
                  status: 'NOT_INITIATED', 
                  loading: false 
                } 
              }));
            }
          } catch {
            setAaStatus(prev => ({ 
              ...prev, 
              [`coapplicant_${coApp.co_applicant_index}`]: { 
                status: 'NOT_INITIATED', 
                loading: false 
              } 
            }));
          }
        }
      }
    };

    void fetchAaStatus();
  }, [currentLead?.appId, apiCoApplicants]);

  // Handle Account Aggregator actions for co-applicants
  const handleAaAction = async (action: 'initiate' | 'resend' | 'refresh', coApplicantIndex: number) => {
    if (!currentLead?.appId) return;

    const key = `coapplicant_${coApplicantIndex}`;
    setAaStatus(prev => ({ 
      ...prev, 
      [key]: { 
        ...prev[key] || { status: 'NOT_INITIATED' }, 
        loading: true 
      } 
    }));

    try {
      let response;
      if (action === 'initiate') {
        response = await initiateCoApplicantAccountAggregator(currentLead.appId, coApplicantIndex);
      } else if (action === 'resend') {
        response = await resendCoApplicantAccountAggregatorConsent(currentLead.appId, coApplicantIndex);
      } else if (action === 'refresh') {
        response = await getCoApplicantAccountAggregatorStatus(currentLead.appId, coApplicantIndex);
      }

      if (response && !isApiError(response)) {
        if (action === 'initiate') {
          toast({ 
            title: 'Success', 
            description: 'Account Aggregator flow initiated successfully.', 
            className: 'bg-green-50 border-green-200' 
          });
          setAaStatus(prev => ({ 
            ...prev, 
            [key]: { status: 'PENDING', loading: false } 
          }));
        } else if (action === 'resend') {
          toast({ 
            title: 'Success', 
            description: 'Consent SMS resent successfully.', 
            className: 'bg-green-50 border-green-200' 
          });
          setAaStatus(prev => ({ 
            ...prev, 
            [key]: { ...prev[key], loading: false } 
          }));
        } else if (action === 'refresh') {
          const status = response.status || 'PENDING';
          setAaStatus(prev => ({ 
            ...prev, 
            [key]: { status: status, loading: false } 
          }));
          if (status === 'COMPLETED' || status === 'COMPLETE' || status === 'SUCCESS') {
            toast({ 
              title: 'Completed', 
              description: 'Account Aggregator flow completed.', 
              className: 'bg-green-50 border-green-200' 
            });
          } else {
            toast({ 
              title: 'Status Updated', 
              description: `Current status: ${status}` 
            });
          }
        }
      } else {
        toast({
          title: 'Error',
          description: response?.error || 'Failed to perform action.',
          variant: 'destructive',
        });
        setAaStatus(prev => ({ 
          ...prev, 
          [key]: { 
            ...prev[key] || { status: 'NOT_INITIATED' }, 
            loading: false 
          } 
        }));
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      setAaStatus(prev => ({ 
        ...prev, 
        [key]: { 
          ...prev[key] || { status: 'NOT_INITIATED' }, 
          loading: false 
        } 
      }));
    }
  };

  const statusBadge = (status: SectionStatus) => {
    const baseClasses = 'rounded-full border text-[11px] font-medium px-3 py-1';
    switch (status) {
      case 'completed':
        return <Badge className={cn(baseClasses, 'bg-green-50 border-green-200 text-green-700')}>Completed</Badge>;
      case 'in-progress':
        return <Badge className={cn(baseClasses, 'bg-yellow-50 border-yellow-200 text-yellow-700')}>In Progress</Badge>;
      default:
        return <Badge className={cn(baseClasses, 'bg-gray-50 border-gray-200 text-gray-600')}>No Data</Badge>;
    }
  };

  // Helper to get status from API data
  const getBasicDetailsStatusFromApi = (personalInfo: CoApplicantFromDetailedInfo['personal_info']): SectionStatus => {
    if (!personalInfo) return 'incomplete';

    const hasName = Boolean(personalInfo.full_name?.value);
    const hasMobile = Boolean(personalInfo.mobile_number?.value);
    const hasPan = Boolean(personalInfo.pan_number?.value);
    const hasDob = Boolean(personalInfo.date_of_birth?.value);
    const hasGender = Boolean(personalInfo.gender);

    const hasAll = hasName && hasMobile && (hasPan || hasDob) && hasGender;
    const hasAny = hasName || hasMobile || hasPan || hasDob || hasGender;

    if (hasAll) return 'completed';
    if (hasAny) return 'in-progress';
    return 'incomplete';
  };

  const getAddressStatusFromApi = (addresses: CoApplicantFromDetailedInfo['addresses']): SectionStatus => {
    if (!Array.isArray(addresses) || addresses.length === 0) return 'incomplete';

    const hasAny = addresses.some(
      (addr) =>
        addr?.address_line_1 ||
        addr?.address_line_2 ||
        addr?.landmark ||
        addr?.pincode
    );

    const hasAll = addresses.some(
      (addr) =>
        addr?.address_line_1 && addr?.landmark && addr?.pincode && addr?.pincode.length === 6
    );

    if (hasAll) return 'completed';
    if (hasAny) return 'in-progress';
    return 'incomplete';
  };

  const getEmploymentStatusForCoApplicant = (coApplicantId: string): SectionStatus => {
    if (!currentLead) return 'incomplete';

    const coApplicant = coApplicants.find((ca: any) => ca.id === coApplicantId);
    if (!coApplicant) return 'incomplete';

    // Check if we have API data for this co-applicant
    const apiCoApp = apiCoApplicants.find(api => api.co_applicant_index === coApplicant.workflowIndex);
    if (apiCoApp?.employment_details?.occupation_type) {
      return 'completed';
    }

    const step5 = coApplicant?.data?.step5;
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

  const handleUploadDocuments = () => {
    router.push('/lead/documents');
  };

  const handleAddCoApplicant = () => {
    if (!currentLead) {
      router.replace('/leads');
      return;
    }

    if (coApplicants.length >= 4) {
      toast({
        title: 'Limit Reached',
        description: 'You can add a maximum of 4 co-applicants.',
        variant: 'destructive',
      });
      return;
    }

    router.push('/lead/co-applicant/new');
  };

  const renderBasicDetails = (apiCoApp: CoApplicantFromDetailedInfo) => {
    const personalInfo = apiCoApp?.personal_info;
    if (!personalInfo) {
      return (
        <div className="border-b border-gray-300 pb-4 mb-4 last:border-0 last:mb-0">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-base font-semibold text-gray-900">Basic Details</h3>
          </div>
          <div className="space-y-1 mb-4">
            <p className="font-semibold text-gray-900 text-sm">No basic details added yet</p>
            <p className="text-xs text-gray-500">Upload PAN to auto-fill Name, DOB & PAN Number</p>
          </div>
        </div>
      );
    }

    const localCoApp = coApplicants.find((ca: any) => ca.workflowIndex === apiCoApp.co_applicant_index);
    const localStep2 = localCoApp?.data?.basicDetails || localCoApp?.data?.step2;
    
    // Get data from API first, fallback to local state
    const fullName = personalInfo?.full_name?.value || (localStep2?.firstName && localStep2?.lastName ? [localStep2.firstName, localStep2.lastName].filter(Boolean).join(' ') : 'Unnamed Co-applicant');
    const mobileNumber = personalInfo?.mobile_number?.value || localStep2?.mobile;
    const panNumber = personalInfo?.pan_number?.value || localStep2?.pan;
    const dob = personalInfo?.date_of_birth?.value || localStep2?.dob;
    const gender = personalInfo?.gender || localStep2?.gender;
    const email = personalInfo?.email || localStep2?.email;
    const maritalStatus = personalInfo?.marital_status || localStep2?.maritalStatus;
    
    // Show data if it exists in API response or local state
    const hasDetails = Boolean(
      (fullName && fullName !== 'Unnamed Co-applicant') ||
      mobileNumber ||
      panNumber ||
      dob ||
      gender ||
      email ||
      maritalStatus
    );

    // Check if PAN is uploaded from required documents API
    const isPanUploaded = requiredDocuments[apiCoApp.co_applicant_index]?.pan_card?.uploaded === true;
    const showPanVerifiedPill = Boolean(
      hasDetails && (
        isPanUploaded ||
        localStep2?.autoFilledViaPAN ||
        personalInfo?.pan_number?.verified
      )
    );
    const canEditBasic = Boolean(localCoApp);

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
                {fullName && fullName !== 'Unnamed Co-applicant' && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5 flex items-center justify-start">
                  {personalInfo?.full_name?.verified && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                </div>
                <span className="font-semibold text-gray-700 text-sm">Name:</span>
                <span className="text-gray-900 text-sm">{fullName}</span>
              </div>
                )}
                {dob && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5 flex items-center justify-start">
                  {personalInfo?.date_of_birth?.verified && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                </div>
                <span className="font-semibold text-gray-700 text-sm">Date of Birth:</span>
                <span className="text-gray-900 text-sm">
                    {(() => {
                      try {
                        const date = new Date(dob);
                        if (!isNaN(date.getTime())) {
                          return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        }
                      } catch {
                        /* noop */
                      }
                      return dob;
                    })()}
                </span>
              </div>
            )}
            {panNumber && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5 flex items-center justify-start">
                  {personalInfo?.pan_number?.verified && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                </div>
                <span className="font-semibold text-gray-700 text-sm">PAN Number:</span>
                <span className="text-gray-900 text-sm">{panNumber}</span>
              </div>
            )}
            {mobileNumber && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5 flex items-center justify-start">
                  {personalInfo?.mobile_number?.verified && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                </div>
                <span className="font-semibold text-gray-700 text-sm">Mobile Number:</span>
                <span className="text-gray-900 text-sm">{mobileNumber}</span>
              </div>
                )}
                {gender && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Gender:</span>
                <span className="text-gray-900 text-sm">{gender.charAt(0).toUpperCase() + gender.slice(1)}</span>
              </div>
            )}
            {email && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Email:</span>
                <span className="text-gray-900 text-sm">{email}</span>
              </div>
                )}
                {maritalStatus && (
              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                <div className="w-5"></div>
                <span className="font-semibold text-gray-700 text-sm">Marital Status:</span>
                <span className="text-gray-900 text-sm">{maritalStatus.charAt(0).toUpperCase() + maritalStatus.slice(1)}</span>
              </div>
                )}
              </div>
            ) : (
          <div className="space-y-1 mb-4">
            <p className="font-semibold text-gray-900 text-sm">No basic details added yet</p>
                <p className="text-xs text-gray-500">Upload PAN to auto-fill Name, DOB & PAN Number</p>
              </div>
            )}

        {/* Information Box */}
        {hasDetails && showPanVerifiedPill && (
          <div className="bg-blue-50 rounded-lg p-3 flex gap-3 mb-4">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">Auto-filled and verified via PAN & NSDL workflow</p>
          </div>
        )}

        {/* Edit Button */}
        {localCoApp && canEditBasic && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/lead/co-applicant/basic-details?coApplicantId=${localCoApp.id}`)}
                className={tileButtonClass}
              >
                Edit
              </Button>
        )}
      </div>
    );
  };

  const renderAddressDetails = (apiCoApp: CoApplicantFromDetailedInfo) => {
    const addresses = apiCoApp?.addresses ?? [];
    const localCoApp = coApplicants.find((ca: any) => ca.workflowIndex === apiCoApp.co_applicant_index);
    const localStep3 = localCoApp?.data?.addressDetails || localCoApp?.data?.step3;
    const localAddresses = localStep3?.addresses || [];
    
    // Get primary address from API first, fallback to local state
    let primaryAddress = addresses.find((addr: any) => addr.is_primary || addr.address_type === 'residential' || addr.address_type === 'current') ?? addresses[0] ?? null;
    
    // If no API address, try to get from local state
    if (!primaryAddress && localAddresses.length > 0) {
      const localPrimary = localAddresses.find((addr: any) => addr.isPrimary || addr.addressType === 'residential' || addr.addressType === 'current') || localAddresses[0];
      if (localPrimary) {
        primaryAddress = {
          address_line_1: localPrimary.addressLine1,
          address_line_2: localPrimary.addressLine2,
          address_line_3: localPrimary.addressLine3,
          pincode: localPrimary.postalCode,
          landmark: localPrimary.landmark,
          city: localPrimary.city,
          state: localPrimary.stateName,
        } as any;
      }
    }
    
    // Show data if it exists in API response or local state
    const hasDetails = Boolean(
      primaryAddress && (
        primaryAddress.address_line_1 ||
        primaryAddress.address_line_2 ||
        primaryAddress.address_line_3 ||
        primaryAddress.pincode ||
        primaryAddress.city ||
        primaryAddress.state
      )
    );
    
    // Check if Aadhaar is uploaded from required documents API
    const isAadhaarUploaded = requiredDocuments[apiCoApp.co_applicant_index]?.aadhaar_card?.uploaded === true;
    const showAadhaarVerifiedPill = Boolean(
      hasDetails && (
        isAadhaarUploaded ||
        localStep3?.autoFilledViaAadhaar ||
        localStep3?.addresses?.some((addr: any) => addr?.autoFilledViaAadhaar) ||
        addresses.some((addr: any) => addr?.auto_filled_via_aadhaar)
      )
    );
    const canEditAddress = Boolean(localCoApp);

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
        {localCoApp && canEditAddress && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/lead/co-applicant/address-details?coApplicantId=${localCoApp.id}`)}
                className={tileButtonClass}
              >
                Edit
              </Button>
        )}
      </div>
    );
  };

  const documentsSummary = (coApp: any) => {
    const docs = coApp?.data?.documents ?? [];
    if (!Array.isArray(docs) || docs.length === 0) {
      return 'No documents linked yet';
    }
    const successDocs = docs.filter((doc: any) => doc.status === 'Success');
    return successDocs.length > 0 ? `${successDocs.length} document(s) linked and verified` : 'Documents pending verification';
  };

  const tileWrapperClass =
    'flex flex-row items-start justify-between gap-4 border-b border-gray-100 pb-4 mb-4 last:border-0 last:mb-0';
  const tileButtonClass =
    'rounded-lg border border-blue-600 text-blue-600 hover:bg-blue-50 px-4 h-10 text-sm font-semibold bg-white transition';

  const totalCompleted = useMemo(() => {
    return apiCoApplicants.filter(
      (apiCoApp) =>
        getBasicDetailsStatusFromApi(apiCoApp.personal_info) === 'completed' &&
        getAddressStatusFromApi(apiCoApp.addresses) === 'completed'
    ).length;
  }, [apiCoApplicants]);

  const handleDelete = (coApplicantId: string) => {
    if (!currentLead) return;
    const confirmed = window.confirm('Delete this co-applicant?');
    if (!confirmed) return;
    deleteCoApplicant(currentLead.id, coApplicantId);
    toast({
      title: 'Co-applicant Deleted',
      description: 'The co-applicant has been removed.',
      className: 'bg-red-50 border-red-200 text-red-700',
    });
  };


  return (
    <DashboardLayout
      title="Co-Applicant Details"
      showNotifications={false}
      showExitButton
      onExit={() => router.push('/lead/new-lead-info')}
    >
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-120px)] relative">
        <div className="flex-1 overflow-y-auto pb-32 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* Upload Documents Button */}
          <div className="mb-4">
            <Button
              onClick={handleUploadDocuments}
              className="w-full h-14 bg-[#0072CE] hover:bg-[#005a9e] text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5 mr-2" />
              Add a Document
            </Button>
          </div>

          <div className="mb-6">
            <Button
              onClick={handleAddCoApplicant}
              className="w-full h-12 rounded-xl bg-[#0072CE] hover:bg-[#005a9e] text-white font-semibold"
            >
              + Add Co-Applicant
            </Button>
          </div>

          {isLoadingCoApplicants ? (
            <Card className="border border-gray-200 bg-white">
              <CardContent className="p-6 text-center space-y-2">
                <Users className="w-10 h-10 text-blue-600 mx-auto" />
                <p className="text-sm font-semibold text-gray-900">Loading co-applicants...</p>
              </CardContent>
            </Card>
          ) : apiCoApplicants.length === 0 ? (
            <Card className="border border-gray-200 bg-white">
              <CardContent className="p-6 text-center space-y-2">
                <Users className="w-10 h-10 text-blue-600 mx-auto" />
                <p className="text-sm font-semibold text-gray-900">No co-applicants added yet</p>
                <p className="text-xs text-gray-500">Add a co-applicant to continue joint application processing</p>
              </CardContent>
            </Card>
          ) : (
            apiCoApplicants.map((apiCoApp) => {
              // Find matching local co-applicant by workflowIndex
              const localCoApp = coApplicants.find((ca: any) => ca.workflowIndex === apiCoApp.co_applicant_index);
              const fullName = apiCoApp.personal_info?.full_name?.value || (localCoApp ? [localCoApp?.data?.basicDetails?.firstName ?? localCoApp?.data?.step1?.firstName, localCoApp?.data?.basicDetails?.lastName ?? localCoApp?.data?.step1?.lastName].filter(Boolean).join(' ') : 'Unnamed Co-applicant');
              const relation = localCoApp ? RELATIONSHIP_LABELS[localCoApp.relationship] ?? localCoApp.relationship : 'Not set';

              const apiVerified = apiCoApp.personal_info?.mobile_number?.verified;
              // Use API status if available, otherwise fall back to local status (for immediate UI update)
              const isMobileVerified = apiVerified === true || (apiVerified === undefined && (localCoApp?.data?.basicDetails?.isMobileVerified === true || localCoApp?.data?.step1?.isMobileVerified === true));
              const isExpanded = expandedCards[apiCoApp.co_applicant_index] !== false; // Default expanded

              return (
                <Card key={`co-applicant-${apiCoApp.co_applicant_index}`} className={cn(
                  "border border-gray-200 hover:shadow-lg transition-all duration-200 bg-white mb-4 border-l-4 relative",
                  (() => {
                    const basicStatus = getBasicDetailsStatusFromApi(apiCoApp.personal_info);
                    const addressStatus = getAddressStatusFromApi(apiCoApp.addresses);
                    const employmentStatus = localCoApp ? getEmploymentStatusForCoApplicant(localCoApp.id) : 'incomplete';
                    const aaStatusKey = `coapplicant_${apiCoApp.co_applicant_index}`;
                    const aaStatusData = aaStatus[aaStatusKey];
                    const isAACompleted = aaStatusData?.status === 'COMPLETED' || aaStatusData?.status === 'COMPLETE' || aaStatusData?.status === 'SUCCESS';
                    const allCompleted = basicStatus === 'completed' && addressStatus === 'completed' && employmentStatus === 'completed' && isAACompleted;
                    return allCompleted ? "border-l-green-600" : "border-l-blue-600";
                  })()
                )}>
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">{fullName}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const basicStatus = getBasicDetailsStatusFromApi(apiCoApp.personal_info);
                          const addressStatus = getAddressStatusFromApi(apiCoApp.addresses);
                          const employmentStatus = localCoApp ? getEmploymentStatusForCoApplicant(localCoApp.id) : 'incomplete';
                          const aaStatusKey = `coapplicant_${apiCoApp.co_applicant_index}`;
                          const aaStatusData = aaStatus[aaStatusKey];
                          const isAACompleted = aaStatusData?.status === 'COMPLETED' || aaStatusData?.status === 'COMPLETE' || aaStatusData?.status === 'SUCCESS';
                          const allCompleted = basicStatus === 'completed' && addressStatus === 'completed' && employmentStatus === 'completed' && isAACompleted;
                          return allCompleted ? (
                            <Badge className="rounded-full bg-green-100 border border-green-200 text-green-700 text-[10px] px-3 py-0.5 font-semibold">Completed</Badge>
                          ) : (
                            <Badge className="rounded-full bg-yellow-100 border border-yellow-200 text-yellow-700 text-[10px] px-3 py-0.5 font-semibold">In Progress</Badge>
                          );
                        })()}
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => {
                            setPendingDelete({
                              id: localCoApp?.id || '',
                              name: fullName,
                              index: apiCoApp.co_applicant_index,
                            });
                          }}
                          aria-label="Delete co-applicant"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {!isMobileVerified ? (
                      <div className="mb-4">
                        <Button
                          onClick={() => {
                            if (localCoApp) {
                              router.push(`/lead/co-applicant/new?coApplicantId=${localCoApp.id}&openOtp=true`);
                            } else {
                              toast({
                                title: "Error",
                                description: "Co-applicant details missing locally. Please refresh.",
                                variant: "destructive"
                              });
                            }
                          }}
                          className="w-full bg-[#0072CE] hover:bg-[#005a9e] text-white"
                        >
                          Proceed to Consent
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                            {(() => {
                              const isAadhaarUploaded = Boolean(
                                localCoApp?.data?.step3?.autoFilledViaAadhaar ||
                                (apiCoApp.addresses && apiCoApp.addresses.length > 0) ||
                                (apiCoApp as any)?.required_documents?.aadhaar_card?.uploaded ||
                                requiredDocuments[apiCoApp.co_applicant_index]?.aadhaar_card?.uploaded
                              );

                                return (
                            <>
                              {renderBasicDetails(apiCoApp)}
                              {renderAddressDetails(apiCoApp)}
                              
                              {!isAadhaarUploaded && (
                                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 mb-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="w-6 h-6"
                                          >
                                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                                            <path d="M4 20v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                          </svg>
                                        </div>
                                        <span className="font-semibold text-gray-900">Upload Aadhaar</span>
                                      </div>
                                      <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">Required</Badge>
                                    </div>

                                    <div className="bg-blue-50 rounded-lg p-3 mb-4 flex gap-3 items-start">
                                      <div className="mt-0.5 text-blue-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="16" y2="12" /><line x1="12" x2="12.01" y1="8" y2="8" /></svg>
                                      </div>
                                      <p className="text-sm text-blue-700 leading-snug">
                                        Please upload Aadhaar card for {fullName} to auto-fill address details and verify identity.
                                      </p>
                                    </div>

                                    <Button
                                      className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium h-11 rounded-lg"
                                      onClick={() => {
                                        if (localCoApp) {
                                          router.push(`/lead/co-applicant/aadhaar-upload?coApplicantId=${localCoApp.id}`);
                                        }
                                      }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                                      Upload Aadhaar
                                    </Button>
                                  </div>
                              )}
                                  {(() => {
                              const employmentStatus = localCoApp ? getEmploymentStatusForCoApplicant(localCoApp.id) : 'incomplete';
                              const step5 = localCoApp?.data?.step5;
                              const apiEmploymentDetails = apiCoApp?.employment_details;

                                    // Show data if it exists in API response or local state, regardless of status
                                    const hasDetails = Boolean(
                                      apiEmploymentDetails || step5
                                    );
                                    
                                    // Check if employment details are completed
                                    const isCompleted = employmentStatus === 'completed';

                                    // Format monthly income
                                    const formatMonthlyIncome = (income: string | number | undefined): string => {
                                      if (!income) return '';
                                      const numValue = typeof income === 'string' ? parseFloat(income) : income;
                                      if (isNaN(numValue)) return '';
                                      return `₹${numValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                    };

                                    const monthlyIncome = apiEmploymentDetails?.monthly_income || step5?.monthlyIncome;
                                    const formattedIncome = formatMonthlyIncome(monthlyIncome);

                                    // Format date
                                    const formatDate = (dateStr: string | undefined | null): string => {
                                      if (!dateStr) return '';
                                      try {
                                        const date = new Date(dateStr);
                                        if (isNaN(date.getTime())) return dateStr;
                                        return date.toISOString().split('T')[0];
                                      } catch {
                                        return dateStr;
                                      }
                                    };

                                    const employedFrom = apiEmploymentDetails?.employed_from || step5?.employedFrom;
                                    const formattedEmployedFrom = formatDate(employedFrom);

                              const occupationTypeLabels: Record<string, string> = {
                                      salaried: 'Salaried',
                                'self-employed-non-professional': 'Self Employed Non Professional',
                                'self-employed-professional': 'Self Employed Professional',
                                      others: 'Others',
                                    };

                                              const occupationType = apiEmploymentDetails ? apiEmploymentDetails.occupation_type : step5?.occupationType;
                                    const displayOccupation = occupationType ? (occupationTypeLabels[occupationType] || occupationType) : null;

                                              return (
                                      <div className="border-b border-gray-300 pb-4 mb-4 last:border-0 last:mb-0">
                                        {/* Title with Badge */}
                                        <div className="flex items-center gap-2 mb-4">
                                          <h3 className="text-base font-semibold text-gray-900">Employment Details</h3>
                                          {isCompleted ? (
                                            <Badge className="rounded-full bg-green-100 border border-green-200 text-green-700 text-[10px] px-2.5 py-0.5 font-medium whitespace-nowrap">
                                              Completed
                                            </Badge>
                                          ) : !hasDetails ? (
                                            <Badge className="rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-[10px] px-2.5 py-0.5 font-medium whitespace-nowrap">
                                              No Data
                                            </Badge>
                                          ) : null}
                                        </div>

                                        {/* Fields */}
                                        {hasDetails && (apiEmploymentDetails || step5) ? (
                                          <div className="space-y-1 mb-4">
                                            {displayOccupation && (
                                              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                                <div className="w-5"></div>
                                                <span className="font-semibold text-gray-700 text-sm">Occupation:</span>
                                                <span className="text-gray-900 text-sm">{displayOccupation}</span>
                                              </div>
                                            )}
                                            {(apiEmploymentDetails?.organization_name || step5?.employerName || step5?.orgNameSENP || step5?.orgNameSEP) && (
                                              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                                <div className="w-5"></div>
                                                <span className="font-semibold text-gray-700 text-sm">Company:</span>
                                                <span className="text-gray-900 text-sm">
                                                  {apiEmploymentDetails?.organization_name || step5?.employerName || step5?.orgNameSENP || step5?.orgNameSEP}
                                                </span>
                                              </div>
                                            )}
                                            {(apiEmploymentDetails?.designation || step5?.designation) && (
                                              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                                <div className="w-5"></div>
                                                <span className="font-semibold text-gray-700 text-sm">Designation:</span>
                                                <span className="text-gray-900 text-sm">
                                                  {apiEmploymentDetails?.designation || step5?.designation}
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
                                            {(apiEmploymentDetails?.nature_of_occupation || step5?.natureOfOccupation) && (
                                              <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 py-1.5 items-start">
                                                <div className="w-5"></div>
                                                <span className="font-semibold text-gray-700 text-sm">Nature:</span>
                                                <span className="text-gray-900 text-sm">
                                                  {(apiEmploymentDetails?.nature_of_occupation || step5?.natureOfOccupation).charAt(0).toUpperCase() + (apiEmploymentDetails?.nature_of_occupation || step5?.natureOfOccupation).slice(1)}
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
                                      {localCoApp && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => router.push(`/lead/co-applicant/employment-details?coApplicantId=${localCoApp.id}`)}
                                          className={tileButtonClass}
                                        >
                                          Edit
                                        </Button>
                                      )}
                                    </div>
                                    );
                                  })()}

                                  {(() => {
                                    const aaStatusKey = `coapplicant_${apiCoApp.co_applicant_index}`;
                                    const aaStatusData = aaStatus[aaStatusKey];
                                    const isCompleted = aaStatusData?.status === 'COMPLETED' || aaStatusData?.status === 'COMPLETE' || aaStatusData?.status === 'SUCCESS';
                                    const isFailed = aaStatusData?.status === 'FAILED';
                                    const isPending = aaStatusData?.status === 'PENDING';
                                    const isNotInitiated = !aaStatusData || aaStatusData.status === 'NOT_INITIATED';

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
                                        {!isCompleted && !isFailed && (
                                          <div className="flex items-center gap-2">
                                            {isPending ? (
                                              <>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => handleAaAction('resend', apiCoApp.co_applicant_index)}
                                                  disabled={aaStatusData?.loading}
                                                  className={tileButtonClass}
                                                >
                                                  Resend
                                      </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => handleAaAction('refresh', apiCoApp.co_applicant_index)}
                                                  disabled={aaStatusData?.loading}
                                                  className="h-8 w-8 text-gray-500 hover:text-blue-600"
                                                >
                                                  <RefreshCw className={cn("w-4 h-4", aaStatusData?.loading && "animate-spin")} />
                                                </Button>
                                              </>
                                            ) : isNotInitiated ? (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleAaAction('initiate', apiCoApp.co_applicant_index)}
                                                disabled={aaStatusData?.loading}
                                                className={tileButtonClass}
                                              >
                                                {aaStatusData?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Initiate'}
                                              </Button>
                                            ) : null}
                                    </div>
                                        )}
                                  </div>
                                    );
                                  })()}
                                </>
                              );
                            })()}
                          </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-top shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              onClick={() => router.push('/lead/new-lead-info')}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] text-white font-medium"
            >
              Back to Application Hub
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete {pendingDelete?.name} as a Co-applicant?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove the co-applicant from the application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>No</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={async () => {
                if (!pendingDelete || !currentLead) {
                  setPendingDelete(null);
                  return;
                }

                const applicationId = currentLead.appId;
                const { index, id, name } = pendingDelete;

                if (!applicationId || index < 0) {
                  toast({
                    title: 'Unable to delete',
                    description: 'Application details are missing. Please try again.',
                    variant: 'destructive',
                  });
                  setPendingDelete(null);
                  return;
                }

                setIsDeleting(true);
                try {
                  const response = await deleteCoApplicantFromApi({
                    application_id: applicationId,
                    co_applicant_index: index,
                  });

                  if (isApiError(response)) {
                    throw new Error(response.error || 'Failed to delete co-applicant.');
                  }

                  if (id) {
                    deleteCoApplicant(currentLead.id, id);
                  } else {
                    // If local co-applicant is missing, we still deleted from API.
                    // We should reload to sync state.
                    window.location.reload();
                  }
                  toast({
                    title: 'Co-applicant Deleted',
                    description: `${name} has been removed successfully.`,
                    className: 'bg-green-50 border-green-200',
                  });
                } catch (error: any) {
                  toast({
                    title: 'Deletion failed',
                    description: error?.message || 'Something went wrong while deleting the co-applicant.',
                    variant: 'destructive',
                  });
                } finally {
                  setIsDeleting(false);
                  setPendingDelete(null);
                }
              }}
            >
              {isDeleting ? 'Deleting...' : 'Yes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

