'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, ArrowRight, Play } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressBar from '@/components/ProgressBar';
import { useLead, CoApplicant } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label'; 
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const RELATIONSHIPS = [
    { value: "Spouse", label: "Spouse (Husband / Wife)" },
    { value: "Parent", label: "Parent (Father / Mother)" },
    { value: "Sibling", label: "Sibling (Brother / Sister)" },
    { value: "Child", label: "Child (Son / Daughter)" },
    { value: "Grandparent", label: "Grandparent (Grandfather / Grandmother)" },
    { value: "Grandchild", label: "Grandchild (Grandson / Granddaughter)" },
    { value: "In-law", label: "In-law" },
    { value: "Relative", label: "Relative" },
    { value: "Non-family", label: "Non-family" },
    { value: "Other", label: "Other" },
];

// Helper function to check if co-applicant Step 1 (Contact) is complete
const isCoApplicantStep1Complete = (coApplicant: CoApplicant) => {
    return coApplicant.data?.step1?.isMobileVerified === true;
};

// Helper function to check if all mandatory sub-steps (1-4) are complete
const isCoApplicantApplicationComplete = (coApplicant: CoApplicant) => {
    // Check if step 4 was completed and marked as isComplete
    return coApplicant.isComplete === true;
};


export default function Step5Page() {
  const { currentLead, updateLead, deleteCoApplicant, startCoApplicantFlow } = useLead(); // <-- UPDATED to use startCoApplicantFlow
  const router = useRouter();

  // Added conditional check for currentLead
  const coApplicants: CoApplicant[] = currentLead?.formData?.coApplicants || [];

  // Determine if all added co-applicants are complete (Rule d)
  const canProceed = coApplicants.every(isCoApplicantApplicationComplete);
  

  const handleStartCoApplicantFlow = () => {
    if (!currentLead) {
        router.push('/leads'); 
        return;
    }
    
    // No default relationship - user must select
    const defaultRelationship = ''; 
    
    // 1. Create co-applicant and get its ID
    const newCoApplicantId = startCoApplicantFlow(currentLead.id, defaultRelationship);
    
    // 2. Start the co-applicant flow by navigating to step 1
    router.push(`/lead/step5/coapplicant/step1?coApplicantId=${newCoApplicantId}`);
  };
  
  const handleEditCoApplicant = (coApplicant: CoApplicant) => {
      // Redirect to the co-applicant's current step (Rule b)
      const targetStep = coApplicant.currentStep;
      router.push(`/lead/step5/coapplicant/step${targetStep}?coApplicantId=${coApplicant.id}`);
  };

  const handleExit = () => {
    if (!currentLead) {
        router.push('/leads');
        return;
    }
    // No need to explicitly save form data as it's updated in child components
    updateLead(currentLead.id, {
      currentStep: 5
    });
    router.push('/leads');
  };

  const handleNext = () => {
    if (!currentLead) return;
    // Condition to proceed is handled by canProceed state (Rule d)

    updateLead(currentLead.id, {
      currentStep: 6
    });
    router.push('/lead/step6');
  };

  const handlePrevious = () => {
    router.push('/lead/step3');
  };

  const getCoApplicantDisplay = (coApplicant: CoApplicant) => {
    const isComplete = isCoApplicantApplicationComplete(coApplicant);
    const step1Data = coApplicant.data?.step1;
    
    let displayName = "Incomplete";
    let subDetails = "Application flow not started.";
    let statusBadge = "bg-gray-200 text-gray-600";
    let actionIcon = <Play className="w-4 h-4" />;
    
    if (step1Data?.firstName) {
        displayName = `${step1Data.firstName} ${step1Data.lastName}`.trim();
        subDetails = `Mobile: ${step1Data.mobile || 'N/A'}`;
    }

    if (isComplete) {
        statusBadge = "bg-green-100 text-green-700";
        subDetails = `${coApplicant.relationship} | ${step1Data?.mobile || 'N/A'}`;
        actionIcon = <Edit className="w-4 h-4" />;
    } else if (coApplicant.currentStep > 1) {
         statusBadge = "bg-yellow-100 text-yellow-700";
         subDetails = `In Progress - Step ${coApplicant.currentStep} of 3`;
         actionIcon = <Play className="w-4 h-4" />; 
    } else if (coApplicant.currentStep === 1 && !isCoApplicantStep1Complete(coApplicant)) {
         statusBadge = "bg-red-100 text-red-700";
         subDetails = "Incomplete - Mobile consent pending";
         actionIcon = <Play className="w-4 h-4" />; 
    } else if (coApplicant.currentStep === 1 && isCoApplicantStep1Complete(coApplicant)) {
         statusBadge = "bg-blue-100 text-blue-700";
         subDetails = "Ready to proceed to Step 2 of 3";
         actionIcon = <Play className="w-4 h-4" />; 
    }


    return { displayName, subDetails, statusBadge, actionIcon, isComplete };
  };

  return (
    <DashboardLayout 
        title="Co-Applicant Details" 
        showNotifications={false}
        showExitButton={true} 
        onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto">
        <ProgressBar currentStep={4} totalSteps={10} />

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Co-Applicant Information</h2>

            {/* FIX: The onClick handler now points directly to the corrected routing function */}
            <Button
              onClick={handleStartCoApplicantFlow}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold mb-6"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Co-Applicant
            </Button>
            
            <div className="space-y-4">
              {coApplicants.map((coApplicant, index) => {
                const { displayName, subDetails, statusBadge, actionIcon, isComplete } = getCoApplicantDisplay(coApplicant);
                
                return (
                  <Card key={coApplicant.id} className={cn("border-2", isComplete ? 'border-green-100' : 'border-red-100')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
                            <Badge className={cn("text-xs font-semibold uppercase px-2 py-0.5", statusBadge)}>
                              {isComplete ? 'Complete' : 'Incomplete'}
                            </Badge>
                          </div>
                          {/* Use coApplicant.relationship directly */}
                          <p className="text-sm text-gray-600">{coApplicant.relationship}</p>
                          <p className="text-xs text-gray-500 mt-1">{subDetails}</p>
                        </div>
                        <div className="flex space-x-2 flex-shrink-0">
                          
                          {/* Edit/Continue Button (Rule b) */}
                           <Button 
                            onClick={() => handleEditCoApplicant(coApplicant)}
                            className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors p-0"
                            title={isComplete ? 'Edit Details' : 'Continue Application'}
                            >
                                {actionIcon}
                            </Button>
                        
                          {/* Delete Button */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                className="w-10 h-10 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors p-0"
                                title="Delete Co-Applicant"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently remove the co-applicant's details from this lead.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                    onClick={() => deleteCoApplicant(currentLead!.id, coApplicant.id)} 
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
              )})}

              {coApplicants.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No co-applicants added yet</p>
                  <p className="text-sm mt-1">Click the button above to add a co-applicant</p>
                </div>
              )}
              
              {!canProceed && coApplicants.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 flex-shrink-0" />
                    <p className='font-medium'>Cannot proceed to Step 6. Please complete all co-applicant applications or delete the incomplete entries.</p>
                  </div>
              )}
              
            </div>
          </div>


        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
            <div className="flex gap-3 max-w-2xl mx-auto">
                <Button onClick={handlePrevious} variant="outline" className="flex-1 h-12 rounded-lg">
                  Previous
                </Button>
                <Button onClick={handleNext} disabled={!canProceed} className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]">
                  Next
                </Button>
            </div>
        </div>

        </div>
      </div>
    </DashboardLayout>
  );
}