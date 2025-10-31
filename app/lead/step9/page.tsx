'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Edit, CheckCircle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressBar from '@/components/ProgressBar';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

export default function Step9Page() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  const [expandedSections, setExpandedSections] = useState({
    application: true,
    customer: false,
    loan: false,
  });
  const [moveToNextStage, setMoveToNextStage] = useState(false);
  
  const totalSteps = 10;


  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections({ ...expandedSections, [section]: !expandedSections[section] });
  };

  const handleEdit = (step: number) => {
    if (!currentLead) return;
    updateLead(currentLead.id, { currentStep: step });
    router.push(`/lead/step${step}`);
  };

  const handleNext = () => {
    if (!currentLead) return;

    updateLead(currentLead.id, {
      currentStep: 10,
    });
    router.push('/lead/step10');
  };
  
  const handleExit = () => {
    if (!currentLead) {
        router.push('/leads');
        return;
    }
    updateLead(currentLead.id, {
      currentStep: 9
    });
    router.push('/leads');
  };


  const handlePrevious = () => {
    router.push('/lead/step8');
  };

  const primaryAddress = currentLead?.formData?.step3?.addresses?.find((addr: any) => addr.isPrimary) || currentLead?.formData?.step3?.addresses?.[0];

  return (
    <DashboardLayout
      title="Review Application"
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24">
        <ProgressBar currentStep={8} totalSteps={totalSteps} />

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Application Review</h2>

            <div className="space-y-4">
              <Card className="border-2 border-blue-100">
                <CardContent className="p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('application')}
                  >
                    <h3 className="font-semibold text-gray-900">Application Summary</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(1);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {expandedSections.application ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>

                  {expandedSections.application && (
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Product Type:</span>
                        <span className="font-medium">
                          {currentLead?.formData?.step1?.productType || 'N/A'}
                        </span>
                      </div>
                       <div className="flex justify-between">
                        <span className="text-gray-600">Loan Amount:</span>
                        <span className="font-medium">
                          {currentLead?.loanAmount
                            ? `₹${currentLead.loanAmount.toLocaleString()}`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer Name:</span>
                        <span className="font-medium">
                          {currentLead?.customerName || 'N/A'}
                        </span>
                      </div>
                       <div className="flex justify-between">
                        <span className="text-gray-600">Application Ref:</span>
                        <span className="font-medium">
                          {currentLead?.appId || 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-green-100">
                <CardContent className="p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('customer')}
                  >
                    <h3 className="font-semibold text-gray-900">Customer Information</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(2);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {expandedSections.customer ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>

                  {expandedSections.customer && (
                    <div className="mt-4 space-y-2 text-sm">
                       <div className="flex justify-between">
                        <span className="text-gray-600">Mobile Number:</span>
                        <span className="font-medium">
                          {currentLead?.customerMobile || 'N/A'}
                        </span>
                      </div>
                      {currentLead?.formData?.step2?.hasPan === 'no' ? (
                        <div className="flex justify-between">
                            <span className="text-gray-600">{currentLead?.formData?.step2?.alternateIdType || 'Alternate ID'}:</span>
                            <span className="font-medium">{currentLead?.formData?.step2?.documentNumber || 'N/A'}</span>
                        </div>
                        ) : (
                        <div className="flex justify-between">
                            <span className="text-gray-600">PAN:</span>
                            <span className="font-medium">{currentLead?.panNumber || 'N/A'}</span>
                        </div>
                        )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date of Birth:</span>
                        <span className="font-medium">{currentLead?.dob || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Address:</span>
                         <span className="font-medium">
                            {primaryAddress ? `${primaryAddress.addressLine1}, ${primaryAddress.postalCode}` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-teal-100">
                <CardContent className="p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('loan')}
                  >
                    <h3 className="font-semibold text-gray-900">Loan Details</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(7);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {expandedSections.loan ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>

                  {expandedSections.loan && (
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Loan Purpose:</span>
                        <span className="font-medium">{currentLead?.loanPurpose || 'N/A'}</span>
                      </div>
                       <div className="flex justify-between">
                        <span className="text-gray-600">Interest Rate:</span>
                        <span className="font-medium">
                           {currentLead?.formData?.step7?.interestRate ? `${currentLead.formData.step7.interestRate}% p.a.` : 'N/A'}
                        </span>
                      </div>
                       <div className="flex justify-between">
                        <span className="text-gray-600">Tenure:</span>
                        <span className="font-medium">
                          {currentLead?.formData?.step7?.tenure ? `${currentLead.formData.step7.tenure} ${currentLead?.formData?.step7?.tenureUnit}` : 'N/A'}
                        </span>
                      </div>
                       <div className="flex justify-between">
                        <span className="text-gray-600">Application Type:</span>
                        <span className="font-medium">
                          {currentLead?.formData?.step1?.applicationType || 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-900">Validation Summary</h4>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  <span>All mandatory fields completed</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  <span>Customer verification successful</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  <span>Document validation passed</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 border border-gray-300 rounded-lg">
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="moveToNextStage"
                  checked={moveToNextStage}
                  onCheckedChange={(checked) => setMoveToNextStage(checked as boolean)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="moveToNextStage" className="text-sm font-medium text-gray-900 cursor-pointer block mb-1">
                    Move to Next Stage
                  </label>
                  <p className="text-xs text-gray-600">
                    By checking this box, you confirm that all information is accurate and complete, and the application is ready to proceed to the next stage.
                  </p>
                </div>
              </div>
            </div>
          </div>

        {/* <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
            <div className="flex gap-3 max-w-2xl mx-auto">
                <Button onClick={{handlePrevious}} variant="outline" className="flex-1 h-12 rounded-lg">
                  Previous
                </Button>
                <Button onClick={{handleSubmit}} className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]">
                    {{moveToNextStage ? 'Next' : 'Submit for Review'}}
                </Button>
            </div>
        </div> */}

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
            <div className="flex gap-3 max-w-2xl mx-auto">
                <Button onClick={handlePrevious} variant="outline" className="flex-1 h-12 rounded-lg">
                  Previous
                </Button>
                <Button 
                  onClick={handleNext} 
                  disabled={!moveToNextStage}
                  className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                    Next
                </Button>
            </div>
        </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
