'use client';

import React, { useState } from 'react';
import { X, FileText, User, IndianRupee, MapPin, Home, Wallet, File, ChevronDown, ChevronRight, Phone, Calendar, Target, Clock, UserCheck, Shield } from 'lucide-react';
import { Lead } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    className = ""
}: {
    title: string,
    icon: React.ElementType,
    children: React.ReactNode,
    defaultOpen?: boolean,
    badge?: React.ReactNode,
    className?: string
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
                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
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
    const { formData, status, appId, customerFirstName, customerLastName, customerMobile, panNumber, dob, gender } = lead;

    const leadStatus = status;

    const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 'N/A';
    
    // Helper function to get completion status
    const getStepCompletionBadge = (stepData: any) => {
        if (!stepData) return <Badge variant="secondary" className="text-xs">Not Started</Badge>;
        return <Badge variant="default" className="text-xs bg-green-100 text-green-700">Completed</Badge>;
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <header className="p-3 sm:p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10 shadow-sm">
                <div className="min-w-0 flex-1 pr-2">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Application Preview</h2>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{appId || 'Pending Application ID'}</p>
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

                    {/* Application Details */}
                    <CollapsibleSection
                        title="Application Details"
                        icon={FileText}
                        defaultOpen={true}
                        badge={getStepCompletionBadge(formData?.step1)}
                    >
                        <InfoGrid>
                            <DetailItem label="Product Type" value={formData?.step1?.productType} icon={Target} />
                            <DetailItem label="Application Type" value={formData?.step1?.applicationType} icon={FileText} />
                            <DetailItem label="Application ID" value={appId || 'N/A'} />
                            <DetailItem label="Created Date" value={new Date(lead.createdAt).toLocaleDateString()} icon={Calendar} />
                        </InfoGrid>
                    </CollapsibleSection>

                    {/* Customer Information */}
                    <CollapsibleSection
                        title="Customer Information"
                        icon={User}
                        badge={getStepCompletionBadge(formData?.step2)}
                    >
                        <InfoGrid>
                            <DetailItem label="Full Name" value={`${customerFirstName || ''} ${customerLastName || ''}`.trim()} icon={User} />
                            <DetailItem label="Mobile Number" value={customerMobile ? `+91-${customerMobile}` : 'N/A'} icon={Phone} />
                            <DetailItem label="Date of Birth" value={dob || 'N/A'} icon={Calendar} />
                            <DetailItem label="Age" value={age !== 'N/A' ? `${age} years` : 'N/A'} />
                            <DetailItem label="Gender" value={gender || 'N/A'} />
                        </InfoGrid>

                        {/* Identity Section */}
                        <div className="mt-4">
                            <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                                <Shield className="w-4 h-4 mr-2 text-blue-600" />
                                Identity Verification
                            </h4>
                            <InfoGrid>
                                <DetailItem label="PAN Number" value={panNumber || 'N/A'} />
                            </InfoGrid>
                        </div>
                    </CollapsibleSection>

                    {/* Address Information */}
                    <CollapsibleSection
                        title="Address Information"
                        icon={MapPin}
                        badge={getStepCompletionBadge(formData?.step3)}
                    >
                        {formData?.step3?.addresses?.map((addr: any, index: number) => (
                            <div key={addr.id || index} className="mb-4 last:mb-0">
                                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                                    <MapPin className="w-4 h-4 mr-2 text-blue-600" />
                                    Address {index + 1}
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

                    {/* Collateral Information */}
                    <CollapsibleSection
                        title="Collateral Information"
                        icon={Home}
                        badge={getStepCompletionBadge(formData?.step6)}
                    >
                        <InfoGrid>
                            <DetailItem label="Collateral Type" value={formData?.step6?.collateralType} icon={Home} />
                            <DetailItem label="Collateral Sub Type" value={formData?.step6?.collateralSubType} />
                            <DetailItem label="Ownership Type" value={formData?.step6?.ownershipType} />
                            <DetailItem label="Property Value" value={formData?.step6?.propertyValue ? formatCurrency(Number(formData.step6.propertyValue)) : 'N/A'} icon={IndianRupee} />
                            <DetailItem label="Location" value={formData?.step6?.location} icon={MapPin} />
                            {formData?.step6?.description && (
                                <DetailItem label="Description" value={formData.step6.description} />
                            )}
                        </InfoGrid>
                    </CollapsibleSection>

                    {/* Loan Details & Requirements */}
                    <CollapsibleSection
                        title="Loan Details & Requirements"
                        icon={Target}
                        badge={getStepCompletionBadge(formData?.step7)}
                    >
                        <InfoGrid>
                            <DetailItem label="Loan Amount" value={formatCurrency(lead.loanAmount)} icon={IndianRupee} />
                            <DetailItem label="Loan Purpose" value={lead.loanPurpose || formData?.step7?.loanPurpose} icon={Target} />
                            {formData?.step7?.purposeDescription && (
                                <DetailItem label="Purpose Description" value={formData.step7.purposeDescription} />
                            )}
                            <DetailItem label="Interest Rate" value={formData?.step7?.interestRate ? `${formData.step7.interestRate}% p.a.` : 'N/A'} />
                            <DetailItem label="Tenure" value={formData?.step7?.tenure ? `${formData.step7.tenure} months` : 'N/A'} icon={Clock} />
                            <DetailItem label="Sourcing Channel" value={formData?.step7?.sourcingChannel || 'N/A'} />
                        </InfoGrid>
                    </CollapsibleSection>

                    {/* Document Upload */}
                    <CollapsibleSection
                        title="Documents"
                        icon={File}
                        badge={formData?.step8?.files?.length > 0 ? <Badge variant="default" className="text-xs bg-green-100 text-green-700">{formData.step8.files.filter((f: any) => f.status === 'Success').length} Uploaded</Badge> : <Badge variant="secondary" className="text-xs">No Files</Badge>}
                    >
                        {formData?.step8?.files?.length > 0 ? (
                            <div className="space-y-2">
                                {formData.step8.files
                                    .filter((file: any) => file.status === 'Success')
                                    .map((file: any, fileIndex: number) => (
                                        <div key={file.id || fileIndex} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-2 bg-gray-50 rounded">
                                            <div className="flex items-center space-x-2 min-w-0">
                                                <File className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <span className="text-sm font-medium block truncate">{file.type || 'Document'}</span>
                                                    <p className="text-xs text-gray-500 truncate">{file.name || 'Uploaded file'}</p>
                                                </div>
                                            </div>
                                            <Badge variant="default" className="text-xs bg-green-100 text-green-700 flex-shrink-0">
                                                Uploaded
                                            </Badge>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">No documents uploaded yet</p>
                        )}
                    </CollapsibleSection>

                </div>
            </ScrollArea>
        </div>
    );
}
