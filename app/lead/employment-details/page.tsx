'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { submitEmploymentInfo, isApiError, getDetailedInfo } from '@/lib/api';

export default function EmploymentDetailsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentLead, updateLead } = useLead();

  const [formData, setFormData] = useState({
    occupationType: '',
    monthlyIncome: '',
    employmentStatus: '',
    employedFrom: '',
    employedTo: '',
    employerName: '',
    designation: '',
    natureOfBusiness: '',
    industry: '',
    officialEmail: '',
    orgNameSENP: '',
    natureOfBusinessSENP: '',
    industrySENP: '',
    officialEmailSENP: '',
    orgNameSEP: '',
    natureOfProfession: '',
    industrySEP: '',
    registrationNumber: '',
    officialEmailSEP: '',
    natureOfOccupation: '',
  });

  useEffect(() => {
    const fetchEmploymentDetails = async () => {
      if (!currentLead?.appId) {
        if (currentLead?.formData?.step5) {
          setFormData(currentLead.formData.step5);
        }
        return;
      }

      try {
        const response = await getDetailedInfo(currentLead.appId);
        if (isApiError(response) || !response.success) {
          if (currentLead?.formData?.step5) {
            setFormData(currentLead.formData.step5);
          }
          return;
        }

        const participants = response.data?.application_details?.participants || [];
        const primaryParticipant = participants.find((p: any) => p.participant_type === 'primary_participant');

        if (primaryParticipant?.employment_details) {
          const apiData = primaryParticipant.employment_details;

          // Map API data to form structure
          const newFormData = { ...formData };

          // Helper to format date YYYY-MM-DD to DD-MM-YYYY
          const formatDate = (dateStr: string | null) => {
            if (!dateStr) return '';
            try {
              const date = parse(dateStr, 'yyyy-MM-dd', new Date());
              return format(date, 'dd-MM-yyyy');
            } catch {
              return '';
            }
          };

          // Occupation Type
          const occTypeMap: Record<string, string> = {
            'self_employed_non_professional': 'self-employed-non-professional',
            'self_employed_professional': 'self-employed-professional',
          };
          newFormData.occupationType = occTypeMap[apiData.occupation_type] || apiData.occupation_type || '';

          // Common fields
          newFormData.monthlyIncome = apiData.monthly_income ? String(apiData.monthly_income) : '';
          newFormData.employmentStatus = apiData.employment_status || '';
          newFormData.employedFrom = formatDate(apiData.employed_from);
          newFormData.employedTo = formatDate(apiData.employed_to);

          // Specific fields based on occupation type
          if (newFormData.occupationType === 'salaried') {
            newFormData.employerName = apiData.organization_name || '';
            newFormData.designation = apiData.designation || '';
            newFormData.natureOfBusiness = apiData.nature_of_occupation || '';
            newFormData.industry = apiData.industry || '';
            newFormData.officialEmail = apiData.official_email || '';
          } else if (newFormData.occupationType === 'self-employed-non-professional') {
            newFormData.orgNameSENP = apiData.organization_name || '';
            newFormData.natureOfBusinessSENP = apiData.nature_of_occupation || '';
            newFormData.industrySENP = apiData.industry || '';
            newFormData.officialEmailSENP = apiData.official_email || '';
          } else if (newFormData.occupationType === 'self-employed-professional') {
            newFormData.orgNameSEP = apiData.organization_name || '';
            newFormData.natureOfProfession = apiData.nature_of_occupation || '';
            newFormData.industrySEP = apiData.industry || '';
            newFormData.registrationNumber = apiData.registration_number || '';
            newFormData.officialEmailSEP = apiData.official_email || '';
          } else if (newFormData.occupationType === 'others') {
            newFormData.natureOfOccupation = apiData.nature_of_occupation || '';
          }

          setFormData(prev => ({ ...prev, ...newFormData }));
        } else if (currentLead?.formData?.step5) {
          setFormData(currentLead.formData.step5);
        }

      } catch (error) {
        console.error('Failed to fetch employment details', error);
        if (currentLead?.formData?.step5) {
          setFormData(currentLead.formData.step5);
        }
      }
    };

    fetchEmploymentDetails();
  }, [currentLead?.appId]);

  const setField = (key: string, value: string) => setFormData({ ...formData, [key]: value });

  const handleSave = async () => {
    if (!currentLead) {
      toast({
        title: 'Error',
        description: 'No lead found. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    // Map form data to API payload
    let occupationType = formData.occupationType;
    if (occupationType === 'self-employed-non-professional') occupationType = 'self_employed_non_professional';
    if (occupationType === 'self-employed-professional') occupationType = 'self_employed_professional';

    let natureOfOccupation = '';
    let organizationName = '';
    let designation = '';
    let industry = '';
    let officialEmail = '';
    let registrationNumber = '';

    if (formData.occupationType === 'salaried') {
      natureOfOccupation = formData.natureOfBusiness;
      organizationName = formData.employerName;
      designation = formData.designation;
      industry = formData.industry;
      officialEmail = formData.officialEmail;
    } else if (formData.occupationType === 'self-employed-non-professional') {
      natureOfOccupation = formData.natureOfBusinessSENP;
      organizationName = formData.orgNameSENP;
      industry = formData.industrySENP;
      officialEmail = formData.officialEmailSENP;
    } else if (formData.occupationType === 'self-employed-professional') {
      natureOfOccupation = formData.natureOfProfession;
      organizationName = formData.orgNameSEP;
      industry = formData.industrySEP;
      registrationNumber = formData.registrationNumber;
      officialEmail = formData.officialEmailSEP;
    } else if (formData.occupationType === 'others') {
      natureOfOccupation = formData.natureOfOccupation;
    }

    const formatDate = (dateStr: string) => {
      if (!dateStr) return null;
      try {
        const date = parse(dateStr, 'dd-MM-yyyy', new Date());
        return format(date, 'yyyy-MM-dd');
      } catch (e) {
        return null;
      }
    };

    const payload = {
      application_id: currentLead.id,
      occupation_type: occupationType,
      nature_of_occupation: natureOfOccupation,
      organization_name: organizationName,
      designation: designation,
      industry: industry || undefined,
      employment_status: formData.employmentStatus || undefined,
      monthly_income: formData.monthlyIncome,
      employed_from: formatDate(formData.employedFrom),
      employed_to: formatDate(formData.employedTo),
      official_email: officialEmail,
      registration_number: registrationNumber,
    };

    try {
      const response = await submitEmploymentInfo(payload);

      if (isApiError(response)) {
        toast({
          title: 'Error',
          description: response.error || 'Failed to save employment details.',
          variant: 'destructive',
        });
        return;
      }

      updateLead(currentLead.id, {
        formData: {
          ...currentLead.formData,
          step5: formData,
        },
      });

      toast({
        title: 'Success',
        description: 'Employment details saved successfully.',
      });

      router.push('/lead/new-lead-info');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  const handleExit = () => {
    router.push('/lead/new-lead-info');
  };

  const canProceed = () => {
    if (!formData.occupationType || !formData.monthlyIncome) return false;

    const checkDateLogic = () => {
      const baseValid = formData.employmentStatus && formData.employedFrom;
      if (formData.employmentStatus === 'past') {
        if (!formData.employedTo) return false;
        const fromDate = parse(formData.employedFrom, 'dd-MM-yyyy', new Date());
        const toDate = parse(formData.employedTo, 'dd-MM-yyyy', new Date());
        return baseValid && toDate > fromDate;
      }
      return baseValid;
    };

    switch (formData.occupationType) {
      case 'others':
        return formData.natureOfOccupation !== '';
      case 'salaried':
        return formData.employerName && formData.natureOfBusiness && formData.industry && checkDateLogic();
      case 'self-employed-non-professional':
        return formData.orgNameSENP && formData.natureOfBusinessSENP && formData.industrySENP && checkDateLogic();
      case 'self-employed-professional':
        return formData.orgNameSEP && formData.natureOfProfession && formData.industrySEP && formData.registrationNumber && checkDateLogic();
      default:
        return false;
    }
  };

  const renderDateFields = () => (
    <>
      <div>
        <Label htmlFor="employmentStatus">
          Status <span className="text-red-500">*</span>
        </Label>
        <Select
          value={formData.employmentStatus}
          onValueChange={(value: string) => setField('employmentStatus', value)}
        >
          <SelectTrigger id="employmentStatus" className="h-12">
            <SelectValue placeholder="Select Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="past">Past</SelectItem>
            <SelectItem value="present">Present</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="employedFrom">
          From <span className="text-red-500">*</span>
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full h-12 justify-start text-left font-normal",
                !formData.employedFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.employedFrom || <span>Select date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={formData.employedFrom ? parse(formData.employedFrom, 'dd-MM-yyyy', new Date()) : undefined}
              onSelect={(date) => {
                if (date) {
                  setField('employedFrom', format(date, 'dd-MM-yyyy'));
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {formData.employmentStatus === 'past' && (
        <div>
          <Label htmlFor="employedTo">
            To <span className="text-red-500">*</span>
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-12 justify-start text-left font-normal",
                  !formData.employedTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.employedTo || <span>Select date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.employedTo ? parse(formData.employedTo, 'dd-MM-yyyy', new Date()) : undefined}
                onSelect={(date) => {
                  if (date) {
                    setField('employedTo', format(date, 'dd-MM-yyyy'));
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </>
  );

  return (
    <DashboardLayout
      title="Employment Details"
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Employment Information</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="occupationType">
                Occupation Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.occupationType}
                onValueChange={(value: string) => setField('occupationType', value)}
              >
                <SelectTrigger id="occupationType" className="h-12">
                  <SelectValue placeholder="Select Occupation Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salaried">Salaried</SelectItem>
                  <SelectItem value="self-employed-non-professional">
                    Self Employed Non Professional
                  </SelectItem>
                  <SelectItem value="self-employed-professional">
                    Self Employed Professional
                  </SelectItem>
                  <SelectItem value="others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.occupationType === 'others' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="natureOfOccupation">
                    Nature of Occupation <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.natureOfOccupation}
                    onValueChange={(value: string) => setField('natureOfOccupation', value)}
                  >
                    <SelectTrigger id="natureOfOccupation" className="h-12">
                      <SelectValue placeholder="Select Nature of Occupation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="housewife">Housewife</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {formData.occupationType === 'salaried' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="employerName">
                    Employer Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="employerName"
                    value={formData.employerName}
                    onChange={(e) => setField('employerName', e.target.value)}
                    placeholder="Enter employer name"
                    className="h-12"
                  />
                </div>
                <div>
                  <Label htmlFor="designation">
                    Designation <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="designation"
                    value={formData.designation}
                    onChange={(e) => setField('designation', e.target.value)}
                    placeholder="Enter designation"
                    className="h-12"
                  />
                </div>
                <div>
                  <Label htmlFor="natureOfBusiness">
                    Nature of Business <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.natureOfBusiness}
                    onValueChange={(value: string) => setField('natureOfBusiness', value)}
                  >
                    <SelectTrigger id="natureOfBusiness" className="h-12">
                      <SelectValue placeholder="Select Nature of Business" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agriculture">Agriculture</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                      <SelectItem value="trading">Trading</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="industry">
                    Industry <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value: string) => setField('industry', value)}
                  >
                    <SelectTrigger id="industry" className="h-12">
                      <SelectValue placeholder="Select Industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automobile">Automobile</SelectItem>
                      <SelectItem value="construction">Construction</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="gems_and_jewellery">Gems & Jewellery</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="hospitality">Hospitality</SelectItem>
                      <SelectItem value="other_services">Other Services</SelectItem>
                      <SelectItem value="personal_care">Personal Care</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="transportation">Transportation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {renderDateFields()}
                <div>
                  <Label htmlFor="officialEmail">
                    Official Email ID (Optional)
                  </Label>
                  <Input
                    id="officialEmail"
                    type="email"
                    value={formData.officialEmail}
                    onChange={(e) => setField('officialEmail', e.target.value)}
                    placeholder="Enter official email"
                    className="h-12"
                  />
                </div>
              </div>
            )}

            {formData.occupationType === 'self-employed-non-professional' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orgNameSENP">
                    Organization Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="orgNameSENP"
                    value={formData.orgNameSENP}
                    onChange={(e) => setField('orgNameSENP', e.target.value)}
                    placeholder="Enter organization name"
                    className="h-12"
                  />
                </div>
                <div>
                  <Label htmlFor="natureOfBusinessSENP">
                    Nature of Business <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.natureOfBusinessSENP}
                    onValueChange={(value: string) => setField('natureOfBusinessSENP', value)}
                  >
                    <SelectTrigger id="natureOfBusinessSENP" className="h-12">
                      <SelectValue placeholder="Select Nature of Business" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agriculture">Agriculture</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                      <SelectItem value="trading">Trading</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="industrySENP">
                    Industry <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.industrySENP}
                    onValueChange={(value: string) => setField('industrySENP', value)}
                  >
                    <SelectTrigger id="industrySENP" className="h-12">
                      <SelectValue placeholder="Select Industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automobile">Automobile</SelectItem>
                      <SelectItem value="construction">Construction</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="gems_and_jewellery">Gems & Jewellery</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="hospitality">Hospitality</SelectItem>
                      <SelectItem value="other_services">Other Services</SelectItem>
                      <SelectItem value="personal_care">Personal Care</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="transportation">Transportation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {renderDateFields()}
                <div>
                  <Label htmlFor="officialEmailSENP">
                    Official Email ID (Optional)
                  </Label>
                  <Input
                    id="officialEmailSENP"
                    type="email"
                    value={formData.officialEmailSENP}
                    onChange={(e) => setField('officialEmailSENP', e.target.value)}
                    placeholder="Enter official email"
                    className="h-12"
                  />
                </div>
              </div>
            )}

            {formData.occupationType === 'self-employed-professional' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orgNameSEP">
                    Organization Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="orgNameSEP"
                    value={formData.orgNameSEP}
                    onChange={(e) => setField('orgNameSEP', e.target.value)}
                    placeholder="Enter organization name"
                    className="h-12"
                  />
                </div>
                <div>
                  <Label htmlFor="natureOfProfession">
                    Nature of Profession <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.natureOfProfession}
                    onValueChange={(value: string) => setField('natureOfProfession', value)}
                  >
                    <SelectTrigger id="natureOfProfession" className="h-12">
                      <SelectValue placeholder="Select Nature of Profession" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="architect">Architect</SelectItem>
                      <SelectItem value="ca">CA</SelectItem>
                      <SelectItem value="company-secretary">Company Secretary</SelectItem>
                      <SelectItem value="cost-accountant">Cost Accountant</SelectItem>
                      <SelectItem value="doctor">Doctor</SelectItem>
                      <SelectItem value="lawyer">Lawyer</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="industrySEP">
                    Industry <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.industrySEP}
                    onValueChange={(value: string) => setField('industrySEP', value)}
                  >
                    <SelectTrigger id="industrySEP" className="h-12">
                      <SelectValue placeholder="Select Industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automobile">Automobile</SelectItem>
                      <SelectItem value="construction">Construction</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="gems_and_jewellery">Gems & Jewellery</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="hospitality">Hospitality</SelectItem>
                      <SelectItem value="other_services">Other Services</SelectItem>
                      <SelectItem value="personal_care">Personal Care</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="transportation">Transportation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="registrationNumber">
                    Registration Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={(e) => setField('registrationNumber', e.target.value)}
                    placeholder="Enter registration number"
                    className="h-12"
                  />
                </div>
                {renderDateFields()}
                <div>
                  <Label htmlFor="officialEmailSEP">
                    Official Email ID (Optional)
                  </Label>
                  <Input
                    id="officialEmailSEP"
                    type="email"
                    value={formData.officialEmailSEP}
                    onChange={(e) => setField('officialEmailSEP', e.target.value)}
                    placeholder="Enter official email"
                    className="h-12"
                  />
                </div>
              </div>
            )}

            {/* Monthly Income Field - Always Visible if Occupation Type is Selected */}
            {formData.occupationType && (
              <div>
                <Label htmlFor="monthlyIncome">
                  Monthly Income <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    value={formData.monthlyIncome}
                    onChange={(e) => setField('monthlyIncome', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter monthly income"
                    className="h-12 pl-8"
                  />
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={!canProceed()}
              className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white"
            >
              Save Information
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

