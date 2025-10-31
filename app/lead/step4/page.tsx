'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressBar from '@/components/ProgressBar';
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

export default function Step4Page() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();

  const [formData, setFormData] = useState({
    occupationType: currentLead?.formData?.step5?.occupationType || '',
    // Others
    natureOfOccupation: currentLead?.formData?.step5?.natureOfOccupation || '',
    // Salaried
    employerName: currentLead?.formData?.step5?.employerName || '',
    natureOfBusiness: currentLead?.formData?.step5?.natureOfBusiness || '',
    industry: currentLead?.formData?.step5?.industry || '',
    employmentStatus: currentLead?.formData?.step5?.employmentStatus || '',
    employedFrom: currentLead?.formData?.step5?.employedFrom || '',
    employedTo: currentLead?.formData?.step5?.employedTo || '',
    officialEmail: currentLead?.formData?.step5?.officialEmail || '',
    // Self Employed Non-Professional
    orgNameSENP: currentLead?.formData?.step5?.orgNameSENP || '',
    natureOfBusinessSENP: currentLead?.formData?.step5?.natureOfBusinessSENP || '',
    industrySENP: currentLead?.formData?.step5?.industrySENP || '',
    yearsInProfessionSENP: currentLead?.formData?.step5?.yearsInProfessionSENP || '',
    monthsInProfessionSENP: currentLead?.formData?.step5?.monthsInProfessionSENP || '',
    officialEmailSENP: currentLead?.formData?.step5?.officialEmailSENP || '',
    // Self Employed Professional
    orgNameSEP: currentLead?.formData?.step5?.orgNameSEP || '',
    natureOfProfession: currentLead?.formData?.step5?.natureOfProfession || '',
    industrySEP: currentLead?.formData?.step5?.industrySEP || '',
    registrationNumber: currentLead?.formData?.step5?.registrationNumber || '',
    yearsInProfessionSEP: currentLead?.formData?.step5?.yearsInProfessionSEP || '',
    monthsInProfessionSEP: currentLead?.formData?.step5?.monthsInProfessionSEP || '',
    officialEmailSEP: currentLead?.formData?.step5?.officialEmailSEP || '',
  });

  useEffect(() => {
    if (currentLead?.formData?.step5) {
      setFormData(currentLead.formData.step5);
    }
  }, [currentLead]);

  const setField = (key: string, value: string) => setFormData({ ...formData, [key]: value });

  const handleNext = () => {
    if (!currentLead) return;

    updateLead(currentLead.id, {
      formData: {
        ...currentLead.formData,
        step5: formData,
      },
      currentStep: 5,
    });
    router.push('/lead/step5');
  };

  const handleExit = () => {
    if (!currentLead) {
      router.push('/leads');
      return;
    }
    updateLead(currentLead.id, {
      formData: {
        ...currentLead.formData,
        step5: formData,
      },
      currentStep: 4,
    });
    router.push('/leads');
  };

  const handlePrevious = () => {
    router.push('/lead/step3');
  };
  
  const canProceed = () => {
    if (!formData.occupationType) return false;
    
    switch (formData.occupationType) {
      case 'others':
        return formData.natureOfOccupation !== '';
      case 'salaried':
        const baseValid = formData.employerName && formData.natureOfBusiness && formData.industry && formData.employmentStatus && formData.employedFrom;
        if (formData.employmentStatus === 'past') {
          // Validate that employedTo is after employedFrom
          if (!formData.employedTo) return false;
          const fromDate = parse(formData.employedFrom, 'dd-MM-yyyy', new Date());
          const toDate = parse(formData.employedTo, 'dd-MM-yyyy', new Date());
          return baseValid && toDate > fromDate;
        }
        return baseValid;
      case 'self-employed-non-professional':
        return formData.orgNameSENP && formData.natureOfBusinessSENP && formData.industrySENP && formData.yearsInProfessionSENP && formData.monthsInProfessionSENP;
      case 'self-employed-professional':
        return formData.orgNameSEP && formData.natureOfProfession && formData.industrySEP && formData.registrationNumber && formData.yearsInProfessionSEP && formData.monthsInProfessionSEP;
      default:
        return false;
    }
  };

  return (
    <DashboardLayout
      title="Employment Details"
      showNotifications={false}
      showExitButton={true}
      onExit={handleExit}
    >
      <div className="max-w-2xl mx-auto pb-24">
        <ProgressBar currentStep={4} totalSteps={11} />

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
                      <SelectItem value="others">Others</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
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
                      <SelectItem value="gems-jewellery">Gems & Jewellery</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="hospitality">Hospitality</SelectItem>
                      <SelectItem value="other-services">Other Services</SelectItem>
                      <SelectItem value="personal-care">Personal Care</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="transportation">Transportation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="employmentStatus">
                    Employment Status <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.employmentStatus}
                    onValueChange={(value: string) => setField('employmentStatus', value)}
                  >
                    <SelectTrigger id="employmentStatus" className="h-12">
                      <SelectValue placeholder="Select Employment Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="past">Past</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="employedFrom">
                    Employed From <span className="text-red-500">*</span>
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
                      Employed To <span className="text-red-500">*</span>
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
                      <SelectItem value="gems-jewellery">Gems & Jewellery</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="hospitality">Hospitality</SelectItem>
                      <SelectItem value="other-services">Other Services</SelectItem>
                      <SelectItem value="personal-care">Personal Care</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="transportation">Transportation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="yearsInProfessionSENP">
                    Years in Profession <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="yearsInProfessionSENP"
                    type="number"
                    value={formData.yearsInProfessionSENP}
                    onChange={(e) => setField('yearsInProfessionSENP', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter years"
                    className="h-12"
                  />
                </div>
                <div>
                  <Label htmlFor="monthsInProfessionSENP">
                    Months in Profession <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="monthsInProfessionSENP"
                    type="number"
                    value={formData.monthsInProfessionSENP}
                    onChange={(e) => setField('monthsInProfessionSENP', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter months"
                    className="h-12"
                  />
                </div>
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
                      <SelectItem value="gems-jewellery">Gems & Jewellery</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="hospitality">Hospitality</SelectItem>
                      <SelectItem value="other-services">Other Services</SelectItem>
                      <SelectItem value="personal-care">Personal Care</SelectItem>
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
                <div>
                  <Label htmlFor="yearsInProfessionSEP">
                    Years in Profession <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="yearsInProfessionSEP"
                    type="number"
                    value={formData.yearsInProfessionSEP}
                    onChange={(e) => setField('yearsInProfessionSEP', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter years"
                    className="h-12"
                  />
                </div>
                <div>
                  <Label htmlFor="monthsInProfessionSEP">
                    Months in Profession <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="monthsInProfessionSEP"
                    type="number"
                    value={formData.monthsInProfessionSEP}
                    onChange={(e) => setField('monthsInProfessionSEP', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter months"
                    className="h-12"
                  />
                </div>
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

          </div>
            

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
            <div className="flex gap-3 max-w-2xl mx-auto">
                <Button onClick={handlePrevious} variant="outline" className="flex-1 h-12 rounded-lg">
                  Previous
                </Button>
                <Button onClick={handleNext} disabled={!canProceed()} className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]">
                  Next
                </Button>
            </div>
        </div>

        </div>
      </div>
    </DashboardLayout>
  );
}