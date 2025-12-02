'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, MapPin, Trash2, Briefcase, Database, ChevronDown, ChevronUp } from 'lucide-react';
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
import { deleteCoApplicantFromApi, getDetailedInfo, isApiError, type ApiSuccess } from '@/lib/api';

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
        const response = await getDetailedInfo(currentLead.appId);
        if (!isMounted) return;

        if (isApiError(response)) {
          console.warn('Failed to fetch co-applicants from API', response.error);
          setApiCoApplicants([]);
          return;
        }

        // Extract application_details from response
        const responseData = response.data ?? (response as any);
        const applicationDetails = responseData?.application_details ?? responseData;
        const participants = applicationDetails?.participants ?? [];

        // Filter and extract co-applicants with their full data
        const coApplicantsData = participants
          .filter((participant: any) => participant?.participant_type === 'co-applicant')
          .map((participant: any) => ({
            co_applicant_index: typeof participant?.co_applicant_index === 'number'
              ? participant.co_applicant_index
              : -1,
            personal_info: participant?.personal_info,
            addresses: participant?.addresses ?? [],
            employment_details: participant?.employment_details,
          }))
          .filter((coApp: CoApplicantFromDetailedInfo) => coApp.co_applicant_index >= 0)
          .sort((a: CoApplicantFromDetailedInfo, b: CoApplicantFromDetailedInfo) =>
            a.co_applicant_index - b.co_applicant_index
          );

        setApiCoApplicants(coApplicantsData);
      } catch (error) {
        console.warn('Error fetching co-applicants from API', error);
        setApiCoApplicants([]);
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
  }, [currentLead?.appId]);

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
    const personalInfo = apiCoApp.personal_info;
    const fullName = personalInfo?.full_name?.value || 'Unnamed Co-applicant';
    const mobileNumber = personalInfo?.mobile_number?.value;
    const panNumber = personalInfo?.pan_number?.value;
    const dob = personalInfo?.date_of_birth?.value;
    const gender = personalInfo?.gender;
    const email = personalInfo?.email;
    const maritalStatus = personalInfo?.marital_status;
    const status = getBasicDetailsStatusFromApi(personalInfo);

    const localCoApp = coApplicants.find((ca: any) => ca.workflowIndex === apiCoApp.co_applicant_index);
    const localStep2 = localCoApp?.data?.step2;
    const showPanVerifiedPill = Boolean(localStep2?.autoFilledViaPAN || personalInfo?.pan_number?.verified);
    const canEditBasic = Boolean(localCoApp);

    return (
      <div className={tileWrapperClass}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-white border border-blue-100 flex items-center justify-center text-blue-600">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            {personalInfo ? (
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                {fullName && (
                  <p>
                    <span className="font-medium">Name:</span> {fullName}
                    {personalInfo.full_name?.verified && <span className="ml-2 text-xs text-green-600">✓ Verified</span>}
                  </p>
                )}
                {mobileNumber && (
                  <p>
                    <span className="font-medium">Mobile:</span> {mobileNumber}
                    {personalInfo.mobile_number?.verified && (
                      <span className="ml-2 text-xs text-green-600">✓ Verified</span>
                    )}
                  </p>
                )}
                {email && (
                  <p>
                    <span className="font-medium">Email:</span> {email}
                  </p>
                )}
                {panNumber && (
                  <p>
                    <span className="font-medium">PAN Number:</span> {panNumber}
                    {personalInfo.pan_number?.verified && (
                      <span className="ml-2 text-xs text-green-600">✓ Verified</span>
                    )}
                  </p>
                )}
                {dob && (
                  <p>
                    <span className="font-medium">Date of Birth:</span>{' '}
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
                    {personalInfo.date_of_birth?.verified && (
                      <span className="ml-2 text-xs text-green-600">✓ Verified</span>
                    )}
                  </p>
                )}
                {gender && (
                  <p>
                    <span className="font-medium">Gender:</span> {gender}
                  </p>
                )}
                {maritalStatus && (
                  <p>
                    <span className="font-medium">Marital Status:</span> {maritalStatus}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-gray-900">No basic details added yet</p>
                <p className="text-xs text-gray-500">Upload PAN to auto-fill Name, DOB & PAN Number</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 min-w-[140px]">
          {statusBadge(status)}
          {showPanVerifiedPill && (
            <Badge className="rounded-full bg-white border border-green-200 text-green-700 text-[11px] px-3 py-1">
              Verified via PAN
            </Badge>
          )}
          {localCoApp &&
            (canEditBasic ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/lead/co-applicant/basic-details?coApplicantId=${localCoApp.id}`)}
                className={tileButtonClass}
              >
                Edit
              </Button>
            ) : (
              <Badge className="rounded-full bg-white border border-gray-300 text-gray-600 text-[11px] px-3 py-1">
                Submitted
              </Badge>
            ))}
        </div>
      </div>
    );
  };

  const renderAddressDetails = (apiCoApp: CoApplicantFromDetailedInfo) => {
    const addresses = apiCoApp.addresses ?? [];
    const primaryAddress = addresses.find((addr) => addr.is_primary) ?? addresses[0] ?? null;
    const status = getAddressStatusFromApi(addresses);

    const localCoApp = coApplicants.find((ca: any) => ca.workflowIndex === apiCoApp.co_applicant_index);
    const localStep3 = localCoApp?.data?.step3;
    const showAadhaarVerifiedPill = Boolean(
      localStep3?.autoFilledViaAadhaar || localStep3?.addresses?.some((addr: any) => addr?.autoFilledViaAadhaar)
    );
    const canEditAddress = Boolean(localCoApp);

    return (
      <div className={tileWrapperClass}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-white border border-blue-100 flex items-center justify-center text-blue-600">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            {primaryAddress ? (
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                {primaryAddress.address_line_1 && (
                  <p>
                    <span className="font-medium">Address:</span> {primaryAddress.address_line_1}
                  </p>
                )}
                {primaryAddress.address_line_2 && (
                  <p>
                    <span className="font-medium">Area:</span> {primaryAddress.address_line_2}
                  </p>
                )}
                {primaryAddress.address_line_3 && (
                  <p>
                    <span className="font-medium">Area 2:</span> {primaryAddress.address_line_3}
                  </p>
                )}
                {primaryAddress.landmark && (
                  <p>
                    <span className="font-medium">Landmark:</span> {primaryAddress.landmark}
                  </p>
                )}
                {primaryAddress.city && (
                  <p>
                    <span className="font-medium">City:</span> {primaryAddress.city}
                  </p>
                )}
                {primaryAddress.state && (
                  <p>
                    <span className="font-medium">State:</span> {primaryAddress.state}
                  </p>
                )}
                {primaryAddress.pincode && (
                  <p>
                    <span className="font-medium">Pincode:</span> {primaryAddress.pincode}
                  </p>
                )}
                {primaryAddress.address_type && (
                  <p>
                    <span className="font-medium">Type:</span> {primaryAddress.address_type}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-gray-900">No address details added yet</p>
                <p className="text-xs text-gray-500">Upload Aadhaar to auto-fill Address & Pincode</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 min-w-[140px]">
          {statusBadge(status)}
          {showAadhaarVerifiedPill && (
            <Badge className="rounded-full bg-white border border-green-200 text-green-700 text-[11px] px-3 py-1">
              Verified via Aadhaar
            </Badge>
          )}
          {localCoApp &&
            (canEditAddress ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/lead/co-applicant/address-details?coApplicantId=${localCoApp.id}`)}
                className={tileButtonClass}
              >
                Edit
              </Button>
            ) : (
              <Badge className="rounded-full bg-white border border-gray-300 text-gray-600 text-[11px] px-3 py-1">
                Submitted
              </Badge>
            ))}
        </div>
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

              const isMobileVerified = apiCoApp.personal_info?.mobile_number?.verified;
              const isExpanded = expandedCards[apiCoApp.co_applicant_index] !== false; // Default expanded

              return (
                <Card key={`co-applicant-${apiCoApp.co_applicant_index}`} className="border border-gray-200 bg-white mb-4 border-l-4 border-l-blue-600 relative">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-500 mb-1">{`Co-Applicant ${apiCoApp.co_applicant_index + 1} –`}</p>
                        <h3 className="text-lg font-semibold text-gray-900 leading-snug">{fullName}</h3>
                        {relation && (
                          <p className="text-xs text-gray-500 mt-1">
                            {relation}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
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
                        {isMobileVerified && (
                          <button
                            type="button"
                            onClick={() => toggleCard(apiCoApp.co_applicant_index)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {!isMobileVerified ? (
                      <div className="mt-4">
                        <Button
                          onClick={() => {
                            if (localCoApp) {
                              router.push(`/lead/co-applicant/new?coApplicantId=${localCoApp.id}&openOtp=true`);
                            } else {
                              // Fallback if localCoApp is missing but API has it (rare case)
                              // We can't easily edit without ID, maybe show toast
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
                      isExpanded && (
                        <>
                          <div className="grid gap-4">
                            {renderBasicDetails(apiCoApp)}
                            {renderAddressDetails(apiCoApp)}

                            {(() => {
                              const employmentStatus = localCoApp ? getEmploymentStatusForCoApplicant(localCoApp.id) : 'incomplete';
                              const step5 = localCoApp?.data?.step5;
                              const occupationTypeLabels: Record<string, string> = {
                                'salaried': 'Salaried',
                                'self-employed-non-professional': 'Self Employed Non Professional',
                                'self-employed-professional': 'Self Employed Professional',
                                'others': 'Others'
                              };

                              return (
                                <div className={tileWrapperClass}>
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-2xl bg-white border border-blue-100 flex items-center justify-center text-blue-600">
                                      <Briefcase className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      {employmentStatus === 'incomplete' ? (
                                        <div className="space-y-0.5">
                                          <p className="text-sm font-semibold text-gray-900">No employment details added yet</p>
                                          <p className="text-xs text-gray-500">Upload or enter occupation and employment details manually</p>
                                        </div>
                                      ) : step5 ? (
                                        <div className="mt-2 space-y-1 text-xs text-gray-600">
                                          <p>
                                            <span className="font-medium">Occupation Type:</span> {occupationTypeLabels[step5.occupationType] || step5.occupationType}
                                          </p>
                                          {step5.occupationType === 'salaried' && (
                                            <>
                                              {step5.employerName && (
                                                <p>
                                                  <span className="font-medium">Employer:</span> {step5.employerName}
                                                </p>
                                              )}
                                              {step5.employmentStatus && (
                                                <p>
                                                  <span className="font-medium">Status:</span> {step5.employmentStatus === 'present' ? 'Present' : 'Past'}
                                                </p>
                                              )}
                                            </>
                                          )}
                                          {(step5.occupationType === 'self-employed-non-professional' || step5.occupationType === 'self-employed-professional') &&
                                            (step5.orgNameSENP || step5.orgNameSEP) && (
                                              <p>
                                                <span className="font-medium">Organization:</span> {step5.orgNameSENP || step5.orgNameSEP}
                                              </p>
                                            )}
                                          {step5.occupationType === 'others' && step5.natureOfOccupation && (
                                            <p>
                                              <span className="font-medium">Nature:</span> {step5.natureOfOccupation.charAt(0).toUpperCase() + step5.natureOfOccupation.slice(1)}
                                            </p>
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2 min-w-[140px]">
                                    {employmentStatus !== 'incomplete' && (
                                      <Badge className={cn(
                                        'rounded-full text-[11px] px-3 py-1 border',
                                        employmentStatus === 'completed'
                                          ? 'bg-white border-green-200 text-green-700'
                                          : 'bg-white border-yellow-200 text-yellow-700'
                                      )}>
                                        {employmentStatus === 'completed' ? 'Completed' : 'In Progress'}
                                      </Badge>
                                    )}
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
                                </div>
                              );
                            })()}

                            <div className={tileWrapperClass}>
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-white border border-blue-100 flex items-center justify-center text-blue-600">
                                  <Database className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">No account aggregator request initiated</p>
                                  <p className="text-xs text-gray-500 mt-1">Initiate to fetch customer's bank statements digitally</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 min-w-[140px]">
                                <Button variant="outline" size="sm" className={tileButtonClass} disabled>
                                  Initiate
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">
                            {localCoApp ? documentsSummary(localCoApp) : 'No documents linked yet'}
                          </div>
                        </>
                      )
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

