'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, MapPin, Trash2 } from 'lucide-react';
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

    // Find local co-applicant for navigation
    const localCoApp = coApplicants.find((ca: any) => ca.workflowIndex === apiCoApp.co_applicant_index);

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">Basic Details</p>
          </div>
          {statusBadge(status)}
        </div>

        {personalInfo ? (
          <div className="space-y-1 text-sm text-gray-700">
            {fullName && (
              <p>
                <span className="font-medium">Name:</span> {fullName}
                {personalInfo.full_name?.verified && (
                  <span className="ml-2 text-xs text-green-600">✓ Verified</span>
                )}
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
                <span className="font-medium">Date of Birth:</span> {(() => {
                  try {
                    const date = new Date(dob);
                    if (!isNaN(date.getTime())) {
                      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    }
                  } catch {
                    // fall through
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
          <p className="text-xs text-gray-500">No basic details added yet</p>
        )}

        {localCoApp && (
          <div className="flex flex-wrap gap-3 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                router.push(`/lead/co-applicant/basic-details?coApplicantId=${localCoApp.id}`);
              }}
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              Edit
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderAddressDetails = (apiCoApp: CoApplicantFromDetailedInfo) => {
    const addresses = apiCoApp.addresses ?? [];
    const primaryAddress = addresses.find((addr) => addr.is_primary) ?? addresses[0] ?? null;
    const status = getAddressStatusFromApi(addresses);

    // Find local co-applicant for navigation
    const localCoApp = coApplicants.find((ca: any) => ca.workflowIndex === apiCoApp.co_applicant_index);

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">Address Details</p>
          </div>
          {statusBadge(status)}
        </div>

        {primaryAddress ? (
          <div className="space-y-1 text-sm text-gray-700">
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
          <p className="text-xs text-gray-500">No address details added yet</p>
        )}

        {localCoApp && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              router.push(`/lead/co-applicant/address-details?coApplicantId=${localCoApp.id}`);
            }}
            className="mt-3 border-blue-600 text-blue-600 hover:bg-blue-50"
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
                      {localCoApp && (
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => {
                            setPendingDelete({
                              id: localCoApp.id,
                              name: fullName,
                              index: apiCoApp.co_applicant_index,
                            });
                          }}
                          aria-label="Delete co-applicant"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4">
                      {renderBasicDetails(apiCoApp)}
                      {renderAddressDetails(apiCoApp)}
                    </div>

                    <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">
                      {localCoApp ? documentsSummary(localCoApp) : 'No documents linked yet'}
                    </div>
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

                  deleteCoApplicant(currentLead.id, id);
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

