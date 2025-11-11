'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchApplicationsSummary,
  getDetailedInfo,
  isApiError,
  type ApplicationsSummaryResponse,
  type ApplicationSummaryItem,
  type DetailedInfoResponse,
} from '@/lib/api';

export type LeadStatus = 'Draft' | 'Submitted' | 'Approved' | 'Disbursed' | 'Rejected';

export type PaymentStatus = 'Pending' | 'Paid' | 'Failed';

export interface PaymentSession {
  id: string;
  feeType: 'Login / IMD Fee' | 'Other Fee';
  amount: number;
  remarks?: string;
  status: PaymentStatus;
  link: string;
  createdAt: string;
  updatedAt: string;
  timeline: {
    created: string;
    sent: string;
    received?: string;
  }
}

export interface CoApplicant {
    id: string;
    relationship: string;
    currentStep: 0 | 1 | 2 | 3 | 4;
    isComplete: boolean;
    data: any;
}

export interface Lead {
  id: string;
  appId: string;
  status: LeadStatus;
  customerName: string;
  customerMobile: string;
  customerFirstName?: string;
  customerLastName?: string;
  panNumber?: string;
  dob?: string;
  age?: number;
  gender?: string;
  loanAmount?: number;
  loanPurpose?: string;
  currentStep: number;
  formData: {
    coApplicants?: CoApplicant[]; // Add co-applicants list here
    step1?: any;
    step2?: any;
    step3?: any;
    step4?: any;
    step5?: any;
    step6?: any;
    step7?: any;
    step8?: any;
    step9_eval?: any;
    step10?: any;
  };
  // Completion status for sections
  step2Completed?: boolean; // Customer Details (basic-details) completed
  step3Completed?: boolean; // Address Details completed
  payments: PaymentSession[];
  createdAt: string;
  updatedAt: string;
  hasDetails?: boolean;
}

export interface LeadSummaryStats {
  total: number;
  draft: number;
  completed: number;
}

interface LeadContextType {
  leads: Lead[];
  currentLead: Lead | null;
  loading: boolean;
  error: string | null;
  summaryStats: LeadSummaryStats;
  createLead: () => void;
  updateLead: (leadId: string, data: Partial<Lead>) => void;
  addLeadToArray: (lead: Lead) => void; // Add lead to leads array (after OTP verification)
  submitLead: (leadId: string) => void;
  updateLeadStatus: (leadId: string, status: LeadStatus) => void;
  setCurrentLead: (lead: Lead | null) => void;
  deleteLead: (leadId: string) => void;
  addPaymentToLead: (leadId: string, payment: PaymentSession) => void;
  updatePaymentInLead: (leadId: string, paymentId: string, paymentUpdate: Partial<PaymentSession>) => void;
  deletePaymentFromLead: (leadId: string, paymentId: string) => void;
  refreshLeads: () => Promise<void>;
  fetchLeadDetails: (applicationId: string, options?: { force?: boolean }) => Promise<Lead | null>;
  
  // Co-Applicant specific functions
  createCoApplicant: (leadId: string, relationship: string) => CoApplicant;
  updateCoApplicant: (leadId: string, coApplicantId: string, data: Partial<CoApplicant>) => void;
  deleteCoApplicant: (leadId: string, coApplicantId: string) => void;
  
  // NEW FUNCTION FOR ROUTING FIX
  startCoApplicantFlow: (leadId: string, defaultRelationship: string) => string; 
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

const DEFAULT_SUMMARY_STATS: LeadSummaryStats = { total: 0, draft: 0, completed: 0 };

function composeCustomerName(first?: string | null, last?: string | null, fallback?: string) {
  const parts = [first, last].filter(Boolean) as string[];
  const full = parts.join(' ').trim();
  return full || (fallback ?? '');
}

function calculateAge(dob?: string | null): number | undefined {
  if (!dob) return undefined;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : undefined;
}

function pickLatestTimestamp(timestamps: Array<string | null | undefined>, fallback: string): string {
  const valid = timestamps.filter((value): value is string => Boolean(value));
  if (valid.length === 0) {
    return fallback;
  }
  return valid.reduce((latest, current) =>
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest
  );
}

function mapWorkflowStatusToLeadStatus(status?: string | null): LeadStatus {
  const normalized = status?.toLowerCase() ?? '';
  switch (normalized) {
    case 'completed':
    case 'completed_success':
    case 'submitted':
      return 'Submitted';
    case 'approved':
      return 'Approved';
    case 'disbursed':
      return 'Disbursed';
    case 'rejected':
    case 'failed':
      return 'Rejected';
    default:
      return 'Draft';
  }
}

function mapSummaryItemToLead(item: ApplicationSummaryItem): Lead {
  const firstName = item.first_name ?? '';
  const lastName = item.last_name ?? '';
  const createdTimestamp = item.created_on ?? new Date().toISOString();

  return {
    id: item.application_id,
    appId: item.application_id,
    status: 'Draft',
    customerName: composeCustomerName(firstName, lastName, 'New Lead'),
    customerMobile: item.mobile_number ?? '',
    customerFirstName: firstName || undefined,
    customerLastName: lastName || undefined,
    currentStep: 1,
    formData: {
      coApplicants: [],
      step1: {
        firstName,
        lastName,
        mobile: item.mobile_number ?? '',
      },
    },
    payments: [],
    createdAt: createdTimestamp,
    updatedAt: createdTimestamp,
    hasDetails: false,
  };
}

function createLeadSkeleton(applicationId: string): Lead {
  const now = new Date().toISOString();
  return {
    id: applicationId,
    appId: applicationId,
    status: 'Draft',
    customerName: 'New Lead',
    customerMobile: '',
    currentStep: 1,
    formData: {
      coApplicants: [],
    },
    payments: [],
    createdAt: now,
    updatedAt: now,
    hasDetails: false,
  };
}

function mergeLeadData(base: Lead, updates: Partial<Lead>): Lead {
  const mergedFormData = {
    ...base.formData,
    ...(updates.formData ?? {}),
    coApplicants: updates.formData?.coApplicants ?? base.formData.coApplicants ?? [],
    step1: updates.formData?.step1 ?? base.formData.step1,
    step2: updates.formData?.step2 ?? base.formData.step2,
    step3: updates.formData?.step3 ?? base.formData.step3,
    step4: updates.formData?.step4 ?? base.formData.step4,
    step5: updates.formData?.step5 ?? base.formData.step5,
    step6: updates.formData?.step6 ?? base.formData.step6,
    step7: updates.formData?.step7 ?? base.formData.step7,
    step8: updates.formData?.step8 ?? base.formData.step8,
    step9_eval: updates.formData?.step9_eval ?? base.formData.step9_eval,
    step10: updates.formData?.step10 ?? base.formData.step10,
  };

  const firstName = updates.customerFirstName ?? mergedFormData?.step1?.firstName ?? base.customerFirstName;
  const lastName = updates.customerLastName ?? mergedFormData?.step1?.lastName ?? base.customerLastName;
  const customerName = composeCustomerName(firstName, lastName, updates.customerName ?? base.customerName);

  return {
    ...base,
    ...updates,
    customerFirstName: firstName || undefined,
    customerLastName: lastName || undefined,
    customerName: customerName || base.customerName,
    formData: mergedFormData,
    payments: updates.payments ?? base.payments,
    hasDetails: updates.hasDetails ?? base.hasDetails,
    updatedAt: new Date().toISOString(),
  };
}

function mapDetailedInfoToLead(baseLead: Lead, detail: DetailedInfoResponse): Lead {
  const workflowStatus = detail.workflow_state?.status ?? detail.workflow_status;
  const status = mapWorkflowStatusToLeadStatus(workflowStatus);
  const currentStep = baseLead.currentStep ?? 1;

  const newLeadData = detail.new_lead_data;
  const personalInfo = detail.personal_info;
  const personalInfoAny = personalInfo as any;
  const addressInfo = detail.address_info;
  const addressInfoAny = addressInfo as any;
  const stepData = detail.workflow_state?.step_data ?? {};

  const firstName = newLeadData?.first_name ?? baseLead.customerFirstName ?? '';
  const lastName = newLeadData?.last_name ?? baseLead.customerLastName ?? '';
  const mobileNumber = newLeadData?.mobile_number ?? baseLead.customerMobile;
  const customerName = composeCustomerName(firstName, lastName, baseLead.customerName);

  const completedSteps = detail.completed_steps ?? {};

  const loanDetails: any = (stepData as any).loan_details ?? {};
  const collateralDetails: any = (stepData as any).collateral_details ?? {};
  const documentsData: any = (stepData as any).documents ?? {};
  const coApplicantsData: any = (stepData as any).co_applicant_details;

  const addresses =
    addressInfo?.addresses?.map((addr, index) => {
      const addrAny = addr as any;
      return {
        id: `${detail.application_id}-address-${index}`,
        addressType: addr.address_type ?? '',
        addressLine1: addr.address_line_1 ?? '',
        addressLine2: addr.address_line_2 ?? '',
        addressLine3: addr.address_line_3 ?? '',
        cityId: addrAny?.city_id,
        postalCode: addr.pincode ?? '',
        isPrimary: addrAny?.is_primary ?? false,
        latitude: addrAny?.latitude,
        longitude: addrAny?.longitude,
      };
    }) ?? baseLead.formData.step3?.addresses;

  const coApplicants =
    Array.isArray(coApplicantsData?.coApplicants) && coApplicantsData?.coApplicants.length > 0
      ? coApplicantsData.coApplicants
      : baseLead.formData.coApplicants ?? [];

  const dob = personalInfo?.date_of_birth ?? baseLead.dob;
  const age = calculateAge(dob);

  const updatedAt = pickLatestTimestamp(
    [
      newLeadData?.created_at,
      personalInfoAny?.submitted_at,
      addressInfoAny?.submitted_at,
      (loanDetails as any)?.submitted_at,
      (collateralDetails as any)?.submitted_at,
    ],
    baseLead.updatedAt
  );

  return {
    ...baseLead,
    hasDetails: true,
    status,
    currentStep,
    customerName,
    customerFirstName: firstName || undefined,
    customerLastName: lastName || undefined,
    customerMobile: mobileNumber ?? '',
    panNumber: personalInfo?.pan_number ?? baseLead.panNumber,
    dob,
    age: age ?? baseLead.age,
    gender: personalInfo?.gender ?? baseLead.gender,
    loanAmount: loanDetails?.loan_amount ? Number(loanDetails.loan_amount) : baseLead.loanAmount,
    loanPurpose: loanDetails?.loan_purpose ?? baseLead.loanPurpose,
    step2Completed: completedSteps.personal_info ?? baseLead.step2Completed,
    step3Completed: completedSteps.address_details ?? baseLead.step3Completed,
    createdAt: newLeadData?.created_at ?? baseLead.createdAt,
    updatedAt,
    formData: {
      ...baseLead.formData,
      coApplicants,
      step1: {
        ...baseLead.formData.step1,
        productType: newLeadData?.product_type ?? baseLead.formData.step1?.productType,
        applicationType: newLeadData?.application_type ?? baseLead.formData.step1?.applicationType,
        mobile: mobileNumber ?? baseLead.formData.step1?.mobile,
        isMobileVerified: completedSteps.consent_mobile ?? baseLead.formData.step1?.isMobileVerified,
        firstName,
        lastName,
        createdAt: newLeadData?.created_at ?? baseLead.formData.step1?.createdAt,
      },
      step2: personalInfo
        ? {
            ...baseLead.formData.step2,
            hasPan: personalInfo.pan_number ? 'yes' : baseLead.formData.step2?.hasPan ?? 'no',
            autoFilledViaPAN: personalInfo.pan_number ? true : baseLead.formData.step2?.autoFilledViaPAN,
            panNumber: personalInfo.pan_number ?? baseLead.formData.step2?.panNumber,
            date_of_birth: personalInfo.date_of_birth ?? baseLead.formData.step2?.date_of_birth,
            dob: personalInfo.date_of_birth ?? baseLead.formData.step2?.dob,
            gender: personalInfo.gender ?? baseLead.formData.step2?.gender,
            alternateIdType: personalInfoAny?.alternate_id_type ?? baseLead.formData.step2?.alternateIdType,
            documentNumber: personalInfoAny?.alternate_id_number ?? baseLead.formData.step2?.documentNumber,
          }
        : baseLead.formData.step2,
      step3: addresses
        ? {
            ...baseLead.formData.step3,
            addresses,
          }
        : baseLead.formData.step3,
      step6:
        collateralDetails && Object.keys(collateralDetails).length > 0
          ? {
              ...baseLead.formData.step6,
              collateralType: collateralDetails.collateral_type ?? baseLead.formData.step6?.collateralType,
              collateralSubType: collateralDetails.collateral_sub_type ?? baseLead.formData.step6?.collateralSubType,
              ownershipType: collateralDetails.ownership_type ?? baseLead.formData.step6?.ownershipType,
              propertyValue: collateralDetails.property_value ?? baseLead.formData.step6?.propertyValue,
              location: collateralDetails.location ?? baseLead.formData.step6?.location,
              description: collateralDetails.description ?? baseLead.formData.step6?.description,
            }
          : baseLead.formData.step6,
      step7:
        loanDetails && Object.keys(loanDetails).length > 0
          ? {
              ...baseLead.formData.step7,
              loanAmount: loanDetails.loan_amount ? Number(loanDetails.loan_amount) : baseLead.formData.step7?.loanAmount,
              loanPurpose: loanDetails.loan_purpose ?? baseLead.formData.step7?.loanPurpose,
              purposeDescription: loanDetails.purpose_description ?? baseLead.formData.step7?.purposeDescription,
              interestRate: loanDetails.interest_rate ?? baseLead.formData.step7?.interestRate,
              tenure: loanDetails.tenure ?? baseLead.formData.step7?.tenure,
              sourcingChannel: loanDetails.sourcing_channel ?? baseLead.formData.step7?.sourcingChannel,
            }
          : baseLead.formData.step7,
      step8:
        documentsData && documentsData.files
          ? {
              ...baseLead.formData.step8,
              files: documentsData.files,
            }
          : baseLead.formData.step8,
    },
  };
}

export function LeadProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryStats, setSummaryStats] = useState<LeadSummaryStats>(DEFAULT_SUMMARY_STATS);

  const refreshLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchApplicationsSummary();
      if (isApiError(response)) {
        throw new Error(response.error || 'Failed to load applications.');
      }

      const data = response as ApplicationsSummaryResponse;

      setSummaryStats({
        total: data.total_applications ?? 0,
        draft: data.draft_applications ?? 0,
        completed: data.completed_applications ?? 0,
      });

      setLeads(prevLeads => {
        const prevMap = new Map(prevLeads.map(lead => [lead.appId || lead.id, lead]));
        const summaryIds = new Set<string>();

        const mapped = data.applications.map(item => {
          const baseLead = mapSummaryItemToLead(item);
          summaryIds.add(baseLead.appId);
          const existing = prevMap.get(baseLead.appId);
          if (existing) {
            return {
              ...existing,
              customerName: baseLead.customerName,
              customerFirstName: baseLead.customerFirstName,
              customerLastName: baseLead.customerLastName,
              customerMobile: baseLead.customerMobile,
              createdAt: baseLead.createdAt,
              updatedAt: existing.updatedAt ?? baseLead.updatedAt,
            };
          }
          return baseLead;
        });

        const preserved = prevLeads.filter(lead => {
          const identifier = lead.appId || lead.id;
          return identifier && !summaryIds.has(identifier);
        });

        return [...mapped, ...preserved];
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLeads();
  }, [refreshLeads]);

  const fetchLeadDetails = useCallback(
    async (applicationId: string, options?: { force?: boolean }) => {
      const identifier = applicationId;
      const existing = leads.find(lead => (lead.appId || lead.id) === identifier);

      if (existing?.hasDetails && !options?.force) {
        return existing;
      }

      try {
        const response = await getDetailedInfo(identifier);
        if (isApiError(response)) {
          throw new Error(response.error || 'Failed to load application details.');
        }

        const base = existing ?? createLeadSkeleton(identifier);
        if (!response.data) {
          setLeads(prevLeads => {
            const index = prevLeads.findIndex(lead => (lead.appId || lead.id) === base.appId);
            if (index >= 0) {
              const updated = [...prevLeads];
              updated[index] = base;
              return updated;
            }
            return [...prevLeads, base];
          });

          if (currentLead && (currentLead.appId === base.appId || currentLead.id === base.id)) {
            setCurrentLead(base);
          }

          return base;
        }

        const detailedLead = mapDetailedInfoToLead(base, response.data);

        setLeads(prevLeads => {
          const index = prevLeads.findIndex(lead => (lead.appId || lead.id) === detailedLead.appId);
          if (index >= 0) {
            const updated = [...prevLeads];
            updated[index] = detailedLead;
            return updated;
          }
          return [...prevLeads, detailedLead];
        });

        if (currentLead && (currentLead.appId === detailedLead.appId || currentLead.id === detailedLead.id)) {
          setCurrentLead(detailedLead);
        }

        return detailedLead;
      } catch (err: any) {
        throw err instanceof Error ? err : new Error(err?.message || 'Failed to load application details.');
      }
    },
    [leads, currentLead]
  );

  const createLead = useCallback(() => {
    const now = new Date().toISOString();
    const newLead: Lead = {
      id: Date.now().toString(),
      appId: '',
      status: 'Draft',
      customerName: '',
      customerMobile: '',
      currentStep: 1,
      formData: {
        coApplicants: [],
      },
      payments: [],
      createdAt: now,
      updatedAt: now,
      hasDetails: false,
    };
    setCurrentLead(newLead);
  }, []);

  const updateLead = useCallback(
    (leadId: string, data: Partial<Lead>) => {
      setLeads(prevLeads => prevLeads.map(lead => (lead.id === leadId ? mergeLeadData(lead, data) : lead)));
      setCurrentLead(prev => (prev && prev.id === leadId ? mergeLeadData(prev, data) : prev));
    },
    []
  );

  const addLeadToArray = useCallback(
    (lead: Lead) => {
      setLeads(prevLeads => {
        const index = prevLeads.findIndex(l => l.id === lead.id || (lead.appId && l.appId === lead.appId));
        if (index >= 0) {
          const updated = [...prevLeads];
          updated[index] = mergeLeadData(updated[index], lead);
          return updated;
        }
        return [...prevLeads, lead];
      });

      void refreshLeads();
    },
    [refreshLeads]
  );

  const submitLead = useCallback((leadId: string) => {
    const updatedAt = new Date().toISOString();
    setLeads(prevLeads =>
      prevLeads.map(lead =>
        lead.id === leadId ? { ...lead, status: 'Submitted', currentStep: 9, updatedAt } : lead
      )
    );
    setCurrentLead(prev =>
      prev && prev.id === leadId ? { ...prev, status: 'Submitted', currentStep: 9, updatedAt } : prev
    );
  }, []);

  const updateLeadStatus = useCallback((leadId: string, status: LeadStatus) => {
    const updatedAt = new Date().toISOString();
    setLeads(prevLeads =>
      prevLeads.map(lead => (lead.id === leadId ? { ...lead, status, updatedAt } : lead))
    );
    setCurrentLead(prev => (prev && prev.id === leadId ? { ...prev, status, updatedAt } : prev));
  }, []);

  const deleteLead = useCallback(
    (leadId: string) => {
      setLeads(prevLeads => prevLeads.filter(lead => lead.id !== leadId));
    if (currentLead?.id === leadId) {
      setCurrentLead(null);
    }
    },
    [currentLead]
  );

  const addPaymentToLead = useCallback((leadId: string, payment: PaymentSession) => {
    const updatedAt = new Date().toISOString();
    setLeads(prevLeads =>
      prevLeads.map(lead =>
        lead.id === leadId
          ? { ...lead, payments: [...(lead.payments || []), payment], updatedAt }
          : lead
      )
    );
    setCurrentLead(prev =>
      prev && prev.id === leadId
        ? { ...prev, payments: [...(prev.payments || []), payment], updatedAt }
        : prev
    );
  }, []);

  const updatePaymentInLead = useCallback(
    (leadId: string, paymentId: string, paymentUpdate: Partial<PaymentSession>) => {
      const updatedAt = new Date().toISOString();
      const updatePayments = (payments: PaymentSession[]) =>
        payments.map(payment => (payment.id === paymentId ? { ...payment, ...paymentUpdate } : payment));

      setLeads(prevLeads =>
        prevLeads.map(lead =>
          lead.id === leadId
            ? { ...lead, payments: updatePayments(lead.payments || []), updatedAt }
            : lead
        )
      );

      setCurrentLead(prev =>
        prev && prev.id === leadId
          ? { ...prev, payments: updatePayments(prev.payments || []), updatedAt }
          : prev
      );
    },
    []
  );

  const deletePaymentFromLead = useCallback((leadId: string, paymentId: string) => {
    const updatedAt = new Date().toISOString();
    const filterPayments = (payments: PaymentSession[]) => payments.filter(payment => payment.id !== paymentId);

    setLeads(prevLeads =>
      prevLeads.map(lead =>
        lead.id === leadId
          ? { ...lead, payments: filterPayments(lead.payments || []), updatedAt }
          : lead
      )
    );

    setCurrentLead(prev =>
      prev && prev.id === leadId
        ? { ...prev, payments: filterPayments(prev.payments || []), updatedAt }
        : prev
    );
  }, []);

  const createCoApplicant = useCallback((leadId: string, relationship: string): CoApplicant => {
      const newCoApplicant: CoApplicant = {
          id: Date.now().toString(),
          relationship,
          currentStep: 0,
          isComplete: false,
      data: {},
    };

    setLeads(prevLeads =>
      prevLeads.map(lead => {
        if (lead.id !== leadId) return lead;
        const coApplicants = [...(lead.formData.coApplicants ?? []), newCoApplicant];
        return {
          ...lead,
          formData: {
            ...lead.formData,
            coApplicants,
          },
          updatedAt: new Date().toISOString(),
        };
      })
    );

    setCurrentLead(prev => {
      if (!prev || prev.id !== leadId) return prev;
      const coApplicants = [...(prev.formData.coApplicants ?? []), newCoApplicant];
      return {
        ...prev,
                  formData: {
          ...prev.formData,
          coApplicants,
        },
        updatedAt: new Date().toISOString(),
      };
    });

    return newCoApplicant;
  }, []);

  const updateCoApplicant = useCallback(
    (leadId: string, coApplicantId: string, data: Partial<CoApplicant>) => {
      const updater = (coApps: CoApplicant[]) =>
        coApps.map(coApp => (coApp.id === coApplicantId ? { ...coApp, ...data } : coApp));

      setLeads(prevLeads =>
        prevLeads.map(lead => {
          if (lead.id !== leadId) return lead;
          const coApplicants = updater(lead.formData.coApplicants ?? []);
          return {
            ...lead,
            formData: {
              ...lead.formData,
              coApplicants,
            },
            updatedAt: new Date().toISOString(),
          };
        })
      );

      setCurrentLead(prev => {
        if (!prev || prev.id !== leadId) return prev;
        const coApplicants = updater(prev.formData.coApplicants ?? []);
              return {
          ...prev,
                  formData: {
            ...prev.formData,
            coApplicants,
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    []
  );

  const deleteCoApplicant = useCallback((leadId: string, coApplicantId: string) => {
    const filterer = (coApps: CoApplicant[]) => coApps.filter(coApp => coApp.id !== coApplicantId);

    setLeads(prevLeads =>
      prevLeads.map(lead => {
        if (lead.id !== leadId) return lead;
        const coApplicants = filterer(lead.formData.coApplicants ?? []);
        return {
          ...lead,
          formData: {
            ...lead.formData,
            coApplicants,
          },
          updatedAt: new Date().toISOString(),
        };
      })
    );

    setCurrentLead(prev => {
      if (!prev || prev.id !== leadId) return prev;
      const coApplicants = filterer(prev.formData.coApplicants ?? []);
              return {
        ...prev,
                  formData: {
          ...prev.formData,
          coApplicants,
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const startCoApplicantFlow = useCallback(
    (leadId: string, defaultRelationship: string) => {
      const newCoApplicant = createCoApplicant(leadId, defaultRelationship); 
      return newCoApplicant.id;
    },
    [createCoApplicant]
  );

  return (
    <LeadContext.Provider
      value={{
        leads,
        currentLead,
        loading,
        error,
        summaryStats,
        createLead,
        updateLead,
        addLeadToArray,
        submitLead,
        updateLeadStatus,
        setCurrentLead,
        deleteLead,
        addPaymentToLead,
        updatePaymentInLead,
        deletePaymentFromLead,
        refreshLeads,
        fetchLeadDetails,
        createCoApplicant,
        updateCoApplicant,
        deleteCoApplicant,
        startCoApplicantFlow,
      }}
    >
      {children}
    </LeadContext.Provider>
  );
}

export function useLead() {
  const context = useContext(LeadContext);
  if (context === undefined) {
    throw new Error('useLead must be used within a LeadProvider');
  }
  return context;
}
