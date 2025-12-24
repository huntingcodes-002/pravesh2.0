'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Loader } from 'lucide-react';
import { getAuthToken, calculateRisk, getDetailedInfo, isApiError, type ApiSuccess } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function LoanRequirementPage() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    loanAmount: currentLead?.loanAmount || 0,
    loanPurpose: currentLead?.loanPurpose || 'business_expansion',
    customPurpose: currentLead?.formData?.step7?.customPurpose || '',
    purposeDescription: currentLead?.formData?.step7?.purposeDescription || '',
    productCode: currentLead?.formData?.step7?.productCode || 'business_loan',
    schemeCode: currentLead?.formData?.step7?.schemeCode || '',
    interestRate: currentLead?.formData?.step7?.interestRate || '',
    tenure: currentLead?.formData?.step7?.tenure || '',
    tenureUnit: 'months',
    applicationType: currentLead?.formData?.step7?.applicationType || 'new',
    loanBranch: currentLead?.formData?.step7?.loanBranch || 'BR001',
    assignedOfficer: currentLead?.formData?.step7?.assignedOfficer || '',
    sourcingChannel: currentLead?.formData?.step7?.sourcingChannel || 'direct',
    sourcingBranch: currentLead?.formData?.step7?.sourcingBranch || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculateInterestOpen, setIsCalculateInterestOpen] = useState(false);
  const [occupancyStatus, setOccupancyStatus] = useState<string>('');
  const [assessmentMethod, setAssessmentMethod] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoadingRequiredData, setIsLoadingRequiredData] = useState(true);
  const [requiredDataError, setRequiredDataError] = useState<string>('');
  const [bureauScore, setBureauScore] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState<string>('');
  const [constructionType, setConstructionType] = useState<string>('');

  // Note: Data hydration from API is now handled in the fetchRequiredData useEffect
  // This useEffect is kept for backward compatibility as a fallback
  useEffect(() => {
    // Only populate from local state if we don't have appId (can't fetch from API)
    // or as a fallback if API fetch fails
    if (currentLead?.formData?.step7 && !currentLead?.appId) {
      const incoming = currentLead.formData.step7;
      setFormData({
        ...incoming,
        loanPurpose: 'business_expansion',
        productCode: 'business_loan',
        sourcingChannel: 'direct',
      });
    }
  }, [currentLead]);

  const setField = (key: string, value: string | number | string[]) => setFormData(prev => ({ ...prev, [key]: value }));

  const API_URL = 'https://uatlb.api.saarathifinance.com/api/lead-collection/applications/loan-details/';
  const HARD_CODED_LOAN_PURPOSE = 'business_expansion';

  const formatNumberWithCommas = (value: number): string => {
    if (isNaN(value) || value === 0) return '';
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: value % 1 !== 0 ? 2 : 0,
    });
  };

  const parseFormattedNumber = (formattedValue: string): number => {
    const numericValue = formattedValue.replace(/,/g, '').trim();
    const parsed = parseFloat(numericValue);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const handleLoanAmountChange = (value: string) => {
    const cleanValue = value.replace(/[^0-9.]/g, '');
    const numericValue = parseFormattedNumber(cleanValue);
    setField('loanAmount', numericValue);
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${(value / 1000).toFixed(0)}K`;
  };

  const handleSave = async () => {
    if (!currentLead || isSaving) return;

    if (!currentLead.appId) {
      toast({
        title: 'Application Missing',
        description: 'Application ID not found. Please complete the consent OTP verification first.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.loanAmount || formData.loanAmount <= 0) {
      toast({
        title: 'Loan amount required',
        description: 'Please enter a loan amount greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.interestRate && formData.interestRate !== 0) {
      toast({
        title: 'Interest rate required',
        description: 'Please provide an interest rate.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.tenure && formData.tenure !== 0) {
      toast({
        title: 'Tenure required',
        description: 'Please provide the tenure in months.',
        variant: 'destructive',
      });
      return;
    }

    const token = getAuthToken();
    if (!token) {
      toast({
        title: 'Authentication required',
        description: 'Your session has expired. Please sign in again to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const payload = {
      application_id: currentLead.appId,
      loan_amount_requested: Number(formData.loanAmount).toFixed(2),
      loan_purpose: HARD_CODED_LOAN_PURPOSE,
      loan_purpose_description: formData.purposeDescription?.trim() || 'string',
      product_code: 'business_loan',
      interest_rate: Number(formData.interestRate).toString(),
      tenure_months: Number(formData.tenure),
      sourcing_channel: 'direct',
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to save loan details.');
      }

      const data = await response.json();

      updateLead(currentLead.id, {
        formData: {
          ...currentLead.formData,
          step7: {
            ...formData,
            loanPurpose: HARD_CODED_LOAN_PURPOSE,
            productCode: 'business_loan',
            sourcingChannel: 'direct',
          },
        },
        loanAmount: formData.loanAmount,
        loanPurpose: HARD_CODED_LOAN_PURPOSE,
      });

      toast({
        title: 'Information Saved',
        description: data?.message || 'Loan requirement details have been saved successfully.',
        className: 'bg-green-50 border-green-200',
      });

      router.push('/lead/new-lead-info');
    } catch (error: any) {
      toast({
        title: 'Failed to save information',
        description: error?.message || 'Something went wrong while saving loan details.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };

  // Map bureau score numeric value to range format
  const mapBureauScoreToRange = (score: number | null): string => {
    if (score === null || score === undefined || score === 0) {
      return 'br_0_300';
    }
    if (score >= 0 && score <= 300) {
      return 'br_0_300';
    }
    if (score >= 301 && score <= 549) {
      return 'br_301_549';
    }
    if (score >= 550 && score <= 649) {
      return 'br_550_649';
    }
    if (score >= 650 && score <= 749) {
      return 'br_650_749';
    }
    if (score >= 750 && score <= 900) {
      return 'br_750_900';
    }
    // Default to lowest range if out of bounds
    return 'br_0_300';
  };

  // Map property_type from backend format to risk-calculator API format
  const mapPropertyType = (backendValue: string): string => {
    // Mapping from backend values to risk-calculator API expected values
    const propertyTypeMap: Record<string, string> = {
      'aamm': 'aaumm', // Backend uses "aamm", API expects "aaumm"
      'shb': 'shb',
      '90aapp': '90aapp',
      'dcml': 'dcml',
      'fhml': 'fhml',
      'gapcas': 'gapcas',
      'lhctfh': 'lhctfh',
      'gptpa': 'gptpa',
      'rlcp': 'rlcp',
      'pattatn': 'pattatn',
      '90breg': '90breg',
      'lhwren': 'lhwren',
      'muwpapp': 'muwpapp',
      'agrtitun': 'agrtitun',
      'revreco': 'revreco',
      'gpaunreg': 'gpaunreg',
      'agreoso': 'agreoso',
    };
    
    // Return mapped value or original if no mapping exists
    return propertyTypeMap[backendValue] || backendValue;
  };

  // Fetch required data from detailed-info API
  useEffect(() => {
    const fetchRequiredData = async () => {
      if (!currentLead?.appId) {
        setIsLoadingRequiredData(false);
        return;
      }

      setIsLoadingRequiredData(true);
      setRequiredDataError('');

      try {
        const response = await getDetailedInfo(currentLead.appId);
        if (isApiError(response)) {
          setRequiredDataError('Kindly Fill the previous steps in order to proceed with Loan Requirements');
          setIsLoadingRequiredData(false);
          return;
        }

        const successResponse = response as ApiSuccess<any>;
        const applicationDetails = successResponse.data?.application_details || successResponse.application_details || (response as any).application_details;
        
        // Get bureau_score from primary participant
        const participants = applicationDetails?.participants || [];
        const primaryParticipant = participants.find((p: any) => 
          p.participant_type === 'primary_participant'
        );
        
        const creditScore = primaryParticipant?.bureau_result?.data?.credit_report?.credit_score;
        const bureauScoreValue = creditScore === null || creditScore === undefined ? 0 : Number(creditScore);
        setBureauScore(bureauScoreValue);

        // Get property_type and construction_type from collateral_details
        const collateralDetails = applicationDetails?.collateral_details;
        if (collateralDetails) {
          setPropertyType(collateralDetails.property_type || '');
          setConstructionType(collateralDetails.construction_type || '');
        }

        // Get loan_details and populate form fields
        const loanDetails = applicationDetails?.loan_details;
        if (loanDetails && Object.keys(loanDetails).length > 0) {
          // Map loan_amount_requested to loanAmount (remove .00 suffix if present)
          const loanAmountValue = loanDetails.loan_amount_requested 
            ? parseFloat(String(loanDetails.loan_amount_requested).replace(/\.00$/, ''))
            : (currentLead?.loanAmount || 0);

          // Map interest_rate
          const interestRateValue = loanDetails.interest_rate 
            ? String(loanDetails.interest_rate).replace(/\.00$/, '')
            : (currentLead?.formData?.step7?.interestRate || '');

          // Map tenure_months to tenure
          const tenureValue = loanDetails.tenure_months 
            ? String(loanDetails.tenure_months)
            : (currentLead?.formData?.step7?.tenure || '');

          // Map loan_purpose
          const loanPurposeValue = loanDetails.loan_purpose || (currentLead?.loanPurpose || 'business_expansion');

          // Update form data with API values (only if they exist in API response)
          setFormData(prev => ({
            ...prev,
            ...(loanDetails.loan_amount_requested && { loanAmount: loanAmountValue }),
            ...(loanDetails.loan_purpose && { loanPurpose: loanPurposeValue }),
            ...(loanDetails.interest_rate && { interestRate: interestRateValue }),
            ...(loanDetails.tenure_months && { tenure: tenureValue }),
          }));
        } else if (currentLead?.formData?.step7) {
          // Fallback to local state if API doesn't have loan_details
          const step7 = currentLead.formData.step7;
          setFormData(prev => ({
            ...prev,
            loanAmount: step7.loanAmount || prev.loanAmount,
            loanPurpose: step7.loanPurpose || prev.loanPurpose,
            interestRate: step7.interestRate || prev.interestRate,
            tenure: step7.tenure || prev.tenure,
          }));
        }

        // Validate required data
        // Bureau score can be null (will be treated as 0), but property_type and construction_type are required
        if (!collateralDetails?.property_type || !collateralDetails?.construction_type) {
          setRequiredDataError('Kindly Fill the previous steps in order to proceed with Loan Requirements');
        }
      } catch (error) {
        console.error('Failed to fetch required data', error);
        setRequiredDataError('Kindly Fill the previous steps in order to proceed with Loan Requirements');
      } finally {
        setIsLoadingRequiredData(false);
      }
    };

    fetchRequiredData();
  }, [currentLead?.appId]);

  // Check if Calculate Interest button should be enabled
  const isCalculateInterestEnabled = 
    !requiredDataError &&
    formData.loanAmount > 0 && 
    formData.loanPurpose && 
    formData.tenure && 
    formData.tenure.toString().trim() !== '';

  // Occupancy Status options
  const occupancyStatuses = [
    { id: null, name: 'Select Occupancy Status' },
    { id: 'self_occupied', name: 'Self-Occupied Residential' },
    { id: 'rentedres', name: 'Rented Residential' },
    { id: 'mixed_use', name: 'Mix Use Residential' },
    { id: 'vacant', name: 'Vacant Residential' },
    { id: 'selfocccom', name: 'Self-Occupied Commercial' },
    { id: 'rented', name: 'Rented Commercial' },
    { id: 'mixusecom', name: 'Mix Use Commercial' },
    { id: 'vacantcom', name: 'Vacant Commercial' },
    { id: 'selfoccind', name: 'Self-Occupied Industrial' },
    { id: 'open', name: 'Vacant Open Land' },
  ];

  // Assessment Method options
  const assessmentMethods = [
    { id: null, name: 'Select Assessment Method' },
    { id: 'docin', name: 'Documented Income' },
    { id: 'rpm', name: 'Revenue Projection Method' },
    { id: 'btm', name: 'Banking Turnover Method' },
    { id: 'abbm', name: 'Average Bank Balance (ABB) Method' },
    { id: 'asip', name: 'Assessment Income Program' },
    { id: 'bsal', name: 'Bank Salaried' },
    { id: 'csal', name: 'Cash Salaried' },
  ];

  if (!currentLead) {
    return null;
  }

  // Show error message if required data is missing
  if (requiredDataError) {
    return (
      <DashboardLayout
        title="Loan Details & Requirements"
        showNotifications={false}
        showExitButton={true}
        onExit={handleExit}
      >
        <div className="max-w-2xl mx-auto pb-24">
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <p className="text-red-800 font-medium">{requiredDataError}</p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoadingRequiredData) {
    return (
      <DashboardLayout
        title="Loan Details & Requirements"
        showNotifications={false}
        showExitButton={true}
        onExit={handleExit}
      >
        <div className="max-w-2xl mx-auto pb-24">
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
            <div className="text-center py-12">
              <Loader className="w-8 h-8 animate-spin mx-auto text-[#0072CE]" />
              <p className="mt-4 text-gray-600">Loading required data...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Loan Details & Requirements"
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Loan Information</h2>

            <div className="space-y-6">
              <div>
                <Label>Loan Amount Requested <span className="text-red-500">*</span></Label>
                <div className="mt-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">₹</span>
                    <Input
                      id="loanAmount"
                      type="text"
                      value={formData.loanAmount > 0 ? formatNumberWithCommas(formData.loanAmount) : ''}
                      onChange={(e) => handleLoanAmountChange(e.target.value)}
                      placeholder="Enter loan amount (e.g., 1,00,000)"
                      className="h-12 pl-8"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span className="text-sm font-bold text-blue-600">{formData.loanAmount > 0 ? formatCurrency(formData.loanAmount) : ''}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="loanPurpose">Loan Purpose <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.loanPurpose}
                  onValueChange={(value: string) => setField('loanPurpose', value)}
                >
                  <SelectTrigger id="loanPurpose" className="h-12">
                    <SelectValue placeholder="Select loan purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business_expansion">Business Expansion</SelectItem>
                    <SelectItem value="working_capital">Working Capital</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="purposeDescription">Loan Purpose Description</Label>
                <Textarea
                  id="purposeDescription"
                  value={formData.purposeDescription}
                  onChange={(e) => setField('purposeDescription', e.target.value)}
                  placeholder="Optional description (max 100 characters)"
                  className="min-h-[80px]"
                  maxLength={100}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {formData.purposeDescription.length}/100 characters
                </div>
              </div>

              <div>
                <Label htmlFor="productCode" className="text-sm font-medium text-[#003366] mb-2 block">Product Code</Label>
                <div className="flex items-center px-4 h-12 bg-[#F3F4F6] border border-gray-300 rounded-lg">
                  <span className="text-[#003366] font-medium">Business Loan</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interestRate">Interest Rate (%) <span className="text-red-500">*</span></Label>
                  <Input
                    id="interestRate"
                    type="number"
                    value={formData.interestRate}
                    onChange={(e) => setField('interestRate', e.target.value)}
                    placeholder="12.5"
                    className="h-12 bg-gray-100 cursor-not-allowed"
                    step="0.1" min="0" max="50"
                    disabled={true}
                    readOnly={true}
                  />
                </div>

                <div>
                  <Label htmlFor="tenure">Tenure (Months) <span className="text-red-500">*</span></Label>
                  <Input
                    id="tenure"
                    type="number"
                    value={formData.tenure}
                    onChange={(e) => setField('tenure', e.target.value)}
                    placeholder="24"
                    className="h-12"
                    min="1" max="999"
                  />
                </div>
              </div>

              <div>
                <Button
                  type="button"
                  onClick={() => setIsCalculateInterestOpen(true)}
                  disabled={!isCalculateInterestEnabled}
                  className="w-full h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Calculate Interest
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Calculate Interest Dialog */}
        <Dialog 
          open={isCalculateInterestOpen} 
          onOpenChange={(open) => {
            setIsCalculateInterestOpen(open);
            if (!open) {
              // Reset values when dialog closes
              setOccupancyStatus('');
              setAssessmentMethod('');
            }
          }}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Calculate Interest</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div>
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  value={user?.branch?.code || 'N/A'}
                  disabled
                  className="h-12 bg-gray-100 cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="occupancyStatus">Occupancy Status <span className="text-red-500">*</span></Label>
                <Select
                  value={occupancyStatus}
                  onValueChange={(value: string) => setOccupancyStatus(value)}
                >
                  <SelectTrigger id="occupancyStatus" className="h-12 mt-2">
                    <SelectValue placeholder="Select Occupancy Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {occupancyStatuses
                      .filter((option) => option.id !== null)
                      .map((option) => (
                        <SelectItem 
                          key={option.id} 
                          value={option.id}
                        >
                          {option.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="assessmentMethod">Assessment Method <span className="text-red-500">*</span></Label>
                <Select
                  value={assessmentMethod}
                  onValueChange={(value: string) => setAssessmentMethod(value)}
                >
                  <SelectTrigger id="assessmentMethod" className="h-12 mt-2">
                    <SelectValue placeholder="Select Assessment Method" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessmentMethods
                      .filter((option) => option.id !== null)
                      .map((option) => (
                        <SelectItem 
                          key={option.id} 
                          value={option.id}
                        >
                          {option.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCalculateInterestOpen(false);
                    setOccupancyStatus('');
                    setAssessmentMethod('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    if (!currentLead?.appId || !user?.branch?.code) {
                      toast({
                        title: 'Error',
                        description: 'Application ID or branch information is missing.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    if (!occupancyStatus || !assessmentMethod) {
                      toast({
                        title: 'Validation Error',
                        description: 'Please select both Occupancy Status and Assessment Method.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    if (!propertyType || !constructionType) {
                      toast({
                        title: 'Error',
                        description: 'Property type and construction type are required. Please complete the collateral details step.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    setIsCalculating(true);
                    try {
                      const bureauScoreRange = mapBureauScoreToRange(bureauScore);
                      const mappedPropertyType = mapPropertyType(propertyType);
                      
                      const response = await calculateRisk({
                        branch: user.branch.code,
                        loan_amount: formData.loanAmount,
                        bureau_score: bureauScoreRange,
                        property_type: mappedPropertyType,
                        construction_type: constructionType,
                        occupancy_status: occupancyStatus,
                        assessment_method: assessmentMethod,
                      });

                      if (isApiError(response)) {
                        toast({
                          title: 'Calculation Failed',
                          description: response.error || 'Failed to calculate interest rate. Please try again.',
                          variant: 'destructive',
                        });
                        return;
                      }

                      // Extract total_score from response (it's the interest rate)
                      // Response structure: { total_score: 18.25, highlight: "loan_amount" }
                      const responseData = response as any;
                      const interestRate = responseData.total_score || responseData.data?.total_score;
                      
                      if (interestRate !== undefined && interestRate !== null) {
                        const interestRateString = String(interestRate);
                        setField('interestRate', interestRateString);
                        
                        toast({
                          title: 'Interest Rate Calculated',
                          description: `Interest rate has been set to ${interestRateString}%`,
                          className: 'bg-green-50 border-green-200',
                        });
                        
                        setIsCalculateInterestOpen(false);
                        setOccupancyStatus('');
                        setAssessmentMethod('');
                      } else {
                        toast({
                          title: 'Calculation Failed',
                          description: 'Interest rate not found in response. Please try again.',
                          variant: 'destructive',
                        });
                      }
                    } catch (error: any) {
                      toast({
                        title: 'Calculation Failed',
                        description: error?.message || 'An error occurred while calculating interest rate.',
                        variant: 'destructive',
                      });
                    } finally {
                      setIsCalculating(false);
                    }
                  }}
                  disabled={!occupancyStatus || !assessmentMethod || isCalculating}
                  className="bg-[#0072CE] hover:bg-[#005a9e]"
                >
                  {isCalculating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      Calculating...
                    </span>
                  ) : (
                    'Calculate'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Information'
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
