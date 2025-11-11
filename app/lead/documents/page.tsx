'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, CheckCircle, XCircle, Loader, Trash2, RotateCcw, Camera, AlertTriangle, User, Users, Home, ChevronDown, X, Image as ImageIcon, RefreshCw } from 'lucide-react';
import ReactCrop, { Crop, PixelCrop, makeAspectCrop, centerCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { uploadDocument, getDetailedInfo, submitPersonalInfo, isApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface UploadedFile {
    id: string;
    name: string;
    type: string;
    status: 'Processing' | 'Success' | 'Failed';
    error?: string;
    frontName?: string;
    backName?: string;
    previewUrl?: string;
    frontPreviewUrl?: string;
    backPreviewUrl?: string;
    fileType?: 'image' | 'pdf';
    ownerType?: 'main' | 'coapplicant' | 'collateral';
    ownerId?: string;
    label?: string;
}

interface EntityOption {
    value: string;
    label: string;
    type: 'main' | 'coapplicant' | 'collateral';
    coApplicantId?: string;
}

interface TempFile {
    name: string;
    file: File | null;
    dataUrl?: string;
}

// Alternate ID types for when PAN is not available
const ALTERNATE_ID_TYPES = [
    { value: "VoterID", label: "Voter ID", fileTypes: ["image"], requiresCamera: true },
    { value: "DrivingLicense", label: "Driving License", fileTypes: ["image"], requiresCamera: true },
    { value: "Passport", label: "Passport", fileTypes: ["image"], requiresCamera: true },
];

const DocumentSelectItem = ({ docType, isUploaded }: { docType: { value: string; label: string }, isUploaded: boolean }) => (
    <SelectItem value={docType.value} disabled={isUploaded} className={isUploaded ? "opacity-60" : ""}>
        <div className="flex items-center justify-between w-full">
            <span>{docType.label}</span>
            {isUploaded && <CheckCircle className="w-4 h-4 text-green-600 ml-2" />}
        </div>
    </SelectItem>
);

// Helper function to get applicant name
const getApplicantName = (firstName?: string, lastName?: string) => {
    const name = `${firstName || ''} ${lastName || ''}`.trim();
    return name || 'Applicant';
};

// Helper function to map alternate ID type from step2 to step8 document value
const mapAlternateIdTypeToDocumentValue = (alternateIdType: string): string => {
    const mapping: { [key: string]: string } = {
        "Passport": "Passport",
        "Voter ID": "VoterID",
        "Driving License": "DrivingLicense"
    };
    return mapping[alternateIdType] || alternateIdType;
};

// Helper function to get document label for alternate ID types
const getAlternateDocumentLabel = (alternateIdType: string): string => {
    const labelMapping: { [key: string]: string } = {
        "Passport": "Passport",
        "Voter ID": "Voter ID",
        "Driving License": "Driving License"
    };
    return labelMapping[alternateIdType] || alternateIdType;
};

// Helper function to generate dynamic document list
interface DocumentDefinition {
  value: string;
  label: string;
  fileTypes: Array<'image' | 'pdf'>;
  requiresCamera: boolean;
  applicantType: 'main' | 'coapplicant' | 'collateral';
  required?: boolean;
  requiresFrontBack?: boolean;
  coApplicantId?: string;
}

const generateDocumentList = (lead: any): DocumentDefinition[] => {
  const documents: DocumentDefinition[] = [];

  const mainApplicantName = getApplicantName(lead?.customerFirstName, lead?.customerLastName);
  const step2 = lead?.formData?.step2 || {};

  if (step2?.hasPan !== 'no') {
    documents.push({
      value: 'PAN',
      label: `PAN - ${mainApplicantName}`,
      fileTypes: ['image'],
      requiresCamera: true,
      applicantType: 'main',
      required: true,
      requiresFrontBack: false,
    });
  } else if (step2?.alternateIdType) {
    const altValue = mapAlternateIdTypeToDocumentValue(step2.alternateIdType);
    const altLabel = getAlternateDocumentLabel(step2.alternateIdType);
    documents.push({
      value: altValue,
      label: `${altLabel} - ${mainApplicantName}`,
      fileTypes: ['image'],
      requiresCamera: true,
      applicantType: 'main',
      required: true,
      requiresFrontBack: false,
    });
  }

  documents.push({
    value: 'Adhaar',
    label: `Aadhaar - ${mainApplicantName}`,
    fileTypes: ['image'],
    requiresCamera: true,
    applicantType: 'main',
    required: true,
    requiresFrontBack: true,
  });

  const coApplicants = lead?.formData?.coApplicants || [];
  coApplicants.forEach((coApp: any, index: number) => {
    const basic = coApp?.data?.basicDetails ?? coApp?.data?.step1 ?? {};
    const step2Data = coApp?.data?.step2 ?? {};
    const name = getApplicantName(
      basic.firstName ?? step2Data.firstName,
      basic.lastName ?? step2Data.lastName
    );
    const hasPan = step2Data.hasPan ?? 'yes';

    if (hasPan !== 'no') {
      documents.push({
        value: `PAN_${coApp.id}`,
        label: `PAN - ${name}`,
        fileTypes: ['image'],
        requiresCamera: true,
        applicantType: 'coapplicant',
        coApplicantId: coApp.id,
        required: true,
        requiresFrontBack: false,
      });
    } else if (step2Data.alternateIdType) {
      const altValue = mapAlternateIdTypeToDocumentValue(step2Data.alternateIdType);
      const altLabel = getAlternateDocumentLabel(step2Data.alternateIdType);
      documents.push({
        value: `${altValue}_${coApp.id}`,
        label: `${altLabel} - ${name}`,
        fileTypes: ['image'],
        requiresCamera: true,
        applicantType: 'coapplicant',
        coApplicantId: coApp.id,
        required: true,
        requiresFrontBack: false,
      });
    }

    documents.push({
      value: `Adhaar_${coApp.id}`,
      label: `Aadhaar - ${name}`,
      fileTypes: ['image'],
      requiresCamera: true,
      applicantType: 'coapplicant',
      coApplicantId: coApp.id,
      required: true,
      requiresFrontBack: true,
    });
  });

  documents.push({
    value: 'CollateralPapers',
    label: 'Collateral Papers',
    fileTypes: ['pdf'],
    requiresCamera: false,
    applicantType: 'collateral',
    required: true,
    requiresFrontBack: false,
  });

  return documents;
};

// Helper function to categorize uploaded files
const categorizeUploadedFiles = (files: UploadedFile[], availableDocuments: any[], coApplicants: any[]) => {
    const applicantDocs: UploadedFile[] = [];
    const coApplicantDocsMap: { [key: string]: UploadedFile[] } = {};
    const collateralDocs: UploadedFile[] = [];
    
    // Initialize co-applicant docs map
    coApplicants.forEach((coApp: any) => {
        coApplicantDocsMap[coApp.id] = [];
    });
    
    files.forEach(file => {
        const docInfo = availableDocuments.find(doc => doc.value === file.type);
        
        if (docInfo) {
            if (docInfo.applicantType === 'main') {
                applicantDocs.push(file);
            } else if (docInfo.applicantType === 'coapplicant') {
                const coApplicantId = docInfo.coApplicantId;
                if (coApplicantId && coApplicantDocsMap[coApplicantId]) {
                    coApplicantDocsMap[coApplicantId].push(file);
                }
            } else if (docInfo.applicantType === 'collateral') {
                collateralDocs.push(file);
            }
        }
    });
    
    return { applicantDocs, coApplicantDocsMap, collateralDocs };
};

// Helper function to get document display name
const getDocumentDisplayName = (fileType: string, availableDocuments: any[]) => {
    const docInfo = availableDocuments.find(doc => doc.value === fileType);
    return docInfo ? docInfo.label : fileType;
};

const parseDocumentValue = (docValue: string) => {
    const parts = docValue.split('_');
    const baseValue = parts[0];
    const coApplicantId = parts.length > 1 ? parts.slice(1).join('_') : undefined;
    return { baseValue, coApplicantId };
};

export default function Step8Page() {
  const { currentLead, updateLead, updateCoApplicant } = useLead();
  const router = useRouter();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [selectedEntity, setSelectedEntity] = useState<EntityOption['value']>('applicant');
    const [documentType, setDocumentType] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(
        currentLead?.formData?.step8?.files || []
    );

    // New states for front/back handling
    const [frontFile, setFrontFile] = useState<TempFile | null>(null);
    const [backFile, setBackFile] = useState<TempFile | null>(null);
    const [uploadMode, setUploadMode] = useState<'front' | 'back' | null>(null);
    const [showUploadMethodModal, setShowUploadMethodModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string>('');

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
    // Default to open for applicant section to prevent auto-collapse
    const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({ applicant: true, collateral: true });
    
    // Camera flip state
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
    
    // Crop state
    const [showCropModal, setShowCropModal] = useState(false);
    const [capturedImageSrc, setCapturedImageSrc] = useState<string>('');
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Preview state
    const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    const totalSteps = 10;
    
    // Generate dynamic document list based on current lead data
    const availableDocuments = currentLead ? generateDocumentList(currentLead) : [];
    
    const entityOptions = useMemo((): EntityOption[] => {
        if (!currentLead) return [];
        
        const entities: EntityOption[] = [];
        
        const mainApplicantName = currentLead.customerName || getApplicantName(currentLead.customerFirstName, currentLead.customerLastName);
        entities.push({
            value: 'applicant',
            label: `Applicant - ${mainApplicantName}`,
            type: 'main'
        });
        
        const coApplicants = currentLead?.formData?.coApplicants || [];
        coApplicants.forEach((coApp: any, index: number) => {
            const coApplicantName = getApplicantName(
                coApp?.data?.basicDetails?.firstName ?? coApp?.data?.step1?.firstName,
                coApp?.data?.basicDetails?.lastName ?? coApp?.data?.step1?.lastName
            );
            entities.push({
                value: coApp.id,
                label: `Co-Applicant ${index + 1} - ${coApplicantName}`,
                type: 'coapplicant',
                coApplicantId: coApp.id,
            });
        });
        
        entities.push({
            value: 'collateral',
            label: 'Collateral Documents',
            type: 'collateral',
        });
        
        return entities;
    }, [currentLead]);
    
    useEffect(() => {
        if (!entityOptions.length) return;
        if (!entityOptions.some(option => option.value === selectedEntity)) {
            setSelectedEntity(entityOptions[0].value);
            setDocumentType('');
        }
    }, [entityOptions, selectedEntity]);
    
    const selectedEntityOption = useMemo(
        () => entityOptions.find(opt => opt.value === selectedEntity) ?? null,
        [entityOptions, selectedEntity]
    );
    
    const filteredDocuments = useMemo(() => {
        if (!selectedEntityOption) return [];
        if (selectedEntityOption.type === 'main') {
            return availableDocuments.filter(doc => doc.applicantType === 'main');
        }
        if (selectedEntityOption.type === 'coapplicant') {
            return availableDocuments.filter(
                doc => doc.applicantType === 'coapplicant' && doc.coApplicantId === selectedEntityOption.coApplicantId
            );
        }
        if (selectedEntityOption.type === 'collateral') {
            return availableDocuments.filter(doc => doc.applicantType === 'collateral');
        }
        return [];
    }, [availableDocuments, selectedEntityOption]);
    
    useEffect(() => {
        if (!filteredDocuments.length) {
            if (documentType) {
                setDocumentType('');
            }
            return;
        }
        if (!filteredDocuments.some(doc => doc.value === documentType)) {
            const autoValue = filteredDocuments.length === 1 ? filteredDocuments[0].value : '';
            setDocumentType(autoValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredDocuments]);
    
    const selectedDocument = useMemo(
        () => filteredDocuments.find(doc => doc.value === documentType),
        [filteredDocuments, documentType]
    );

    // Clean up old alternate/collateral documents that no longer match configuration
    useEffect(() => {
        if (!currentLead) return;
        const validTypes = new Set(availableDocuments.map(doc => doc.value));
        const normalizedFiles = uploadedFiles.filter(file => validTypes.has(file.type));
        if (normalizedFiles.length !== uploadedFiles.length) {
            setUploadedFiles(normalizedFiles);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLead, availableDocuments]);

    useEffect(() => {
        if (currentLead) {
            updateLead(currentLead.id, {
                formData: { ...currentLead.formData, step8: { files: uploadedFiles } },
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uploadedFiles]);

    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // Helper function to map frontend document type to backend format
    const mapDocumentTypeToBackend = (docType: string): 'pan_card' | 'aadhaar_card' | 'driving_license' | 'passport' | 'voter_id' | 'collateral_documents' | 'bank_statement' | 'salary_slip' | 'itr' | 'other' => {
        const { baseValue } = parseDocumentValue(docType);
        const mapping: Record<string, 'pan_card' | 'aadhaar_card' | 'driving_license' | 'passport' | 'voter_id' | 'collateral_documents' | 'bank_statement' | 'salary_slip' | 'itr' | 'other'> = {
            'PAN': 'pan_card',
            'Adhaar': 'aadhaar_card',
            'DrivingLicense': 'driving_license',
            'Passport': 'passport',
            'VoterID': 'voter_id',
            'CollateralPapers': 'collateral_documents',
            'BankStatement': 'bank_statement',
            'SalarySlip': 'salary_slip',
            'ITR': 'itr',
        };
        return mapping[baseValue] || 'other';
    };

    // Helper function to handle document upload with API integration
    const handleDocumentUpload = async (
        file: File,
        documentType: string,
        fileId: string,
        backFile?: File
    ) => {
        if (!currentLead?.appId) {
            toast({
                title: 'Error',
                description: 'Application ID not found. Please create a new lead first.',
                variant: 'destructive',
            });
            return { success: false };
        }

        const docInfo = availableDocuments.find(doc => doc.value === documentType);
        const { baseValue: baseDocType, coApplicantId: documentCoApplicantId } = parseDocumentValue(documentType);
        const backendDocType = mapDocumentTypeToBackend(documentType);
        const metadata: Record<string, any> = {};
        if (docInfo?.applicantType === 'coapplicant' && docInfo.coApplicantId) {
            metadata.co_applicant_id = docInfo.coApplicantId;
        }
        if (docInfo?.applicantType === 'collateral') {
            metadata.document_owner = 'collateral';
        }
        
        try {
            // Endpoint 5: Upload document - https://uatlb.api.saarathifinance.com/api/lead-collection/applications/document-upload/
            const uploadResponse = await uploadDocument({
                application_id: currentLead.appId,
                document_type: backendDocType,
                front_file: file,
                back_file: backFile,
                document_name: docInfo?.label || file.name,
                metadata: Object.keys(metadata).length ? metadata : undefined,
            });

            // Only approve if backend returns success (200 OK)
            if (isApiError(uploadResponse) || !uploadResponse.success) {
                toast({
                    title: 'Upload Failed',
                    description: uploadResponse.error || uploadResponse.error_type || 'Failed to upload document. Please try again.',
                    variant: 'destructive',
                });
                return { success: false };
            }

            // Document uploaded successfully - now fetch parsed data for PAN/Aadhaar

            // If PAN or Aadhaar, fetch parsed data from Endpoint 6 after backend processes it
            if (baseDocType === 'PAN' || baseDocType === 'Adhaar') {
                // Wait a bit for backend to process the document
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const detailedResponse = await getDetailedInfo(currentLead.appId);
                
                if (!isApiError(detailedResponse) && detailedResponse.data) {
                    const parsedData = detailedResponse.data;
                    
                    // Handle PAN document - populate Customer Details page with PAN number and DOB
                    if (baseDocType === 'PAN') {
                        // Helper function to convert DD/MM/YYYY format (e.g., "24/08/2002") to YYYY-MM-DD format
                        const convertDDMMYYYYToISO = (dateStr: string): string => {
                            if (!dateStr) return '';
                            
                            // If already in ISO format (YYYY-MM-DD), return as is
                            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                return dateStr;
                            }
                            
                            // If in DD/MM/YYYY format (e.g., "24/08/2002"), convert to YYYY-MM-DD
                            const slashMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                            if (slashMatch) {
                                const [, day, month, year] = slashMatch;
                                return `${year}-${month}-${day}`;
                            }
                            
                            // If in ddmmyyyy format (8 digits: 24082002), convert to YYYY-MM-DD
                            const ddmmyyyyMatch = dateStr.match(/^(\d{2})(\d{2})(\d{4})$/);
                            if (ddmmyyyyMatch) {
                                const [, day, month, year] = ddmmyyyyMatch;
                                return `${year}-${month}-${day}`;
                            }
                            
                            // Try to parse as Date object and convert
                            try {
                                const dateObj = new Date(dateStr);
                                if (!isNaN(dateObj.getTime())) {
                                    return dateObj.toISOString().split('T')[0];
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                            
                            return dateStr; // Return as-is if conversion fails
                        };
                        
                        // Extract PAN number and DOB from workflow_state.pan_ocr_data.extracted_fields
                        // Response structure: workflow_state.pan_ocr_data.extracted_fields.pan_number and .date_of_birth
                        const extractedFields = parsedData.workflow_state?.pan_ocr_data?.extracted_fields;
                        
                        // Extract PAN number - ensure it's a valid string
                        let panNumber: string | null = null;
                        if (extractedFields?.pan_number) {
                            const panValue = String(extractedFields.pan_number).trim();
                            if (panValue && panValue.length > 0) {
                                panNumber = panValue;
                            }
                        }
                        
                        // Extract date of birth and convert from DD/MM/YYYY to YYYY-MM-DD
                        let dateOfBirth: string | null = null;
                        if (extractedFields?.date_of_birth) {
                            const dobValue = String(extractedFields.date_of_birth).trim();
                            if (dobValue && dobValue.length > 0) {
                                dateOfBirth = convertDDMMYYYYToISO(dobValue);
                            }
                        }
                        
                        // Debug: Log the extracted data
                        console.log('Extracted PAN data from API:', {
                            extractedFields: extractedFields,
                            rawPanNumber: extractedFields?.pan_number,
                            rawDateOfBirth: extractedFields?.date_of_birth,
                            panNumber,
                            dateOfBirth
                        });
                        
                        // Only populate if we have at least one field with actual value
                        if (panNumber || dateOfBirth) {
                            // Auto-populate Customer Details (Basic Details) page via LeadContext
                            if (currentLead) {
                                if (docInfo?.applicantType === 'coapplicant' && documentCoApplicantId && updateCoApplicant) {
                                    const coApplicants = currentLead.formData?.coApplicants || [];
                                    const coApplicant = coApplicants.find((coApp: any) => coApp.id === documentCoApplicantId);
                                    if (coApplicant) {
                                        const existingStep2 = coApplicant.data?.step2 || {};
                                        const updatedDob = dateOfBirth || existingStep2.dob || '';
                                        let calculatedAge = existingStep2.age || 0;
                                        if (updatedDob) {
                                            try {
                                                const today = new Date();
                                                const birthDate = new Date(updatedDob);
                                                if (!isNaN(birthDate.getTime())) {
                                                    calculatedAge = today.getFullYear() - birthDate.getFullYear();
                                                    const m = today.getMonth() - birthDate.getMonth();
                                                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                                                        calculatedAge--;
                                                    }
                                                }
                                            } catch (e) {
                                                console.error('Error calculating age:', e);
                                            }
                                        }

                                        const updatedStep2 = {
                                            ...existingStep2,
                                            hasPan: 'yes',
                                            pan: panNumber || existingStep2.pan || '',
                                            dob: updatedDob,
                                            age: calculatedAge,
                                        };

                                        updateCoApplicant(currentLead.id, documentCoApplicantId, {
                                            data: {
                                                ...coApplicant.data,
                                                step2: updatedStep2,
                                            },
                                        });

                                        const coApplicantName = getApplicantName(
                                            coApplicant?.data?.basicDetails?.firstName ?? coApplicant?.data?.step1?.firstName,
                                            coApplicant?.data?.basicDetails?.lastName ?? coApplicant?.data?.step1?.lastName
                                        );

                                        toast({
                                            title: 'Success',
                                            description: `PAN document processed successfully for ${coApplicantName}.`,
                                            className: 'bg-green-50 border-green-200',
                                        });
                                    }
                                } else {
                                    // Prepare update data - use extracted values if available, otherwise keep existing
                                    const updatedPanNumber = panNumber || currentLead.panNumber || '';
                                    const updatedDob = dateOfBirth || currentLead.dob || '';
                                    
                                    // Calculate age if DOB is available
                                    let calculatedAge = currentLead.age || 0;
                                    if (updatedDob) {
                                        try {
                                            const today = new Date();
                                            const birthDate = new Date(updatedDob);
                                            if (!isNaN(birthDate.getTime())) {
                                                calculatedAge = today.getFullYear() - birthDate.getFullYear();
                                                const m = today.getMonth() - birthDate.getMonth();
                                                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                                                    calculatedAge--;
                                                }
                                            }
                                        } catch (e) {
                                            console.error('Error calculating age:', e);
                                        }
                                    }
                                    
                                    const updatedStep2 = {
                                        ...currentLead.formData?.step2,
                                        pan: updatedPanNumber,
                                        dob: updatedDob,
                                        age: calculatedAge,
                                        // Keep existing gender value
                                        gender: currentLead.formData?.step2?.gender ?? currentLead.gender ?? '',
                                    };
                                    
                                    updateLead(currentLead.id, {
                                        panNumber: updatedPanNumber,
                                        dob: updatedDob,
                                        age: calculatedAge,
                                        // Keep existing gender value
                                        gender: currentLead.gender ?? '',
                                        formData: {
                                            ...currentLead.formData,
                                            step2: updatedStep2,
                                        },
                                    });

                                    console.log('PAN Data populated successfully:', { 
                                        panNumber, 
                                        dateOfBirth,
                                        updatedPanNumber,
                                        updatedDob,
                                        currentLeadBeforeUpdate: {
                                            panNumber: currentLead.panNumber,
                                            dob: currentLead.dob
                                        }
                                    });
                                    toast({
                                        title: 'Success',
                                        description: 'PAN document processed successfully. PAN Number and Date of Birth populated in Customer Details page.',
                                        className: 'bg-green-50 border-green-200',
                                    });
                                }
                            }
                        } else {
                            console.log('No PAN data found in response:', { 
                                extractedFields,
                                panNumber, 
                                dateOfBirth,
                                workflowStateKeys: Object.keys(parsedData.workflow_state || {}),
                                panOcrData: parsedData.workflow_state?.pan_ocr_data
                            });
                            toast({
                                title: 'Upload Successful',
                                description: 'Document uploaded successfully. Waiting for data parsing...',
                                className: 'bg-green-50 border-green-200',
                            });
                        }
                    }
                    
                    // Handle Aadhaar document - populate Address Details page with address data
                    if (baseDocType === 'Adhaar' && parsedData.address_info) {
                        // Try to get address from parsed_aadhaar_data or addresses array
                        const aadhaarAddress = parsedData.address_info.parsed_aadhaar_data || 
                                             parsedData.address_info.addresses?.[0];
                        
                        // Only populate if we have address data from backend
                        if (aadhaarAddress) {
                            const aadhaarLandmark = (aadhaarAddress as Record<string, any>)?.landmark || '';
                            // Auto-populate Address Details page via LeadContext
                            if (currentLead) {
                                if (docInfo?.applicantType === 'coapplicant' && documentCoApplicantId && updateCoApplicant) {
                                    const coApplicants = currentLead.formData?.coApplicants || [];
                                    const coApplicant = coApplicants.find((coApp: any) => coApp.id === documentCoApplicantId);
                                    if (coApplicant) {
                                        const existingAddresses = coApplicant.data?.step3?.addresses || [];
                                        const updatedAddresses = existingAddresses.length > 0
                                            ? existingAddresses.map((addr: any, index: number) =>
                                                index === 0
                                                    ? {
                                                        ...addr,
                                                        addressLine1: aadhaarAddress.address_line_1 || addr.addressLine1 || '',
                                                        addressLine2: aadhaarAddress.address_line_2 || addr.addressLine2 || '',
                                                        addressLine3: aadhaarAddress.address_line_3 || addr.addressLine3 || '',
                                                        landmark: aadhaarLandmark || addr.landmark || '',
                                                        postalCode: aadhaarAddress.pincode || addr.postalCode || '',
                                                    }
                                                    : addr
                                            )
                                            : [{
                                                id: Date.now().toString(),
                                                addressType: 'residential',
                                                addressLine1: aadhaarAddress.address_line_1 || '',
                                                addressLine2: aadhaarAddress.address_line_2 || '',
                                                addressLine3: aadhaarAddress.address_line_3 || '',
                                                landmark: aadhaarLandmark || '',
                                                postalCode: aadhaarAddress.pincode || '',
                                                isPrimary: true,
                                            }];

                                        updateCoApplicant(currentLead.id, documentCoApplicantId, {
                                            data: {
                                                ...coApplicant.data,
                                                step3: { addresses: updatedAddresses },
                                            },
                                        });

                                        const coApplicantName = getApplicantName(
                                            coApplicant?.data?.basicDetails?.firstName ?? coApplicant?.data?.step1?.firstName,
                                            coApplicant?.data?.basicDetails?.lastName ?? coApplicant?.data?.step1?.lastName
                                        );

                                        toast({
                                            title: 'Success',
                                            description: `Aadhaar document processed successfully for ${coApplicantName}.`,
                                            className: 'bg-green-50 border-green-200',
                                        });
                                    }
                                } else {
                                    const existingAddresses = currentLead.formData?.step3?.addresses || [];
                                    const updatedAddresses = existingAddresses.length > 0 
                                        ? existingAddresses.map((addr: any, index: number) => 
                                            index === 0 ? {
                                                ...addr,
                                                addressLine1: aadhaarAddress.address_line_1 || addr.addressLine1 || '',
                                                addressLine2: aadhaarAddress.address_line_2 || addr.addressLine2 || '',
                                                addressLine3: aadhaarAddress.address_line_3 || addr.addressLine3 || '',
                                                landmark: aadhaarLandmark || addr.landmark || '',
                                                postalCode: aadhaarAddress.pincode || addr.postalCode || '',
                                            } : addr
                                          )
                                        : [{
                                            id: Date.now().toString(),
                                            addressType: 'residential',
                                            addressLine1: aadhaarAddress.address_line_1 || '',
                                            addressLine2: aadhaarAddress.address_line_2 || '',
                                            addressLine3: aadhaarAddress.address_line_3 || '',
                                            landmark: aadhaarLandmark,
                                            postalCode: aadhaarAddress.pincode || '',
                                        }];
                                    
                                    updateLead(currentLead.id, {
                                        formData: {
                                            ...currentLead.formData,
                                            step3: { addresses: updatedAddresses },
                                        },
                                    });

                                    toast({
                                        title: 'Success',
                                        description: 'Aadhaar document processed successfully. Address populated in Address Details page.',
                                        className: 'bg-green-50 border-green-200',
                                    });
                                }
                            }
                        } else {
                            toast({
                                title: 'Upload Successful',
                                description: 'Aadhaar document uploaded successfully. Parsing address data...',
                                className: 'bg-green-50 border-green-200',
                            });
                        }
                    }
                } else {
                    // If detailed info fetch fails, still show success for upload but note parsing may be pending
                    if (baseDocType === 'PAN' || baseDocType === 'Adhaar') {
                        toast({
                            title: 'Upload Successful',
                            description: 'Document uploaded successfully. Parsing in progress...',
                            className: 'bg-green-50 border-green-200',
                        });
                    }
                }
            } else {
                // For non-PAN/Aadhaar documents, just show success
                toast({
                    title: 'Success',
                    description: `${file.name} uploaded successfully`,
                    variant: 'default',
                    className: 'bg-green-50 border-green-200',
                });
            }

            return { success: true };
        } catch (error: any) {
            toast({
                title: 'Upload Failed',
                description: error.message || 'Failed to upload document. Please try again.',
                variant: 'destructive',
            });
            return { success: false };
        }
    };

    // Handle file selection (for non-front/back documents)
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !documentType || !selectedDocument) {
            toast({
                title: 'Error',
                description: 'Please select a document type first',
                variant: 'destructive',
            });
            return;
        }

        const file = files[0];
        
        // Basic file extension check only (not document content validation)
        // Actual document validation is done by backend API
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const isValidFileType = selectedDocument.fileTypes.some((type: string) => {
            if (type === 'image') {
                return ['jpg', 'jpeg', 'png', 'heic'].includes(fileExtension || '');
            } else if (type === 'pdf') {
                return fileExtension === 'pdf';
            }
            return false;
        });

        if (!isValidFileType) {
            const allowedTypes = selectedDocument.fileTypes.map((type: string) => 
                type === 'image' ? 'PNG, JPG, JPEG, HEIC' : 'PDF'
            ).join(' or ');
            toast({
                title: 'Invalid File Type',
                description: `This document type only accepts ${allowedTypes} files`,
                variant: 'destructive',
            });
            return;
        }

        const fileId = Date.now().toString();
        const isPdf = fileExtension === 'pdf';
        const ownerType = selectedDocument.applicantType;
        const ownerId = selectedDocument.coApplicantId;
        const documentLabel = selectedDocument.label || file.name;
        const { baseValue: baseDocType } = parseDocumentValue(documentType);

        // Create preview URL for images
        const reader = new FileReader();
        reader.onloadend = async () => {
            const previewUrl = reader.result as string;
            
            const newFile: UploadedFile = {
                id: fileId,
                name: file.name,
                type: documentType,
                status: 'Processing',
                previewUrl: isPdf ? undefined : previewUrl,
                fileType: isPdf ? 'pdf' : 'image',
                ownerType,
                ownerId,
                label: documentLabel
            };

            setOpenSections((sections) => ({
                ...sections,
                ...(ownerType === 'main' ? { applicant: true } : {}),
                ...(ownerType === 'coapplicant' && ownerId ? { [`coapplicant-${ownerId}`]: true } : {}),
                ...(ownerType === 'collateral' ? { collateral: true } : {})
            }));

            if (baseDocType === 'PAN' || baseDocType === 'Adhaar') {
                setUploadedFiles((prev) => {
                    const filteredFiles = prev.filter((f) =>
                        !(f.type === documentType && f.status === 'Failed')
                    );
                    return [...filteredFiles, newFile];
                });
            } else {
                setUploadedFiles((prev) => [...prev, newFile]);
            }
            toast({ title: 'Processing', description: `Uploading ${documentLabel}...` });

            // Upload document via API
            const uploadResult = await handleDocumentUpload(file, documentType, fileId);
            
            // Only mark as success if backend returned 200 OK (success: true)
            const isSuccess = uploadResult?.success === true;
            
            setUploadedFiles((prev) => {
                const updatedFiles = prev.map((f) =>
                    f.id === fileId
                        ? { 
                            ...f, 
                            status: isSuccess ? 'Success' as const : 'Failed' as const, 
                            error: isSuccess ? undefined : 'Upload failed - backend validation failed' 
                        }
                        : f
                );
                
                // Update files in lead data
                if (currentLead) {
                    updateLead(currentLead.id, {
                        formData: {
                            ...currentLead.formData,
                            step8: { 
                                ...currentLead.formData.step8, 
                                files: updatedFiles 
                            }
                        }
                    });
                }
                
                return updatedFiles;
            });
            
            // Success toasts for PAN/Aadhaar/co-applicant collateral are handled in handleDocumentUpload
        };
        
        if (isPdf) {
            // For PDF, just start upload without preview
            reader.readAsDataURL(file);
        } else {
            reader.readAsDataURL(file);
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
        setDocumentType('');
    };

    // Handle file selection for front/back documents from modal
    const handleFrontBackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !uploadMode) return;

        const file = files[0];
        
        // Create preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
            const tempFile: TempFile = {
                name: file.name,
                file: file,
                dataUrl: reader.result as string
            };
            
            if (uploadMode === 'front') {
                setFrontFile(tempFile);
            } else {
                setBackFile(tempFile);
            }
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowUploadMethodModal(false);
    };

    // Enumerate available cameras
    const enumerateCameras = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            setAvailableCameras(videoDevices);
            return videoDevices;
        } catch (error) {
            console.error('Error enumerating cameras:', error);
            return [];
        }
    };

    const startCamera = async () => {
        if (!selectedDocument && !uploadMode) {
            toast({ title: 'Error', description: 'Please select a document type first', variant: 'destructive' });
            return;
        }
        
        const doc = selectedDocument;
        if (doc && !doc.requiresCamera) {
            toast({ 
                title: 'Camera Not Available', 
                description: 'This document type only accepts file uploads, not camera capture', 
                variant: 'destructive' 
            });
            return;
        }
        
        setCameraPermissionDenied(false);
        try {
            // Request camera access first to get permission
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            setIsCameraOpen(true);
            
            // After getting permission, enumerate cameras
            const cameras = await enumerateCameras();
            if (cameras.length > 0) {
                setCurrentCameraIndex(0);
            }
        } catch (err: any) {
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setCameraPermissionDenied(true);
            } else {
                toast({ title: 'Camera Error', description: 'Could not access the camera.', variant: 'destructive' });
            }
        }
    };

    // Flip camera function
    const flipCamera = async () => {
        if (availableCameras.length <= 1) return;
        
        // Stop current stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        // Switch to next camera
        const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
        setCurrentCameraIndex(nextIndex);
        
        try {
            const constraints: MediaStreamConstraints = {
                video: { deviceId: { exact: availableCameras[nextIndex].deviceId } }
            };
            
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(newStream);
            
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
        } catch (error) {
            toast({ title: 'Camera Error', description: 'Could not switch camera.', variant: 'destructive' });
        }
    };

    useEffect(() => {
        if (isCameraOpen && stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [isCameraOpen, stream]);

    // Initialize crop on image load
    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const crop = makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            16 / 9, // aspect ratio
            width,
            height
        );
        const centeredCrop = centerCrop(crop, width, height);
        setCrop(centeredCrop);
    };

    // Get cropped image
    const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<string> => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve('');
                return;
            }

            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;

            canvas.width = crop.width;
            canvas.height = crop.height;

            ctx.drawImage(
                image,
                crop.x * scaleX,
                crop.y * scaleY,
                crop.width * scaleX,
                crop.height * scaleY,
                0,
                0,
                crop.width,
                crop.height
            );

            canvas.toBlob((blob) => {
                if (!blob) {
                    resolve('');
                    return;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve(reader.result as string);
                };
                reader.readAsDataURL(blob);
            }, 'image/jpeg', 0.95);
        });
    };

    // Handle crop completion
    const handleCropComplete = async () => {
        if (!imageRef || !completedCrop) {
            toast({ title: 'Error', description: 'No crop selected', variant: 'destructive' });
            return;
        }

        const croppedImageUrl = await getCroppedImg(imageRef, completedCrop);
        processCapturedImage(croppedImageUrl);
        setShowCropModal(false);
        setCapturedImageSrc('');
        setCrop(undefined);
        setCompletedCrop(undefined);
    };

    // Helper function to convert dataUrl to File
    const dataURLtoFile = (dataurl: string, filename: string): File => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    // Process captured image after cropping - now uses API validation
    const processCapturedImage = async (dataUrl: string) => {
        const fileId = Date.now().toString();
        
        // For front/back documents
        if (uploadMode) {
            const tempFile: TempFile = {
                name: `capture_${fileId}.jpg`,
                file: null,
                dataUrl: dataUrl
            };
            
            if (uploadMode === 'front') {
                setFrontFile(tempFile);
            } else {
                setBackFile(tempFile);
            }
            setShowUploadMethodModal(false);
        } else {
            // For regular documents - convert dataUrl to File and upload via API
            if (!documentType || !selectedDocument) {
                toast({
                    title: 'Error',
                    description: 'Document type not selected',
                    variant: 'destructive',
                });
                return;
            }

            const { baseValue: baseDocType } = parseDocumentValue(documentType);
            const fileName = baseDocType === 'PAN' ? 'pan.jpg' : baseDocType === 'Adhaar' ? 'aadhaar.jpg' : `capture_${fileId}.jpg`;
            const ownerType = selectedDocument.applicantType;
            const ownerId = selectedDocument.coApplicantId;
            const documentLabel = selectedDocument.label || fileName;
            
            // Convert dataUrl to File
            const capturedFile = dataURLtoFile(dataUrl, fileName);
            
            // Create preview file entry with 'Processing' status
            const newFile: UploadedFile = {
                id: fileId,
                name: fileName,
                type: documentType,
                status: 'Processing',
                previewUrl: dataUrl,
                fileType: 'image',
                ownerType,
                ownerId,
                label: documentLabel
            };
            
            // If PAN or Aadhaar, delete old failed entries of the same type
            if (ownerType === 'main') {
                setOpenSections((sections) => ({ ...sections, applicant: true }));
            } else if (ownerType === 'coapplicant' && ownerId) {
                setOpenSections((sections) => ({ ...sections, [`coapplicant-${ownerId}`]: true }));
            } else if (ownerType === 'collateral') {
                setOpenSections((sections) => ({ ...sections, collateral: true }));
            }

            if (baseDocType === 'PAN' || baseDocType === 'Adhaar') {
                setUploadedFiles((prev) => {
                    const filteredFiles = prev.filter((f) => 
                        !(f.type === documentType && f.status === 'Failed')
                    );
                    return [...filteredFiles, newFile];
                });
            } else {
                setUploadedFiles((prev) => {
                    return [...prev, newFile];
                });
            }
            
            toast({ title: 'Processing', description: `Uploading ${documentLabel}...` });

            // Upload document via API (same flow as file upload)
            const uploadResult = await handleDocumentUpload(capturedFile, documentType, fileId);
            
            // Only mark as success if backend returned 200 OK (success: true)
            const isSuccess = uploadResult?.success === true;
            
            setUploadedFiles((prev) => {
                const updatedFiles = prev.map((f) =>
                    f.id === fileId
                        ? { 
                            ...f, 
                            status: isSuccess ? 'Success' as const : 'Failed' as const, 
                            error: isSuccess ? undefined : 'Upload failed - backend validation failed' 
                        }
                        : f
                );
                
                // Update files in lead data
                if (currentLead) {
                    updateLead(currentLead.id, {
                        formData: {
                            ...currentLead.formData,
                            step8: { 
                                ...currentLead.formData.step8, 
                                files: updatedFiles 
                            }
                        }
                    });
                }
                
                return updatedFiles;
            });
            
            // Success toasts for PAN/Aadhaar are handled in handleDocumentUpload
            // For other documents, show success toast
            if (isSuccess && !(baseDocType === 'PAN' || baseDocType === 'Adhaar')) {
                toast({
                    title: 'Success',
                    description: 'Image captured and uploaded successfully',
                    variant: 'default',
                    className: 'bg-green-50 border-green-200'
                });
            } else if (!isSuccess) {
                toast({
                    title: 'Upload Failed',
                    description: 'Failed to upload captured image. Please try again.',
                    variant: 'destructive',
                });
            }
            
            setDocumentType('');
        }
    };

    // Capture image function - shows crop modal instead of directly processing
    const captureImage = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                
                // Show crop modal instead of directly processing
                setCapturedImageSrc(dataUrl);
                setShowCropModal(true);
                stopCamera();
            }
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        setStream(null);
        setIsCameraOpen(false);
    };

    const handleRetry = (fileId: string) => {
        // Mock retry logic
    };

    const handleDelete = (fileId: string) => {
        setUploadedFiles(uploadedFiles.filter((f) => f.id !== fileId));
    };


    // Handle front/back button click
    const handleFrontBackClick = (side: 'front' | 'back') => {
        setUploadMode(side);
        setShowUploadMethodModal(true);
    };

    // Handle upload document button click (for front/back documents)
    const handleUploadFrontBackDocument = async () => {
        if (!frontFile || !backFile || !documentType) return;

        if (!currentLead?.appId) {
            toast({
                title: 'Error',
                description: 'Application ID not found. Please create a new lead first.',
                variant: 'destructive',
            });
            return;
        }

        setIsUploading(true);
        setUploadError('');
        const fileId = Date.now().toString();

        // Convert dataUrl to File if needed
        const frontFileObj = frontFile.file || (frontFile.dataUrl ? dataURLtoFile(frontFile.dataUrl, frontFile.name) : null);
        const backFileObj = backFile.file || (backFile.dataUrl ? dataURLtoFile(backFile.dataUrl, backFile.name) : null);

        if (!frontFileObj || !backFileObj) {
            toast({
                title: 'Error',
                description: 'Failed to process files. Please try again.',
                variant: 'destructive',
            });
            setIsUploading(false);
            return;
        }

        const ownerType = selectedDocument?.applicantType ?? 'main';
        const ownerId = selectedDocument?.coApplicantId;
        const documentLabel = selectedDocument?.label || documentType;

        const newFile: UploadedFile = {
            id: fileId,
            name: `${documentType}_combined`,
            type: documentType,
            status: 'Processing',
            frontName: frontFile.name,
            backName: backFile.name,
            frontPreviewUrl: frontFile.dataUrl,
            backPreviewUrl: backFile.dataUrl,
            fileType: 'image',
            ownerType,
            ownerId,
            label: documentLabel
        };

        setOpenSections((sections) => ({
            ...sections,
            ...(ownerType === 'main' ? { applicant: true } : {}),
            ...(ownerType === 'coapplicant' && ownerId ? { [`coapplicant-${ownerId}`]: true } : {}),
            ...(ownerType === 'collateral' ? { collateral: true } : {})
        }));

        setUploadedFiles((prev) => [...prev, newFile]);
        toast({ title: 'Processing', description: `Uploading ${documentLabel}...` });

        try {
            // Upload document via API with both front and back files
            const uploadResult = await handleDocumentUpload(frontFileObj, documentType, fileId, backFileObj);
            
            // Only mark as success if backend returned 200 OK (success: true)
            const isSuccess = uploadResult?.success === true;
            
            setUploadedFiles((prev) => {
                const updatedFiles = prev.map((f) =>
                    f.id === fileId
                        ? { 
                            ...f, 
                            status: isSuccess ? 'Success' as const : 'Failed' as const,
                            error: isSuccess ? undefined : 'Upload failed - backend validation failed'
                        }
                        : f
                );
                
                // Update files in lead data
                if (currentLead) {
                    updateLead(currentLead.id, {
                        formData: {
                            ...currentLead.formData,
                            step8: { 
                                ...currentLead.formData.step8, 
                                files: updatedFiles 
                            }
                        }
                    });
                }
                
                return updatedFiles;
            });
            
            if (isSuccess) {
                toast({ 
                    title: 'Success', 
                    description: 'Documents uploaded successfully',
                    className: 'bg-green-50 border-green-200'
                });
                // Clear temp files and reset
                setFrontFile(null);
                setBackFile(null);
                setDocumentType('');
            } else {
                toast({
                    title: 'Upload Failed',
                    description: 'Failed to upload documents. Please try again.',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Upload Failed',
                description: error.message || 'Failed to upload documents. Please try again.',
                variant: 'destructive',
            });
            setUploadedFiles((prev) => {
                return prev.map((f) =>
                    f.id === fileId
                        ? { ...f, status: 'Failed' as const, error: 'Upload failed' }
                        : f
                );
            });
        } finally {
            setIsUploading(false);
        }
    };

    // Handle replace for front/back
    const handleReplaceFrontBack = (side: 'front' | 'back') => {
        setUploadMode(side);
        setShowUploadMethodModal(true);
    };

    const handleSave = () => {
        if (!currentLead) return;

        // Save the uploaded files to step8
        updateLead(currentLead.id, {
            formData: {
                ...currentLead.formData,
                step8: { files: uploadedFiles }
            }
        });

        toast({
            title: 'Information Saved',
            description: 'Documents have been saved successfully.',
            className: 'bg-green-50 border-green-200'
        });

        router.push('/lead/new-lead-info');
    };

    const handleExit = () => {
        router.push('/lead/new-lead-info');
    };

    const getUploadedDocTypes = () => {
        return new Set(uploadedFiles.filter(file => file.status === 'Success').map(file => file.type));
    };

    return (
        <DashboardLayout title="Document Upload" showNotifications={false} showExitButton={true} onExit={handleExit}>
            <div className="max-w-2xl mx-auto pb-24">

                {/* Camera Modal */}
                {isCameraOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center p-4">
                        <video ref={videoRef} autoPlay playsInline className="w-full max-w-lg h-auto rounded-lg border-4 border-gray-600" />
                        <div className="flex space-x-4 mt-4">
                            <Button onClick={captureImage} className="bg-green-600 hover:bg-green-700">
                                <Camera className="w-4 h-4 mr-2" /> Capture
                            </Button>
                            <Button onClick={stopCamera} variant="destructive">Cancel</Button>
                            {/* Flip camera button - only show if multiple cameras available */}
                            {availableCameras.length > 1 && (
                                <Button onClick={flipCamera} variant="outline" size="icon" className="w-10 h-10">
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Crop Modal */}
                {showCropModal && capturedImageSrc && (
                    <Dialog open={showCropModal} onOpenChange={setShowCropModal}>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Crop Image</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                {capturedImageSrc && (
                                    <div className="flex justify-center">
                                        <ReactCrop
                                            crop={crop}
                                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                                            onComplete={(c) => setCompletedCrop(c)}
                                            aspect={undefined}
                                            minWidth={50}
                                            minHeight={50}
                                        >
                                            <img
                                                ref={(el) => setImageRef(el)}
                                                src={capturedImageSrc}
                                                alt="Captured"
                                                style={{ maxHeight: '70vh', maxWidth: '100%' }}
                                                onLoad={onImageLoad}
                                            />
                                        </ReactCrop>
                                    </div>
                                )}
                                <div className="flex justify-end space-x-2">
                                    <Button variant="outline" onClick={() => {
                                        setShowCropModal(false);
                                        setCapturedImageSrc('');
                                        setCrop(undefined);
                                        setCompletedCrop(undefined);
                                    }}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleCropComplete} disabled={!completedCrop}>
                                        Use Cropped Image
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}

                {/* Camera Permission Dialog */}
                <AlertDialog open={cameraPermissionDenied} onOpenChange={setCameraPermissionDenied}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center"><AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" /> Camera Access Required</AlertDialogTitle>
                            <AlertDialogDescription>
                                Please allow camera access in your browser settings to capture documents directly from your device.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <Button variant="outline" onClick={() => setCameraPermissionDenied(false)}>Close</Button>
                            <AlertDialogAction onClick={() => { setCameraPermissionDenied(false); startCamera(); }}>
                                Try Again
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Upload Method Modal */}
                <Dialog open={showUploadMethodModal} onOpenChange={setShowUploadMethodModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Choose Upload Method - {uploadMode === 'front' ? 'Front Side' : 'Back Side'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-4">
                            {selectedDocument?.requiresCamera && (
                                <Button 
                                    onClick={() => {
                                        setShowUploadMethodModal(false);
                                        startCamera();
                                    }} 
                                    variant="outline" 
                                    className="w-full flex items-center justify-center h-20 space-y-1 border-2 border-blue-300 hover:bg-blue-50"
                                >
                                    <Camera className="w-6 h-6 text-blue-600 mr-2" />
                                    <span className="text-sm font-medium">Capture from Camera</span>
                                </Button>
                            )}
                            <Button 
                                onClick={() => fileInputRef.current?.click()} 
                                variant="outline" 
                                className="w-full flex items-center justify-center h-20 space-y-1 border-2 border-blue-300 hover:bg-blue-50"
                            >
                                <Upload className="w-6 h-6 text-blue-600 mr-2" />
                                <span className="text-sm font-medium">Select from Files</span>
                            </Button>
                            {selectedDocument?.fileTypes && selectedDocument.fileTypes.length > 0 && (
                                <div className="text-xs text-gray-600 mt-2">
                                    <p className="font-medium">Accepted file types:</p>
                                    <p>{selectedDocument.fileTypes.map((type: string) => 
                                        type === 'image' ? 'PNG, JPG, JPEG, HEIC' : 'PDF'
                                    ).join(', ')}</p>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-6">KYC & Other Documents</h2>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="entitySelect">Whose document are you uploading?</Label>
                                <Select
                                    value={selectedEntity}
                                    onValueChange={(value) => {
                                        setSelectedEntity(value);
                                        setDocumentType('');
                                        setFrontFile(null);
                                        setBackFile(null);
                                        setUploadError('');
                                    }}
                                >
                                    <SelectTrigger id="entitySelect" className="h-12">
                                        <SelectValue placeholder="Select applicant / co-applicant..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {entityOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="documentType">Select Document Type</Label>
                                <Select value={documentType} onValueChange={(value) => {
                                    setDocumentType(value);
                                    setFrontFile(null);
                                    setBackFile(null);
                                    setUploadError('');
                                }}>
                                    <SelectTrigger id="documentType" className="h-12">
                                        <SelectValue placeholder="Choose document type..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredDocuments.map(doc => {
                                            const isUploaded = getUploadedDocTypes().has(doc.value);
                                            return (
                                                <DocumentSelectItem key={doc.value} docType={doc} isUploaded={isUploaded} />
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            {documentType && selectedDocument && (
                                <>
                                    {selectedDocument.requiresFrontBack ? (
                                        /* Front/Back Document Upload Card */
                                        <Card className={cn(
                                            "border-2",
                                            uploadError ? "border-red-200" : "border-blue-200"
                                        )}>
                                            <CardContent className="p-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold text-gray-900">
                                                        {selectedDocument.label}
                                                    </h3>
                                                </div>

                                                {uploadError && (
                                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                                                        <div className="flex items-center gap-2">
                                                            <XCircle className="w-4 h-4" />
                                                            <span>{uploadError}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-2 gap-3">
                                                    {/* Front Side */}
                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-gray-600">Front Side</Label>
                                                        {frontFile ? (
                                                            <div className="border-2 border-green-200 rounded-lg p-2 bg-green-50">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                                    <p className="text-xs text-gray-700 truncate">{frontFile.name}</p>
                                                                </div>
                                                                {frontFile.dataUrl && (
                                                                    <img src={frontFile.dataUrl} alt="Front preview" className="w-full h-24 object-cover rounded" />
                                                                )}
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="w-full mt-2 h-8 text-xs"
                                                                    onClick={() => handleReplaceFrontBack('front')}
                                                                >
                                                                    Replace
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button 
                                                                variant="outline" 
                                                                className="w-full h-24 border-2 border-dashed border-gray-300"
                                                                onClick={() => handleFrontBackClick('front')}
                                                            >
                                                                <div className="flex flex-col items-center">
                                                                    <ImageIcon className="w-6 h-6 text-gray-400 mb-1" />
                                                                    <span className="text-xs text-gray-600">Upload Front</span>
                                                                </div>
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {/* Back Side */}
                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-gray-600">Back Side</Label>
                                                        {backFile ? (
                                                            <div className="border-2 border-green-200 rounded-lg p-2 bg-green-50">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                                    <p className="text-xs text-gray-700 truncate">{backFile.name}</p>
                                                                </div>
                                                                {backFile.dataUrl && (
                                                                    <img src={backFile.dataUrl} alt="Back preview" className="w-full h-24 object-cover rounded" />
                                                                )}
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="w-full mt-2 h-8 text-xs"
                                                                    onClick={() => handleReplaceFrontBack('back')}
                                                                >
                                                                    Replace
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button 
                                                                variant="outline" 
                                                                className="w-full h-24 border-2 border-dashed border-gray-300"
                                                                onClick={() => handleFrontBackClick('back')}
                                                            >
                                                                <div className="flex flex-col items-center">
                                                                    <ImageIcon className="w-6 h-6 text-gray-400 mb-1" />
                                                                    <span className="text-xs text-gray-600">Upload Back</span>
                                                                </div>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <Button 
                                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                                    disabled={!frontFile || !backFile || isUploading}
                                                    onClick={handleUploadFrontBackDocument}
                                                >
                                                    {isUploading ? (
                                                        <>
                                                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                                                            Processing...
                                                        </>
                                                    ) : (
                                                        'Upload Document'
                                                    )}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        /* Regular Document Upload */
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-medium text-gray-900 mb-2">Choose Upload Method</h3>
                                            <div className={`grid gap-3 ${selectedDocument.requiresCamera ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                {selectedDocument.requiresCamera && (
                                                    <Button onClick={startCamera} variant="outline" className="flex flex-col items-center justify-center h-20 space-y-1 border-2 border-blue-300 hover:bg-blue-50">
                                                        <Camera className="w-6 h-6 text-blue-600" />
                                                        <span className="text-xs font-medium text-center">Capture from Camera</span>
                                                    </Button>
                                                )}
                                                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex flex-col items-center justify-center h-20 space-y-1 border-2 border-blue-300 hover:bg-blue-50">
                                                    <Upload className="w-6 h-6 text-blue-600" />
                                                    <span className="text-xs font-medium text-center">Select from Files</span>
                                                </Button>
                                            </div>
                                            {selectedDocument.fileTypes.length > 0 && (
                                                <div className="text-xs text-gray-600 mt-2">
                                                    <p className="font-medium">Accepted file types:</p>
                                                    <p>{selectedDocument.fileTypes.map((type: string) => 
                                                        type === 'image' ? 'PNG, JPG, JPEG, HEIC' : 'PDF'
                                                    ).join(', ')}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            <input 
                                ref={fileInputRef} 
                                type="file" 
                                className="hidden" 
                                onChange={selectedDocument?.requiresFrontBack ? handleFrontBackFileSelect : handleFileSelect}
                                accept={selectedDocument ? 
                                    selectedDocument.fileTypes.map((type: string) => 
                                        type === 'image' ? '.jpg,.jpeg,.png,.heic' : '.pdf'
                                    ).join(',') : 
                                    '.jpg,.jpeg,.png,.pdf'
                                } 
                            />

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                                <p className="font-semibold mb-1">How to upload:</p>
                                <p className="text-xs mb-2">1. Select document type from the dropdown</p>
                                <p className="text-xs">2. Upload file or capture photo</p>
                            </div>

                            {uploadedFiles.length > 0 && (
                                <div>
                                    <h3 className="font-semibold text-gray-900 my-4">Uploaded Documents</h3>
                                    {(() => {
                                        const coApplicants = currentLead?.formData?.coApplicants || [];
                                        const { applicantDocs, coApplicantDocsMap, collateralDocs } = categorizeUploadedFiles(uploadedFiles, availableDocuments, coApplicants);
                                        
                                        const renderDocumentCard = (file: UploadedFile) => (
                                            <Card key={file.id} className={cn(
                                                "cursor-pointer hover:shadow-md transition-shadow",
                                                file.status === 'Success' ? 'border-green-200' :
                                                    file.status === 'Failed' ? 'border-red-200' :
                                                        'border-blue-200'
                                            )}>
                                                <CardContent 
                                                    className="p-3 sm:p-4"
                                                    onClick={() => {
                                                        if (file.status === 'Success' && (file.previewUrl || file.frontPreviewUrl || file.fileType === 'pdf')) {
                                                            setPreviewFile(file);
                                                            setShowPreview(true);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-start space-x-2 sm:space-x-3 flex-1 min-w-0">
                                                            {file.status === 'Processing' && (
                                                                <Loader className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
                                                            )}
                                                            {file.status === 'Success' && (
                                                                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                                            )}
                                                            {file.status === 'Failed' && (
                                                                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{getDocumentDisplayName(file.type, availableDocuments)}</p>
                                                                {file.frontName && file.backName && (
                                                                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                                                        <p className="truncate">Front: {file.frontName}</p>
                                                                        <p className="truncate">Back: {file.backName}</p>
                                                                    </div>
                                                                )}
                                                                {!file.frontName && !file.backName && (
                                                                    <p className="text-xs text-gray-500 truncate">{file.name}</p>
                                                                )}
                                                                {file.error && <p className="text-xs text-red-600 mt-1 line-clamp-2">{file.error}</p>}
                                                                {file.status === 'Success' && (file.previewUrl || file.frontPreviewUrl || file.fileType === 'pdf') && (
                                                                    <p className="text-xs text-blue-600 mt-1">Click to preview</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1" onClick={(e) => e.stopPropagation()}>
                                                            {file.status === 'Failed' && (
                                                                <Button variant="ghost" size="icon" onClick={() => handleRetry(file.id)} className="w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-100 flex-shrink-0">
                                                                    <RotateCcw className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            {/* Only show delete button for Failed or Processing documents */}
                                                            {(file.status === 'Failed' || file.status === 'Processing') && (
                                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(file.id)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-100 flex-shrink-0">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );

                                        return (
                                            <div className="space-y-4">
                                                {/* Applicant Documents */}
                                                {applicantDocs.length > 0 && (
                                                    <Collapsible
                                                        open={openSections['applicant']}
                                                        onOpenChange={(open) => setOpenSections(prev => ({ ...prev, applicant: open }))}
                                                    >
                                                        <Card className="border-blue-200">
                                                            <CollapsibleTrigger className="w-full">
                                                                <CardContent className="p-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-semibold text-gray-800 flex items-center">
                                                                            <User className="w-4 h-4 mr-2 text-blue-600" />
                                                                            Applicant Documents ({applicantDocs.length})
                                                                        </h4>
                                                                        <ChevronDown className={cn("w-5 h-5 text-gray-500 transition-transform", openSections['applicant'] && "rotate-180")} />
                                                                    </div>
                                                                </CardContent>
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent>
                                                                <CardContent className="px-4 pb-4 pt-0 space-y-2">
                                                                    {applicantDocs.map(renderDocumentCard)}
                                                                </CardContent>
                                                            </CollapsibleContent>
                                                        </Card>
                                                    </Collapsible>
                                                )}

                                                {/* Co-Applicant Documents - Separate section for each */}
                                                {coApplicants.map((coApp: any, index: number) => {
                                                    const coAppDocs = coApplicantDocsMap[coApp.id] || [];
                                                    if (coAppDocs.length === 0) return null;
                                                    
                                                    const coAppName = getApplicantName(coApp?.data?.step1?.firstName, coApp?.data?.step1?.lastName);
                                                    const sectionKey = `coapplicant-${coApp.id}`;
                                                    
                                                    return (
                                                        <Collapsible
                                                            key={coApp.id}
                                                            open={openSections[sectionKey]}
                                                            onOpenChange={(open) => setOpenSections(prev => ({ ...prev, [sectionKey]: open }))}
                                                        >
                                                            <Card className="border-green-200">
                                                                <CollapsibleTrigger className="w-full">
                                                                    <CardContent className="p-4">
                                                                        <div className="flex items-center justify-between">
                                                                            <h4 className="text-sm font-semibold text-gray-800 flex items-center">
                                                                                <Users className="w-4 h-4 mr-2 text-green-600" />
                                                                                Co-Applicant {index + 1} - {coAppName} ({coAppDocs.length})
                                                                            </h4>
                                                                            <ChevronDown className={cn("w-5 h-5 text-gray-500 transition-transform", openSections[sectionKey] && "rotate-180")} />
                                                                        </div>
                                                                    </CardContent>
                                                                </CollapsibleTrigger>
                                                                <CollapsibleContent>
                                                                    <CardContent className="px-4 pb-4 pt-0 space-y-2">
                                                                        {coAppDocs.map(renderDocumentCard)}
                                                                    </CardContent>
                                                                </CollapsibleContent>
                                                            </Card>
                                                        </Collapsible>
                                                    );
                                                })}

                                                {/* Collateral Documents */}
                                                {collateralDocs.length > 0 && (
                                                    <Collapsible
                                                        open={openSections['collateral']}
                                                        onOpenChange={(open) => setOpenSections(prev => ({ ...prev, collateral: open }))}
                                                    >
                                                        <Card className="border-purple-200">
                                                        <CollapsibleTrigger className="w-full">
                                                            <CardContent className="p-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className="text-sm font-semibold text-gray-800 flex items-center">
                                                                        <Home className="w-4 h-4 mr-2 text-purple-600" />
                                                                        Collateral Documents ({collateralDocs.length})
                                                                    </h4>
                                                                    <ChevronDown className={cn("w-5 h-5 text-gray-500 transition-transform", openSections['collateral'] && "rotate-180")} />
                                                                </div>
                                                            </CardContent>
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent>
                                                            <CardContent className="px-4 pb-4 pt-0 space-y-2">
                                                                {collateralDocs.map(renderDocumentCard)}
                                                            </CardContent>
                                                        </CollapsibleContent>
                                                        </Card>
                                                    </Collapsible>
                                                )}

                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
                        <div className="flex gap-3 max-w-2xl mx-auto">
                            <Button
                                onClick={handleSave}
                                className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e] font-medium text-white"
                            >
                                Save Information
                            </Button>
                        </div>
                    </div>

                </div>
            </div>

            {/* Preview Modal */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {previewFile && getDocumentDisplayName(previewFile.type, availableDocuments)}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {previewFile && (
                            <>
                                {/* Single Image Preview */}
                                {previewFile.previewUrl && !previewFile.frontPreviewUrl && (
                                    <div className="flex justify-center">
                                        <img 
                                            src={previewFile.previewUrl} 
                                            alt={previewFile.name}
                                            className="max-w-full h-auto rounded-lg border"
                                        />
                                    </div>
                                )}

                                {/* Front/Back Image Preview */}
                                {previewFile.frontPreviewUrl && previewFile.backPreviewUrl && (
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="font-medium text-gray-900 mb-2">Front Side</h3>
                                            <div className="flex justify-center">
                                                <img 
                                                    src={previewFile.frontPreviewUrl} 
                                                    alt="Front side"
                                                    className="max-w-full h-auto rounded-lg border"
                                                />
                                            </div>
                                            {previewFile.frontName && (
                                                <p className="text-xs text-gray-500 mt-1 text-center">{previewFile.frontName}</p>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900 mb-2">Back Side</h3>
                                            <div className="flex justify-center">
                                                <img 
                                                    src={previewFile.backPreviewUrl} 
                                                    alt="Back side"
                                                    className="max-w-full h-auto rounded-lg border"
                                                />
                                            </div>
                                            {previewFile.backName && (
                                                <p className="text-xs text-gray-500 mt-1 text-center">{previewFile.backName}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* PDF Preview */}
                                {previewFile.fileType === 'pdf' && (
                                    <div className="text-center space-y-4">
                                        <div className="bg-gray-100 rounded-lg p-8">
                                            <svg className="w-16 h-16 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-sm font-medium text-gray-900">{previewFile.name}</p>
                                            <p className="text-xs text-gray-500 mt-1">PDF Document</p>
                                        </div>
                                        <p className="text-sm text-gray-600">PDF preview is not available. The document has been uploaded successfully.</p>
                                    </div>
                                )}

                                {/* File Info */}
                                {previewFile.name && (
                                    <div className="pt-4 border-t">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-500">Document Type:</p>
                                                <p className="font-medium text-gray-900">{getDocumentDisplayName(previewFile.type, availableDocuments)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Status:</p>
                                                <div className="flex items-center gap-2">
                                                    {previewFile.status === 'Success' && (
                                                        <>
                                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                                            <span className="font-medium text-green-700">Uploaded</span>
                                                        </>
                                                    )}
                                                    {previewFile.status === 'Failed' && (
                                                        <>
                                                            <XCircle className="w-4 h-4 text-red-600" />
                                                            <span className="font-medium text-red-700">Failed</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
