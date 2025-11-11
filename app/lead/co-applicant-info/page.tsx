'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, MapPin, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type SectionStatus = 'incomplete' | 'in-progress' | 'completed';

const RELATIONSHIP_LABELS: Record<string, string> = {
  Father: 'Father',
  Mother: 'Mother',
  Sister: 'Sister',
  Husband: 'Husband',
  Wife: 'Wife',
  'Father in Law': 'Father in Law',
  'Mother in Law': 'Mother in Law',
  Son: 'Son',
  Daughter: 'Daughter',
  Partner: 'Partner',
  Other: 'Other',
  Spouse: 'Spouse',
};

export default function CoApplicantInfoPage() {
  const { currentLead, deleteCoApplicant } = useLead();
  const router = useRouter();
  const { toast } = useToast();

  const coApplicants = currentLead?.formData?.coApplicants ?? [];

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

  const isConsentVerified = (coApp: any) =>
    coApp?.data?.basicDetails?.isMobileVerified ?? coApp?.data?.step1?.isMobileVerified ?? false;

  const getBasicDetailsStatus = (coApp: any): SectionStatus => {
    const basic = coApp?.data?.basicDetails ?? coApp?.data?.step1;
    const hasAny =
      basic?.firstName ||
      basic?.lastName ||
      basic?.mobile ||
      basic?.gender ||
      basic?.pan ||
      basic?.alternateIdType ||
      basic?.documentNumber;

    const hasAll =
      (basic?.hasPan === 'yes'
        ? basic?.pan && basic?.pan.length === 10 && basic?.gender && basic?.dob
        : basic?.hasPan === 'no'
          ? basic?.gender &&
            basic?.dob &&
            basic?.maritalStatus &&
            basic?.alternateIdType &&
            basic?.documentNumber &&
            basic?.panUnavailabilityReason
          : false) || coApp?.isComplete;

    if (hasAll) return 'completed';
    if (hasAny) return 'in-progress';
    return 'incomplete';
  };

  const getAddressStatus = (coApp: any): SectionStatus => {
    const addresses = coApp?.data?.addressDetails?.addresses ?? coApp?.data?.step3?.addresses ?? [];
    if (!Array.isArray(addresses) || addresses.length === 0) return 'incomplete';

    const hasAny = addresses.some(
      (addr: any) =>
        addr?.addressType ||
        addr?.addressLine1 ||
        addr?.addressLine2 ||
        addr?.landmark ||
        addr?.postalCode
    );

    const hasAll = addresses.every(
      (addr: any) =>
        addr?.addressType && addr?.addressLine1 && addr?.landmark && addr?.postalCode && addr?.postalCode.length === 6
    );

    if (hasAll || coApp?.isComplete) return 'completed';
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

  const renderBasicDetails = (coApp: any) => {
    const basic = coApp?.data?.basicDetails ?? coApp?.data?.step1 ?? {};
    const fullName = [basic.firstName, basic.lastName].filter(Boolean).join(' ');
    const relation = RELATIONSHIP_LABELS[coApp.relationship] ?? coApp.relationship ?? 'Not set';

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">Basic Details</p>
          </div>
          {statusBadge(getBasicDetailsStatus(coApp))}
        </div>

        {fullName ? (
          <p className="text-sm text-gray-700">
            <span className="font-medium">Name:</span> {fullName}
          </p>
        ) : (
          <p className="text-xs text-gray-500">No basic details added yet</p>
        )}

        <div className="space-y-1 text-sm text-gray-700">
          <p>
            <span className="font-medium">Relation:</span> {relation}
          </p>
          {basic.gender && (
            <p>
              <span className="font-medium">Gender:</span> {basic.gender}
            </p>
          )}
          {basic.pan && (
            <p>
              <span className="font-medium">PAN Number:</span> {basic.pan}
            </p>
          )}
          {basic.alternateIdType && basic.documentNumber && (
            <p>
              <span className="font-medium">{basic.alternateIdType}:</span> {basic.documentNumber}
            </p>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-2">
          {basic.autoFilledViaPAN ? 'Auto-filled and verified via PAN workflow.' : 'Values entered manually.'}
        </p>

        <div className="flex flex-wrap gap-3 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/lead/co-applicant/basic-details?coApplicantId=${coApp.id}`)}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            Edit
          </Button>
        </div>
      </div>
    );
  };

  const renderAddressDetails = (coApp: any) => {
    const addresses = coApp?.data?.addressDetails?.addresses ?? coApp?.data?.step3?.addresses ?? [];
    const primaryAddress = Array.isArray(addresses) ? addresses.find((addr: any) => addr.isPrimary) ?? addresses[0] : null;
    const status = getAddressStatus(coApp);

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
            <p>
              <span className="font-medium">Address:</span> {primaryAddress.addressLine1}
            </p>
            {primaryAddress.addressLine2 && (
              <p>
                <span className="font-medium">Area:</span> {primaryAddress.addressLine2}
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
            {primaryAddress.postalCode && (
              <p>
                <span className="font-medium">Pincode:</span> {primaryAddress.postalCode}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No address details added yet</p>
        )}

        <p className="text-xs text-gray-400 mt-2">
          {coApp?.data?.addressDetails?.autoFilledViaAadhaar ? 'Auto-filled and verified via Aadhaar workflow.' : 'Values entered manually.'}
        </p>

        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/lead/co-applicant/address-details?coApplicantId=${coApp.id}`)}
          className="mt-3 border-blue-600 text-blue-600 hover:bg-blue-50"
        >
          Edit
        </Button>
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
    return coApplicants.filter(
      (coApp: any) =>
        isConsentVerified(coApp) &&
        getBasicDetailsStatus(coApp) === 'completed' &&
        getAddressStatus(coApp) === 'completed'
    ).length;
  }, [coApplicants]);

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

  const renderConsentPendingCard = (coApp: any, index: number) => {
    const basic = coApp?.data?.basicDetails ?? coApp?.data?.step1 ?? {};
    const fullName =
      [basic.firstName, basic.lastName].filter(Boolean).join(' ') || 'Unnamed Co-applicant';

    return (
      <Card key={coApp.id} className="border border-yellow-200 bg-yellow-50 mb-4">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-1">{`Co-Applicant ${index + 1}`}</p>
            <h3 className="text-lg font-semibold text-gray-900">{fullName}</h3>
              <p className="text-xs text-gray-500 mt-1">
                {RELATIONSHIP_LABELS[coApp.relationship] ?? coApp.relationship ?? 'Relationship not set'}
              </p>
            </div>
        <button
          type="button"
          className="text-red-500 hover:text-red-600"
          onClick={() => handleDelete(coApp.id)}
        >
          <Trash2 className="w-5 h-5" />
        </button>
          </div>
          <p className="text-sm text-gray-700">
            Complete the consent verification to continue capturing details for this co-applicant.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-[#0072CE] hover:bg-[#005a9e] text-white"
              onClick={() => router.push(`/lead/co-applicant/new?coApplicantId=${coApp.id}`)}
            >
              Continue
            </Button>
            <button
              type="button"
              className="text-red-500 hover:text-red-600"
              onClick={() => handleDelete(coApp.id)}
              aria-label="Delete co-applicant"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </CardContent>
      </Card>
    );
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

          {coApplicants.length === 0 ? (
            <Card className="border border-gray-200 bg-white">
              <CardContent className="p-6 text-center space-y-2">
                <Users className="w-10 h-10 text-blue-600 mx-auto" />
                <p className="text-sm font-semibold text-gray-900">No co-applicants added yet</p>
                <p className="text-xs text-gray-500">Add a co-applicant to continue joint application processing</p>
              </CardContent>
            </Card>
          ) : (
            coApplicants.map((coApp: any, index: number) => {
              if (!isConsentVerified(coApp)) {
                return renderConsentPendingCard(coApp, index);
              }

              const basic = coApp?.data?.basicDetails ?? coApp?.data?.step1 ?? {};
              const fullName = [basic.firstName, basic.lastName].filter(Boolean).join(' ') || 'Unnamed Co-applicant';

              return (
                <Card key={coApp.id} className="border border-gray-200 bg-white mb-4 border-l-4 border-l-blue-600 relative">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-500 mb-1">{`Co-Applicant ${index + 1} –`}</p>
                        <h3 className="text-lg font-semibold text-gray-900 leading-snug">{fullName}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {RELATIONSHIP_LABELS[coApp.relationship] ?? coApp.relationship ?? 'Relationship not set'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(coApp.id)}
                        aria-label="Delete co-applicant"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid gap-4">
                      {renderBasicDetails(coApp)}
                      {renderAddressDetails(coApp)}
                    </div>

                    <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">
                      {documentsSummary(coApp)}
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
    </DashboardLayout>
  );
}

