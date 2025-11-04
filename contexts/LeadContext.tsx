'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // <-- ADDED import useRouter

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
    currentStep: 1 | 2 | 3 | 4;
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
}

interface LeadContextType {
  leads: Lead[];
  currentLead: Lead | null;
  createLead: () => void;
  updateLead: (leadId: string, data: Partial<Lead>) => void;
  submitLead: (leadId: string) => void;
  updateLeadStatus: (leadId: string, status: LeadStatus) => void;
  setCurrentLead: (lead: Lead | null) => void;
  deleteLead: (leadId: string) => void;
  addPaymentToLead: (leadId: string, payment: PaymentSession) => void;
  updatePaymentInLead: (leadId: string, paymentId: string, paymentUpdate: Partial<PaymentSession>) => void;
  deletePaymentFromLead: (leadId: string, paymentId: string) => void;
  
  // Co-Applicant specific functions
  createCoApplicant: (leadId: string, relationship: string) => CoApplicant;
  updateCoApplicant: (leadId: string, coApplicantId: string, data: Partial<CoApplicant>) => void;
  deleteCoApplicant: (leadId: string, coApplicantId: string) => void;
  
  // NEW FUNCTION FOR ROUTING FIX
  startCoApplicantFlow: (leadId: string, defaultRelationship: string) => string; 
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

const STORAGE_KEY = 'leads';

export function LeadProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const router = useRouter(); // Initialize router here

  useEffect(() => {
    const storedLeads = localStorage.getItem(STORAGE_KEY);
    if (storedLeads) {
      setLeads(JSON.parse(storedLeads));
    }
  }, []);

  const saveLeads = (updatedLeads: Lead[]) => {
    setLeads(updatedLeads);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLeads));
  };

  const createLead = () => {
    const newLead: Lead = {
      id: Date.now().toString(),
      appId: `APP-2025-${String(leads.length + 1).padStart(3, '0')}`,
      status: 'Draft',
      customerName: '',
      customerMobile: '',
      currentStep: 1,
      formData: {
          coApplicants: []
      },
      payments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updatedLeads = [...leads, newLead];
    saveLeads(updatedLeads);
    setCurrentLead(newLead);
  };

  const updateLead = (leadId: string, data: Partial<Lead>) => {
    let updatedCurrent: Lead | undefined;
    const updatedLeads = leads.map(lead => {
      if (lead.id === leadId) {
        updatedCurrent = {
            ...lead,
            ...data,
            customerName: `${data.customerFirstName || lead.customerFirstName || ''} ${data.customerLastName || lead.customerLastName || ''}`.trim() || lead.customerName,
            updatedAt: new Date().toISOString()
        };
        return updatedCurrent;
      }
      return lead;
    });
    saveLeads(updatedLeads);
    if (currentLead?.id === leadId && updatedCurrent) {
      setCurrentLead(updatedCurrent);
    }
  };

  const submitLead = (leadId: string) => {
    const updatedLeads = leads.map(lead =>
      lead.id === leadId
        ? { ...lead, status: 'Submitted' as const, currentStep: 9, updatedAt: new Date().toISOString() }
        : lead
    );
    saveLeads(updatedLeads);
  };

  const updateLeadStatus = (leadId: string, status: LeadStatus) => {
    const updatedLeads = leads.map(lead =>
      lead.id === leadId
        ? { ...lead, status: status, updatedAt: new Date().toISOString() }
        : lead
    );
    saveLeads(updatedLeads);
  };

  const deleteLead = (leadId: string) => {
    const updatedLeads = leads.filter(lead => lead.id !== leadId);
    saveLeads(updatedLeads);
    if (currentLead?.id === leadId) {
      setCurrentLead(null);
    }
  };

  const addPaymentToLead = (leadId: string, payment: PaymentSession) => {
    let updatedLead: Lead | undefined;
    const updatedLeads = leads.map(lead => {
      if (lead.id === leadId) {
        updatedLead = { ...lead, payments: [...(lead.payments || []), payment], updatedAt: new Date().toISOString() };
        return updatedLead;
      }
      return lead;
    });
    saveLeads(updatedLeads);
    if (currentLead?.id === leadId && updatedLead) {
        setCurrentLead(updatedLead);
    }
  };

  const updatePaymentInLead = (leadId: string, paymentId: string, paymentUpdate: Partial<PaymentSession>) => {
    let updatedLead: Lead | undefined;
    const updatedLeads = leads.map(lead => {
      if (lead.id === leadId) {
        const updatedPayments = (lead.payments || []).map(p => // Safely access payments
          p.id === paymentId ? { ...p, ...paymentUpdate, updatedAt: new Date().toISOString() } : p
        );
        updatedLead = { ...lead, payments: updatedPayments, updatedAt: new Date().toISOString() };
        return updatedLead;
      }
      return lead;
    });
    saveLeads(updatedLeads);
    if (currentLead?.id === leadId && updatedLead) {
        setCurrentLead(updatedLead);
    }
  };
  
  const deletePaymentFromLead = (leadId: string, paymentId: string) => {
    let updatedLead: Lead | undefined;
    const updatedLeads = leads.map(lead => {
        if (lead.id === leadId) {
            const updatedPayments = (lead.payments || []).filter(p => p.id !== paymentId); // Safely filter payments
            updatedLead = { ...lead, payments: updatedPayments, updatedAt: new Date().toISOString() };
            return updatedLead;
        }
        return lead;
    });
    saveLeads(updatedLeads);
    if (currentLead?.id === leadId && updatedLead) {
        setCurrentLead(updatedLead);
    }
  };
  
  // --- Co-Applicant Logic ---
  
  const createCoApplicant = (leadId: string, relationship: string): CoApplicant => {
      const newCoApplicant: CoApplicant = {
          id: Date.now().toString(),
          relationship,
          currentStep: 1,
          isComplete: false,
          data: {}
      };
      
      let updatedCoApplicant: CoApplicant | undefined; // Capture the newly created co-applicant
      
      const updatedLeads = leads.map((l: Lead) => {
          if (l.id === leadId) {
              const currentCoApplicants: CoApplicant[] = l.formData.coApplicants || [];
              updatedCoApplicant = newCoApplicant;
              
              const updatedCoApplicantsList = [...currentCoApplicants, newCoApplicant];
              
              const updatedLead = {
                  ...l,
                  formData: {
                      ...l.formData,
                      coApplicants: updatedCoApplicantsList
                  },
                  updatedAt: new Date().toISOString()
              };
              
              // Ensure currentLead state is updated immediately to reflect the new ID
              if (currentLead && currentLead.id === leadId) {
                  setCurrentLead(updatedLead);
              }
              
              return updatedLead;
          }
          return l;
      });
      saveLeads(updatedLeads);
      
      return newCoApplicant; // Return the newly created object for routing
  };
  
  const updateCoApplicant = (leadId: string, coApplicantId: string, data: Partial<CoApplicant>) => {
      const updatedLeads = leads.map((l: Lead) => {
          if (l.id === leadId) {
              const updatedCoApplicants = (l.formData.coApplicants || []).map((coApp: CoApplicant) => {
                  if (coApp.id === coApplicantId) {
                      return { ...coApp, ...data };
                  }
                  return coApp;
              });
              return {
                  ...l,
                  formData: {
                      ...l.formData,
                      coApplicants: updatedCoApplicants
                  },
                  updatedAt: new Date().toISOString()
              };
          }
          return l;
      });
      saveLeads(updatedLeads);
      
      const updatedCurrent = updatedLeads.find((l: Lead) => l.id === leadId);
      if (updatedCurrent) {
        setCurrentLead(updatedCurrent);
      }
  };

  const deleteCoApplicant = (leadId: string, coApplicantId: string) => {
      const updatedLeads = leads.map((l: Lead) => {
          if (l.id === leadId) {
              const updatedCoApplicants = (l.formData.coApplicants || []).filter((coApp: CoApplicant) => coApp.id !== coApplicantId);
              return {
                  ...l,
                  formData: {
                      ...l.formData,
                      coApplicants: updatedCoApplicants
                  },
                  updatedAt: new Date().toISOString()
              };
          }
          return l;
      });
      saveLeads(updatedLeads);
      
      const updatedCurrent = updatedLeads.find((l: Lead) => l.id === leadId);
      if (updatedCurrent) {
        setCurrentLead(updatedCurrent);
      }
  };
  
  // NEW FUNCTION: Handles creation and returns co-applicant ID
  const startCoApplicantFlow = (leadId: string, defaultRelationship: string) => {
      // 1. Create co-applicant and update global state
      const newCoApplicant = createCoApplicant(leadId, defaultRelationship); 
      
      // 2. Return the co-applicant ID so the caller can start the flow
      return newCoApplicant.id;
  }


  return (
    <LeadContext.Provider
      value={{
        leads,
        currentLead,
        createLead,
        updateLead,
        submitLead,
        updateLeadStatus,
        setCurrentLead,
        deleteLead,
        addPaymentToLead,
        updatePaymentInLead,
        deletePaymentFromLead,
        createCoApplicant,
        updateCoApplicant,
        deleteCoApplicant,
        startCoApplicantFlow, // <-- EXPOSED NEW FUNCTION
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
