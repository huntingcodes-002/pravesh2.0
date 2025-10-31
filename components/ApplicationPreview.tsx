'use client';

import React, { useState } from 'react';
import { X, FileText, User, IndianRupee, MapPin, Users, Home, AlertTriangle, Wallet, File, ChevronDown, ChevronRight, Phone, Mail, Calendar, CreditCard, Target, Clock, UserCheck, Shield, Edit2 } from 'lucide-react';
import { Lead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { useLead } from '@/contexts/LeadContext';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ApplicationPreviewProps {
    lead: Lead;
    onClose: () => void;
}

const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    return `₹${value.toLocaleString('en-IN')}`;
};

const CollapsibleSection = ({
    title,
    icon: Icon,
    children,
    defaultOpen = false,
    badge,
    className = "",
    onEdit,
    stepNumber,
    isEditable = true
}: {
    title: string,
    icon: React.ElementType,
    children: React.ReactNode,
    defaultOpen?: boolean,
    badge?: React.ReactNode,
    className?: string,
    onEdit?: () => void,
    stepNumber?: number,
    isEditable?: boolean
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn("border border-gray-200 rounded-lg", className)}>
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 gap-2">
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        className="flex-1 justify-start h-auto hover:bg-gray-100 p-0 min-w-0"
                    >
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                            <span className="font-semibold text-xs sm:text-sm md:text-base text-gray-900 truncate">{title}</span>
                            {badge && <div className="hidden sm:flex flex-shrink-0">{badge}</div>}
                        </div>
                    </Button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    {onEdit && isEditable && (
                        <Button
                            onClick={onEdit}
                            variant="outline"
                            size="sm"
                            className="h-7 sm:h-8 px-2 sm:px-3 text-xs bg-white hover:bg-blue-50 border-blue-200 text-blue-600 flex-shrink-0"
                        >
                            <Edit2 className="w-3 h-3 sm:mr-1" />
                            <span className="hidden sm:inline">Edit</span>
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" onClick={() => setIsOpen(!isOpen)}>
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
            <CollapsibleContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="space-y-2 sm:space-y-3 pt-2 border-t border-gray-100">
                    {children}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};

const DetailItem = ({ label, value, icon: Icon }: { label: string, value: string | React.ReactNode, icon?: React.ElementType }) => (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2 py-2 border-b border-gray-50 last:border-b-0">
        <div className="flex items-center space-x-2 min-w-0">
            {Icon && <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />}
            <span className="text-xs sm:text-sm font-medium text-gray-600 truncate">{label}</span>
        </div>
        <div className="text-xs sm:text-sm font-semibold text-gray-900 sm:text-right break-words sm:max-w-[60%]">
            {value || 'N/A'}
        </div>
    </div>
);

const InfoGrid = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-gray-50 rounded-lg p-2 sm:p-3 space-y-1.5 sm:space-y-2">
        {children}
    </div>
);

export default function ApplicationPreview({ lead, onClose }: ApplicationPreviewProps) {
    const { formData, status, appId, customerFirstName, customerLastName, customerMobile, panNumber, dob, payments } = lead;
    const router = useRouter();
    const { setCurrentLead } = useLead();

    const leadStatus = status;
    const successfulPayment = payments?.find(p => p.status === 'Paid');
    const coApplicants = formData?.coApplicants || [];

    const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 'N/A';
    
    // Check if application is in finalized state (editing should be disabled)
    const isFinalized = ['Submitted', 'Approved', 'Rejected', 'Disbursed'].includes(status);

    // Helper function to get completion status
    const getStepCompletionBadge = (stepData: any) => {
        if (!stepData) return <Badge variant="secondary" className="text-xs">Not Started</Badge>;
        return <Badge variant="default" className="text-xs bg-green-100 text-green-700">Completed</Badge>;
    };

    // Handler to navigate to specific step for editing
    const handleEdit = (stepNumber: number) => {
        if (isFinalized) return; // Prevent editing if finalized
        setCurrentLead(lead);
        onClose();
        router.push(`/lead/step${stepNumber}`);
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <header className="p-3 sm:p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10 shadow-sm">
                <div className="min-w-0 flex-1 pr-2">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Application Preview</h2>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{appId}</p>
                </div>
                <Button onClick={onClose} variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 flex-shrink-0">
                    <X className="w-5 h-5" />
                </Button>
            </header>

            <ScrollArea className="flex-1 p-3 sm:p-4 md:p-6">
                <div className="space-y-3 sm:space-y-4">

                    {/* Status Overview */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                        <div className="min-w-0">
                            <p className="font-semibold text-base sm:text-lg text-gray-900">Application Status</p>
                            <p className="text-xs sm:text-sm text-gray-600">Last updated: {new Date(lead.updatedAt).toLocaleDateString()}</p>
                        </div>
                        <Badge className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold whitespace-nowrap ${leadStatus === 'Draft' ? 'bg-gray-500' :
                            leadStatus === 'Submitted' ? 'bg-blue-600' :
                                leadStatus === 'Approved' ? 'bg-green-600' :
                                    leadStatus === 'Disbursed' ? 'bg-teal-600' :
                                        'bg-red-600'
                            } text-white`}>
                            {leadStatus}
                        </Badge>
                    </div>

                    {/* Step 1: Application Details */}
                    <CollapsibleSection
                        title="Step 1: Application Details"
                        icon={FileText}
                        defaultOpen={true}
                        badge={getStepCompletionBadge(formData?.step1)}
                        onEdit={() => handleEdit(1)}
                        stepNumber={1}
                        isEditable={!isFinalized}
                    >
                        <InfoGrid>
                            <DetailItem label="Product Type" value={formData?.step1?.productType} icon={Target} />
                            <DetailItem label="Application Type" value={formData?.step1?.applicationType} icon={FileText} />
                            <DetailItem label="Application ID" value={appId} icon={CreditCard} />
                            <DetailItem label="Created Date" value={new Date(lead.createdAt).toLocaleDateString()} icon={Calendar} />
                        </InfoGrid>
                    </CollapsibleSection>

                    {/* Step 2: Customer Information */}
                    <CollapsibleSection
                        title="Step 2: Customer Information"
                        icon={User}
                        badge={getStepCompletionBadge(formData?.step2)}
                        onEdit={() => handleEdit(2)}
                        stepNumber={2}
                        isEditable={!isFinalized}
                    >
                        <InfoGrid>
                            <DetailItem label="Full Name" value={`${customerFirstName || ''} ${customerLastName || ''}`.trim()} icon={User} />
                            <DetailItem label="Mobile Number" value={customerMobile ? `+91-${customerMobile}` : 'N/A'} icon={Phone} />
                            <DetailItem label="Email" value={formData?.step2?.email} icon={Mail} />
                            <DetailItem label="Date of Birth" value={dob} icon={Calendar} />
                            <DetailItem label="Age" value={age !== 'N/A' ? `${age} years` : 'N/A'} />
                            <DetailItem label="Gender" value={lead.gender} />
                            <DetailItem label="Customer Type" value={formData?.step2?.customerType} />
                        </InfoGrid>

                        {/* Identity Section */}
                        <div className="mt-4">
                            <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                                <Shield className="w-4 h-4 mr-2 text-blue-600" />
                                Identity Verification
                            </h4>
                            <InfoGrid>
                                {formData?.step2?.hasPan === 'no' ? (
                                    <>
                                        <DetailItem label="PAN Status" value="Not Available" />
                                        <DetailItem label="Reason" value={formData?.step2?.panUnavailabilityReason} />
                                        <DetailItem label="Alternate ID Type" value={formData?.step2?.alternateIdType} icon={CreditCard} />
                                        <DetailItem label="Document Number" value={formData?.step2?.documentNumber} />
                                    </>
                                ) : (
                                    <DetailItem label="PAN Number" value={panNumber} icon={CreditCard} />
                                )}
                            </InfoGrid>
                        </div>
                    </CollapsibleSection>

                    {/* Step 3: Address Information */}
                    <CollapsibleSection
                        title="Step 3: Address Information"
                        icon={MapPin}
                        badge={getStepCompletionBadge(formData?.step3)}
                        onEdit={() => handleEdit(3)}
                        stepNumber={3}
                        isEditable={!isFinalized}
                    >
                        {formData?.step3?.addresses?.map((addr: any, index: number) => (
                            <div key={addr.id} className="mb-4 last:mb-0">
                                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                                    <MapPin className="w-4 h-4 mr-2 text-blue-600" />
                                    Address {index + 1} {addr.isPrimary && <Badge variant="outline" className="ml-2 text-xs">Primary</Badge>}
                                </h4>
                                <InfoGrid>
                                    <DetailItem label="Type" value={addr.addressType} />
                                    <DetailItem label="Address Line 1" value={addr.addressLine1} />
                                    <DetailItem label="Address Line 2" value={addr.addressLine2} />
                                    <DetailItem label="Address Line 3" value={addr.addressLine3} />
                                    <DetailItem label="Landmark" value={addr.landmark} />
                                    <DetailItem label="Postal Code" value={addr.postalCode} />
                                </InfoGrid>
                            </div>
                        ))}
                        {(!formData?.step3?.addresses || formData.step3.addresses.length === 0) && (
                            <p className="text-gray-500 text-sm">No addresses added yet</p>
                        )}
                    </CollapsibleSection>

                    {/* Step 4: Co-Applicant Details */}
                    <CollapsibleSection
                        title="Step 4: Co-Applicant Details"
                        icon={Users}
                        badge={coApplicants.length > 0 ? <Badge variant="default" className="text-xs bg-green-100 text-green-700">{coApplicants.length} Added</Badge> : <Badge variant="secondary" className="text-xs">None Added</Badge>}
                        onEdit={() => handleEdit(5)}
                        stepNumber={4}
                        isEditable={!isFinalized}
                    >
                        {coApplicants.length > 0 ? (
                            coApplicants.map((coApp: any, index: number) => (
                                <div key={coApp.id} className="mb-4 last:mb-0">
                                    <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                                        <UserCheck className="w-4 h-4 mr-2 text-blue-600" />
                                        Co-Applicant {index + 1}
                                        <Badge variant={coApp.isComplete ? "default" : "secondary"} className="ml-2 text-xs">
                                            {coApp.isComplete ? 'Complete' : 'Incomplete'}
                                        </Badge>
                                    </h4>
                                    <InfoGrid>
                                        <DetailItem label="Name" value={coApp.data?.step1 ? `${coApp.data.step1.firstName} ${coApp.data.step1.lastName}` : 'N/A'} icon={User} />
                                        <DetailItem label="Relationship" value={coApp.relationship} />
                                        <DetailItem label="Mobile" value={coApp.data?.step1?.mobile ? `+91-${coApp.data.step1.mobile}` : 'N/A'} icon={Phone} />
                                        <DetailItem label="Email" value={coApp.data?.step2?.email} icon={Mail} />
                                        <DetailItem label="Date of Birth" value={coApp.data?.step2?.dob} icon={Calendar} />
                                        {coApp.data?.step2?.hasPan === 'no' ? (
                                            <>
                                                <DetailItem label="PAN Status" value="Not Available" />
                                                <DetailItem label="Alternate ID Type" value={coApp.data?.step2?.alternateIdType} icon={CreditCard} />
                                                <DetailItem label="Document Number" value={coApp.data?.step2?.documentNumber} />
                                            </>
                                        ) : (
                                            <DetailItem label="PAN" value={coApp.data?.step2?.pan || 'N/A'} icon={CreditCard} />
                                        )}
                                    </InfoGrid>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-sm">No co-applicants added</p>
                        )}
                    </CollapsibleSection>



                    {/* Step 5: Collateral Information */}
                    <CollapsibleSection
                        title="Step 5: Collateral Information"
                        icon={Home}
                        badge={getStepCompletionBadge(formData?.step6)}
                        onEdit={() => handleEdit(6)}
                        stepNumber={5}
                        isEditable={!isFinalized}
                    >
                        <InfoGrid>
                            <DetailItem label="Collateral Type" value={formData?.step6?.collateralType} icon={Home} />
                            <DetailItem label="Ownership Type" value={formData?.step6?.ownershipType} />
                            <DetailItem label="Property Value" value={formData?.step6?.propertyValue ? formatCurrency(Number(formData.step6.propertyValue)) : 'N/A'} icon={IndianRupee} />
                            <DetailItem label="Location" value={formData?.step6?.location} icon={MapPin} />
                        </InfoGrid>
                    </CollapsibleSection>

                    {/* Step 6: Loan Details & Requirements */}
                    <CollapsibleSection
                        title="Step 6: Loan Details & Requirements"
                        icon={Target}
                        badge={getStepCompletionBadge(formData?.step7)}
                        onEdit={() => handleEdit(7)}
                        stepNumber={6}
                        isEditable={!isFinalized}
                    >
                        <InfoGrid>
                            <DetailItem label="Loan Amount" value={formatCurrency(lead.loanAmount)} icon={IndianRupee} />
                            <DetailItem label="Loan Purpose" value={lead.loanPurpose || formData?.step7?.loanPurpose} icon={Target} />
                            {formData?.step7?.customPurpose && (
                                <DetailItem label="Custom Purpose" value={formData?.step7?.customPurpose} />
                            )}
                            {formData?.step7?.purposeDescription && (
                                <DetailItem label="Purpose Description" value={formData?.step7?.purposeDescription} />
                            )}
                            <DetailItem label="Interest Rate" value={formData?.step7?.interestRate ? `${formData.step7.interestRate}% p.a.` : 'N/A'} />
                            <DetailItem label="Tenure" value={formData?.step7?.tenure && formData?.step7?.tenureUnit ? `${formData.step7.tenure} ${formData.step7.tenureUnit}` : 'N/A'} icon={Clock} />
                            <DetailItem label="Sourcing Channel" value={formData?.step7?.sourcingChannel || 'N/A'} />
                        </InfoGrid>
                    </CollapsibleSection>

                    {/* Step 7: Document Upload */}
                    <CollapsibleSection
                        title="Step 7: Document Upload"
                        icon={File}
                        badge={formData?.step8?.files?.length > 0 ? <Badge variant="default" className="text-xs bg-green-100 text-green-700">{formData.step8.files.length} Files</Badge> : <Badge variant="secondary" className="text-xs">No Files</Badge>}
                        onEdit={() => handleEdit(8)}
                        stepNumber={7}
                        isEditable={!isFinalized}
                    >
                        {formData?.step8?.files?.length > 0 ? (
                            <div className="space-y-2">
                                {formData.step8.files.map((file: any, fileIndex: number) => (
                                    <div key={file.id || fileIndex} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-2 bg-gray-50 rounded">
                                        <div className="flex items-center space-x-2 min-w-0">
                                            <File className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <span className="text-sm font-medium block truncate">{file.type || 'Document'}</span>
                                                <p className="text-xs text-gray-500 truncate">{file.name}</p>
                                            </div>
                                        </div>
                                        <Badge variant={file.status === 'verified' ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                                            {file.status || 'Uploaded'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">No documents uploaded yet</p>
                        )}
                    </CollapsibleSection>

                    {/* Step 8: Application Review */}
                    <CollapsibleSection
                        title="Step 8: Application Review"
                        icon={FileText}
                        badge={getStepCompletionBadge(formData?.step9_eval)}
                        onEdit={() => handleEdit(9)}
                        stepNumber={8}
                        isEditable={!isFinalized}
                    >
                        <InfoGrid>
                            <DetailItem label="Review Status" value={formData?.step9_eval?.isReviewed ? "Completed" : "Pending"} />
                            <DetailItem label="Ready to Proceed" value={formData?.step9_eval?.readyToProceed ? "Yes" : "No"} />
                        </InfoGrid>
                    </CollapsibleSection>

                    {/* Step 9: Evaluation & Assessment */}
                    <CollapsibleSection
                        title="Step 9: Evaluation & Assessment"
                        icon={AlertTriangle}
                        badge={getStepCompletionBadge(formData?.step9_eval)}
                        onEdit={() => handleEdit(10)}
                        stepNumber={9}
                        isEditable={!isFinalized}
                    >
                        <InfoGrid>
                            <DetailItem label="Credit Assessment" value={formData?.step9_eval?.creditAssessment || 'Pending'} />
                            <DetailItem label="Risk Category" value={formData?.step9_eval?.riskCategory || 'Not assessed'} />
                            <DetailItem label="Credit Score" value={formData?.step9_eval?.creditScore || 'N/A'} />
                        </InfoGrid>
                    </CollapsibleSection>

                    {/* Step 10: Payment Information */}
                    <CollapsibleSection
                        title="Step 10: Payment Collection"
                        icon={Wallet}
                        badge={successfulPayment ? <Badge variant="default" className="text-xs bg-green-100 text-green-700">Paid</Badge> : <Badge variant="secondary" className="text-xs">Pending</Badge>}
                        onEdit={() => handleEdit(11)}
                        stepNumber={10}
                        isEditable={!isFinalized}
                    >
                        {successfulPayment ? (
                            <InfoGrid>
                                <DetailItem label="Payment Status" value={<Badge className="bg-green-100 text-green-700">Paid</Badge>} />
                                <DetailItem label="Amount Paid" value={formatCurrency(successfulPayment.amount)} icon={IndianRupee} />
                                <DetailItem label="Fee Type" value={successfulPayment.feeType} />
                                <DetailItem label="Payment Date" value={successfulPayment.timeline.received ? new Date(successfulPayment.timeline.received).toLocaleDateString() : 'N/A'} icon={Calendar} />
                                <DetailItem label="Transaction ID" value={successfulPayment.id} />
                            </InfoGrid>
                        ) : (
                            <InfoGrid>
                                <DetailItem label="Payment Status" value={<Badge className="bg-orange-100 text-orange-700">Pending</Badge>} />
                                <DetailItem label="Required Fees" value="Login / IMD Fee" />
                            </InfoGrid>
                        )}

                        {/* All Payment History */}
                        {payments && payments.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-medium text-gray-900 mb-2">Payment History</h4>
                                <div className="space-y-2">
                                    {payments.map((payment, paymentIndex) => (
                                        <div key={payment.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                            <div>
                                                <p className="text-sm font-medium">{payment.feeType}</p>
                                                <p className="text-xs text-gray-500">{new Date(payment.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                                                <Badge variant={payment.status === 'Paid' ? 'default' : payment.status === 'Failed' ? 'destructive' : 'secondary'} className="text-xs">
                                                    {payment.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CollapsibleSection>

                </div>
            </ScrollArea>
        </div>
    );
}
