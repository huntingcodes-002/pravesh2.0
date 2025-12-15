'use client';

import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, CheckCircle, XCircle, Loader, Trash2, RotateCcw, Camera, AlertTriangle, User, Users, Home, ChevronDown, X, Image as ImageIcon, RefreshCw, Eye, MapPin } from 'lucide-react';
import ReactCrop, { Crop, PixelCrop, makeAspectCrop, centerCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { uploadDocument, uploadCoApplicantDocument, getDetailedInfo, submitPersonalInfo, isApiError, type ApiSuccess, triggerBureauCheck } from '@/lib/api';
import { useGeolocation } from '@uidotdev/usehooks';
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
    subType?: string;
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

const convertDDMMYYYYToISO = (dateStr: string): string => {
    if (!dateStr) return '';

    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
    }

    const stringValue = String(dateStr).trim();
    const slashMatch = stringValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
        const [, day, month, year] = slashMatch;
        return `${year}-${month}-${day}`;
    }

    const ddmmyyyyMatch = stringValue.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        return `${year}-${month}-${day}`;
    }

    try {
        const dateObj = new Date(stringValue);
        if (!Number.isNaN(dateObj.getTime())) {
            return dateObj.toISOString().split('T')[0];
        }
    } catch {
        // ignore parse errors
    }

    return stringValue;
};

const getFieldValue = (field: any): string => {
    if (field === null || field === undefined) return '';
    if (typeof field === 'object' && 'value' in field && field.value !== undefined) {
        return String(field.value).trim();
    }
    return String(field).trim();
};

const unwrapDetailedInfoResponse = (response: ApiSuccess<any> | any) => {
    if (!response || typeof response !== 'object') {
        return { baseData: null, applicationDetails: null, workflowState: null };
    }

    const data = (response as ApiSuccess<any>).data ?? response;
    const applicationDetails = data?.application_details ?? data?.applicationDetails ?? null;
    const workflowState = data?.workflow_state ?? applicationDetails?.workflow_state ?? null;

    return { baseData: data, applicationDetails, workflowState };
};

const findPrimaryParticipant = (applicationDetails: any) => {
    if (!applicationDetails || !Array.isArray(applicationDetails.participants)) return null;
    return (
        applicationDetails.participants.find(
            (participant: any) => participant?.participant_type === 'primary_participant'
        ) ?? applicationDetails.participants[0] ?? null
    );
};

const getFirstAvailable = (source: any, keys: string[], fallback: any = '') => {
    if (!source || typeof source !== 'object') return fallback;
    for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null) {
            const value = source[key];
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed) return trimmed;
            } else if (typeof value === 'number') {
                return value;
            } else if (typeof value === 'boolean') {
                return value;
            } else if (typeof value === 'object' && 'value' in value) {
                const nested = value.value;
                if (nested !== undefined && nested !== null && String(nested).trim() !== '') {
                    return nested;
                }
            } else if (value) {
                return value;
            }
        }
    }
    return fallback;
};

const normalizeGenderValue = (value?: string | null): string => {
    if (!value) return '';
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return '';
    if (['male', 'm'].includes(normalized)) return 'male';
    if (['female', 'f'].includes(normalized)) return 'female';
    if (['other', 'others', 'o'].includes(normalized)) return 'other';
    if (['not-specified', 'not specified', 'na', 'n/a', 'unspecified'].includes(normalized)) return 'not-specified';
    return normalized;
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
    isPropertyPhotos?: boolean;
}

const PROPERTY_PHOTO_OPTIONS = [
    { value: 'collateral_images_front', label: 'Property Front' },
    { value: 'collateral_images_side', label: 'Property Side' },
    { value: 'collateral_images_road', label: 'Property Approach Road' },
    { value: 'collateral_images_surrounding', label: 'Property Surrounding View' },
    { value: 'collateral_images_inside', label: 'Property Inside' },
    { value: 'collateral_images_selfie', label: 'Selfie with owner inside property' },
] as const;

type PropertyPhotoType = (typeof PROPERTY_PHOTO_OPTIONS)[number]['value'];
const PROPERTY_PHOTO_REQUIRED_COUNT = PROPERTY_PHOTO_OPTIONS.length;

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

    documents.push({
        value: 'bank_statement',
        label: `Bank Statement - ${mainApplicantName}`,
        fileTypes: ['pdf', 'image'],
        requiresCamera: false,
        applicantType: 'main',
        required: false,
        requiresFrontBack: false,
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

        documents.push({
            value: `bank_statement_${coApp.id}`,
            label: `Bank Statement - ${name}`,
            fileTypes: ['pdf', 'image'],
            requiresCamera: false,
            applicantType: 'coapplicant',
            coApplicantId: coApp.id,
            required: false,
            requiresFrontBack: false,
        });
    });

    documents.push({
        value: 'collateral_legal',
        label: 'Sale Deed',
        fileTypes: ['pdf'],
        requiresCamera: false,
        applicantType: 'collateral',
        required: true,
        requiresFrontBack: false,
    });

    documents.push({
        value: 'PropertyPhotos',
        label: 'Property Photos',
        fileTypes: ['image'],
        requiresCamera: true,
        applicantType: 'collateral',
        required: true,
        requiresFrontBack: false,
        isPropertyPhotos: true,
    });

    return documents;
};

// Helper function to categorize uploaded files
const categorizeUploadedFiles = (files: UploadedFile[], availableDocuments: any[], coApplicants: any[]) => {
    const applicantDocs: UploadedFile[] = [];
    const coApplicantDocsMap: { [key: string]: UploadedFile[] } = {};
    const collateralDocs: UploadedFile[] = [];
    const propertyPhotoDocs: UploadedFile[] = [];

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
                if (docInfo.value === 'PropertyPhotos') {
                    propertyPhotoDocs.push(file);
                } else {
                    collateralDocs.push(file);
                }
            }
        }
    });

    return { applicantDocs, coApplicantDocsMap, collateralDocs, propertyPhotoDocs };
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

function Step8Content() {
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
    const [selectedPropertyPhotoType, setSelectedPropertyPhotoType] = useState<PropertyPhotoType | ''>('');
    const [isUploadingPropertyPhoto, setIsUploadingPropertyPhoto] = useState(false);
    const [pendingPropertyPhoto, setPendingPropertyPhoto] = useState<{ dataUrl: string; photoType: PropertyPhotoType } | null>(null);
    const [manualLocation, setManualLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [isRequestingLocation, setIsRequestingLocation] = useState(false);
    const [showPropertyGallery, setShowPropertyGallery] = useState(false);

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
    const [bankStatementPassword, setBankStatementPassword] = useState('');

    // Geolocation for co-applicant document uploads
    const geolocation = useGeolocation({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
    });

    const resolvedLatitude = typeof manualLocation?.latitude === 'number'
        ? manualLocation.latitude
        : (typeof geolocation.latitude === 'number' ? geolocation.latitude : null);

    const resolvedLongitude = typeof manualLocation?.longitude === 'number'
        ? manualLocation.longitude
        : (typeof geolocation.longitude === 'number' ? geolocation.longitude : null);

    const locationCoords = useMemo(() => {
        if (typeof resolvedLatitude === 'number' && typeof resolvedLongitude === 'number') {
            return {
                latitude: resolvedLatitude.toFixed(6),
                longitude: resolvedLongitude.toFixed(6)
            };
        }
        return null;
    }, [resolvedLatitude, resolvedLongitude]);

    const isLocationReady = Boolean(locationCoords);
    const locationErrorMessage =
        typeof geolocation.error === 'string'
            ? geolocation.error
            : geolocation.error?.message || '';

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

    const searchParams = useSearchParams();
    const preselect = searchParams.get('preselect');

    useEffect(() => {
        if (preselect && entityOptions.length > 0) {
            // Default to applicant entity for preselection
            setSelectedEntity('applicant');
            if (preselect === 'pan') {
                setDocumentType('PAN');
            } else if (preselect === 'aadhaar') {
                setDocumentType('Adhaar');
            }
        }
    }, [preselect, entityOptions]);

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

    useEffect(() => {
        if (documentType !== 'PropertyPhotos') {
            setSelectedPropertyPhotoType('');
        }
    }, [documentType]);

    const selectedDocument = useMemo(
        () => filteredDocuments.find(doc => doc.value === documentType),
        [filteredDocuments, documentType]
    );

    const propertyPhotoFiles = useMemo(() => {
        const map: Partial<Record<PropertyPhotoType, UploadedFile>> = {};
        uploadedFiles.forEach(file => {
            if (file.type === 'PropertyPhotos' && file.subType) {
                map[file.subType as PropertyPhotoType] = file;
            }
        });
        return map;
    }, [uploadedFiles]);

    const propertyPhotoSuccessCount = useMemo(() => {
        return PROPERTY_PHOTO_OPTIONS.filter(
            option => propertyPhotoFiles[option.value]?.status === 'Success'
        ).length;
    }, [propertyPhotoFiles]);

    const capturedPropertyPhotos = useMemo(() => {
        return PROPERTY_PHOTO_OPTIONS.filter(option => propertyPhotoFiles[option.value]);
    }, [propertyPhotoFiles]);

    const allPropertyPhotosComplete = propertyPhotoSuccessCount === PROPERTY_PHOTO_REQUIRED_COUNT;

    useEffect(() => {
        if (documentType === 'PropertyPhotos' && !selectedPropertyPhotoType) {
            const nextPending = PROPERTY_PHOTO_OPTIONS.find(
                option => propertyPhotoFiles[option.value]?.status !== 'Success'
            );
            if (nextPending) {
                setSelectedPropertyPhotoType(nextPending.value);
            }
        }
    }, [documentType, propertyPhotoFiles, selectedPropertyPhotoType]);

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
    const mapDocumentTypeToBackend = (docType: string): string => {
        // Check if it's a property photo type first (before parsing) - return it as-is
        if (docType.startsWith('collateral_images_')) {
            return docType;
        }

        const { baseValue } = parseDocumentValue(docType);
        const mapping: Record<string, string> = {
            'PAN': 'pan_card',
            'Adhaar': 'aadhaar_card',
            'DrivingLicense': 'driving_license',
            'Passport': 'passport',
            'VoterID': 'voter_id',
            'CollateralPapers': 'collateral_documents',
            'collateral': 'collateral_legal',
            'BankStatement': 'bank_statement',
            'bank': 'bank_statement',
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
        backFile?: File,
        options?: { metadata?: Record<string, any> | string; documentLabel?: string }
    ) => {
        if (!currentLead?.appId) {
            toast({
                title: 'Error',
                description: 'Application ID not found. Please create a new lead first.',
                variant: 'destructive',
            });
            return { success: false };
        }
        if (!locationCoords) {
            toast({
                title: 'Location Required',
                description: 'Please allow location access to continue with document uploads.',
                variant: 'destructive',
            });
            return { success: false };
        }

        const docInfo = availableDocuments.find(doc => doc.value === documentType);
        const { baseValue: baseDocType, coApplicantId: documentCoApplicantId } = parseDocumentValue(documentType);
        const backendDocType = mapDocumentTypeToBackend(documentType);

        // Check if this is a co-applicant PAN/Aadhaar document
        const isCoApplicantPanOrAadhaar =
            docInfo?.applicantType === 'coapplicant' &&
            docInfo.coApplicantId &&
            (backendDocType === 'pan_card' || backendDocType === 'aadhaar_card');

        let uploadResponse;

        try {
            if (isCoApplicantPanOrAadhaar) {
                // Find the co-applicant to get workflowIndex
                const coApplicants = currentLead.formData?.coApplicants || [];
                const coApplicant = coApplicants.find((coApp: any) => coApp.id === docInfo.coApplicantId);

                if (!coApplicant || typeof coApplicant.workflowIndex !== 'number') {
                    toast({
                        title: 'Co-applicant Setup Error',
                        description: 'Unable to find co-applicant workflow index. Please try again.',
                        variant: 'destructive',
                    });
                    return { success: false };
                }

                // Use new co-applicant document upload API
                uploadResponse = await uploadCoApplicantDocument({
                    application_id: currentLead.appId,
                    co_applicant_index: coApplicant.workflowIndex,
                    document_type: backendDocType as 'pan_card' | 'aadhaar_card',
                    front_file: file,
                    back_file: backFile,
                    document_name: docInfo?.label || file.name,
                    latitude: locationCoords.latitude,
                    longitude: locationCoords.longitude,
                });
            } else {
                // Use existing document upload API for applicant and other documents
                const metadataObj: Record<string, any> = typeof options?.metadata === 'object' ? { ...options.metadata } : {};

                if (docInfo?.applicantType === 'coapplicant' && docInfo.coApplicantId) {
                    metadataObj.co_applicant_id = docInfo.coApplicantId;
                }
                if (docInfo?.applicantType === 'collateral') {
                    metadataObj.document_owner = 'collateral';
                }

                let finalMetadata: string | Record<string, any> = metadataObj;

                // Custom format for bank statement with password: {key:value} without quotes
                if (backendDocType === 'bank_statement' && metadataObj.password) {
                    const parts = Object.entries(metadataObj).map(([key, value]) => `${key}:${value}`);
                    finalMetadata = `{${parts.join(',')}}`;
                }

                uploadResponse = await uploadDocument({
                    application_id: currentLead.appId,
                    document_type: backendDocType,
                    front_file: file,
                    back_file: backFile,
                    document_name: options?.documentLabel || docInfo?.label || file.name,
                    metadata: finalMetadata,
                    latitude: locationCoords.latitude,
                    longitude: locationCoords.longitude,
                });
            }

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

                // Check if we should trigger Bureau Check
                // Conditions: PAN uploaded, Aadhaar uploaded, Address Details submitted
                const isAddressSubmitted = currentLead?.step3Completed;
                const existingFiles = currentLead?.formData?.step8?.files || [];
                const successFiles = existingFiles.filter((f: any) => f.status === 'Success');

                const hasPan = baseDocType === 'PAN' || successFiles.some((f: any) => f.type === 'PAN');
                const hasAadhaar = baseDocType === 'Adhaar' || successFiles.some((f: any) => f.type === 'Adhaar');

                if (hasPan && hasAadhaar && isAddressSubmitted) {
                    try {
                        await triggerBureauCheck({
                            application_id: currentLead.appId,
                            agency: 'CRIF'
                        });
                        console.log('Bureau check triggered');
                    } catch (err) {
                        console.error('Bureau check trigger failed', err);
                    }
                }

                // Wait a bit for backend to process the document
                await new Promise(resolve => setTimeout(resolve, 2000));

                const detailedResponse = await getDetailedInfo(currentLead.appId);

                if (!isApiError(detailedResponse)) {
                    const { baseData: rawData = {}, applicationDetails, workflowState } = unwrapDetailedInfoResponse(detailedResponse as ApiSuccess<any>);
                    const parsedData = rawData ?? {};
                    const resolvedWorkflowState = workflowState ?? parsedData?.workflow_state ?? {};
                    const primaryParticipant = findPrimaryParticipant(applicationDetails);
                    const summaryPersonalInfo = primaryParticipant?.personal_info ?? null;
                    const summaryAddresses = Array.isArray(primaryParticipant?.addresses) ? primaryParticipant.addresses : [];
                    const isCoApplicantDocument = docInfo?.applicantType === 'coapplicant' && Boolean(documentCoApplicantId);

                    const summaryPanNumberRaw = !isCoApplicantDocument && summaryPersonalInfo ? getFieldValue(summaryPersonalInfo.pan_number) : '';
                    const summaryDobRaw = !isCoApplicantDocument && summaryPersonalInfo ? getFieldValue(summaryPersonalInfo.date_of_birth) : '';
                    const summaryGenderNormalized = !isCoApplicantDocument && summaryPersonalInfo ? normalizeGenderValue(summaryPersonalInfo.gender) : '';
                    const summaryAddressCount = !isCoApplicantDocument ? summaryAddresses.length : 0;

                    if (baseDocType === 'PAN') {
                        let panNumber: string | null = summaryPanNumberRaw ? summaryPanNumberRaw.toUpperCase() : null;
                        let dateOfBirth: string | null = summaryDobRaw ? convertDDMMYYYYToISO(summaryDobRaw) : null;
                        const extractedFields = resolvedWorkflowState?.pan_ocr_data?.extracted_fields;

                        if (extractedFields) {
                            if (!panNumber && extractedFields.pan_number) {
                                const extractedPan = getFieldValue(extractedFields.pan_number);
                                if (extractedPan) {
                                    panNumber = extractedPan.toUpperCase();
                                }
                            }
                            if (!dateOfBirth && extractedFields.date_of_birth) {
                                const extractedDob = getFieldValue(extractedFields.date_of_birth);
                                if (extractedDob) {
                                    dateOfBirth = convertDDMMYYYYToISO(extractedDob);
                                }
                            }
                        }

                        if (panNumber || dateOfBirth) {
                            if (currentLead) {
                                if (isCoApplicantDocument && documentCoApplicantId && updateCoApplicant) {
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
                                                if (!Number.isNaN(birthDate.getTime())) {
                                                    calculatedAge = today.getFullYear() - birthDate.getFullYear();
                                                    const monthDiff = today.getMonth() - birthDate.getMonth();
                                                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                                                        calculatedAge--;
                                                    }
                                                }
                                            } catch (error) {
                                                console.error('Error calculating age:', error);
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
                                    const existingStep2 = currentLead.formData?.step2 || {};
                                    const resolvedPan = panNumber || existingStep2.pan || currentLead.panNumber || '';
                                    const resolvedDob = dateOfBirth || existingStep2.dob || currentLead.dob || '';
                                    let calculatedAge = existingStep2.age || currentLead.age || 0;

                                    if (resolvedDob) {
                                        try {
                                            const today = new Date();
                                            const birthDate = new Date(resolvedDob);
                                            if (!Number.isNaN(birthDate.getTime())) {
                                                calculatedAge = today.getFullYear() - birthDate.getFullYear();
                                                const monthDiff = today.getMonth() - birthDate.getMonth();
                                                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                                                    calculatedAge--;
                                                }
                                            }
                                        } catch (error) {
                                            console.error('Error calculating age:', error);
                                        }
                                    }

                                    const updatedStep2 = {
                                        ...existingStep2,
                                        hasPan: 'yes',
                                        pan: resolvedPan,
                                        dob: resolvedDob,
                                        age: calculatedAge,
                                        gender: existingStep2.gender ?? currentLead.gender ?? '',
                                        autoFilledViaPAN: true,
                                        autoPopulatedFromSummary: (summaryPanNumberRaw || summaryDobRaw ? true : existingStep2.autoPopulatedFromSummary) || false,
                                    };

                                    updateLead(currentLead.id, {
                                        panNumber: resolvedPan,
                                        dob: resolvedDob,
                                        age: calculatedAge,
                                        gender: updatedStep2.gender,
                                        formData: {
                                            ...currentLead.formData,
                                            step2: updatedStep2,
                                        },
                                    });

                                    toast({
                                        title: 'Auto-populated',
                                        description: summaryPanNumberRaw || summaryDobRaw
                                            ? 'PAN number and Date of Birth were auto-populated from the uploaded document.'
                                            : 'PAN document processed successfully and details have been populated.',
                                        className: 'bg-green-50 border-green-200',
                                    });
                                }
                            }
                        } else {
                            toast({
                                title: 'Upload Successful',
                                description: 'Document uploaded successfully. Waiting for data parsing...',
                                className: 'bg-green-50 border-green-200',
                            });
                        }
                    }

                    if (baseDocType === 'Adhaar') {
                        let genderValue: string | null = summaryGenderNormalized || null;
                        const extractedGenderRaw = getFieldValue(resolvedWorkflowState?.aadhaar_ocr_data?.extracted_fields?.gender);
                        const normalizedFallbackGender = normalizeGenderValue(extractedGenderRaw);
                        if (!genderValue && normalizedFallbackGender) {
                            genderValue = normalizedFallbackGender;
                        }

                        let addressCandidates: any[] = [];
                        let addressPopulatedFromSummary = false;
                        if (!isCoApplicantDocument && summaryAddressCount > 0) {
                            addressCandidates = summaryAddresses;
                            addressPopulatedFromSummary = true;
                        } else {
                            const fallbackAddress =
                                parsedData?.address_info?.parsed_aadhaar_data ??
                                parsedData?.address_info?.addresses?.[0] ??
                                resolvedWorkflowState?.aadhaar_extracted_address ??
                                null;
                            if (fallbackAddress) {
                                addressCandidates = [fallbackAddress];
                            }
                        }

                        const timestampBase = Date.now();
                        const mappedAddresses = addressCandidates.map((addr: any, index: number) => {
                            const addressLine1 = getFirstAvailable(addr, ['address_line_1', 'address_line_one', 'addressLine1'], '');
                            const addressLine2 = getFirstAvailable(addr, ['address_line_2', 'address_line_two', 'addressLine2'], '');
                            const landmark = getFirstAvailable(addr, ['landmark'], '');
                            const postalCode = getFirstAvailable(addr, ['pincode', 'postal_code', 'zip'], '');
                            const addressType = getFirstAvailable(addr, ['address_type', 'type'], 'residential') || 'residential';
                            const isPrimaryFromSource = Boolean(getFirstAvailable(addr, ['is_primary', 'primary'], index === 0));

                            return {
                                id: `${timestampBase}-${index}`,
                                addressType: String(addressType || 'residential'),
                                addressLine1: String(addressLine1 || ''),
                                addressLine2: String(addressLine2 || ''),
                                postalCode: String(postalCode || ''),
                                landmark: String(landmark || ''),
                                isPrimary: index === 0 ? true : isPrimaryFromSource,
                            };
                        }).filter((addr: any) => addr.addressLine1 || addr.postalCode || addr.landmark);

                        if (currentLead) {
                            if (isCoApplicantDocument && documentCoApplicantId && updateCoApplicant) {
                                if (mappedAddresses.length > 0) {
                                    const coApplicants = currentLead.formData?.coApplicants || [];
                                    const coApplicant = coApplicants.find((coApp: any) => coApp.id === documentCoApplicantId);
                                    if (coApplicant) {
                                        const existingAddresses = coApplicant.data?.step3?.addresses || [];
                                        const updatedAddresses = existingAddresses.length > 0
                                            ? existingAddresses.map((addr: any, index: number) => {
                                                const source = mappedAddresses[index] ?? (index === 0 ? mappedAddresses[0] : null);
                                                if (!source) return addr;
                                                return {
                                                    ...addr,
                                                    addressLine1: source.addressLine1 || addr.addressLine1 || '',
                                                    addressLine2: source.addressLine2 || addr.addressLine2 || '',
                                                    postalCode: source.postalCode || addr.postalCode || '',
                                                    landmark: source.landmark || addr.landmark || '',
                                                };
                                            })
                                            : mappedAddresses;

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
                                    toast({
                                        title: 'Upload Successful',
                                        description: 'Aadhaar document uploaded successfully. Parsing in progress...',
                                        className: 'bg-green-50 border-green-200',
                                    });
                                }
                            } else {
                                const existingStep2 = currentLead.formData?.step2 || {};
                                const existingStep3 = currentLead.formData?.step3 || {};
                                let updatedAddresses = existingStep3.addresses ? [...existingStep3.addresses] : [];

                                if (mappedAddresses.length > 0) {
                                    if (updatedAddresses.length > 0) {
                                        updatedAddresses = updatedAddresses.map((addr: any, index: number) => {
                                            const source = mappedAddresses[index] ?? (index === 0 ? mappedAddresses[0] : null);
                                            if (!source) return addr;
                                            return {
                                                ...addr,
                                                addressType: source.addressType || addr.addressType || 'residential',
                                                addressLine1: source.addressLine1 || addr.addressLine1 || '',
                                                addressLine2: source.addressLine2 || addr.addressLine2 || '',
                                                postalCode: source.postalCode || addr.postalCode || '',
                                                landmark: source.landmark || addr.landmark || '',
                                                isPrimary: index === 0 ? true : addr.isPrimary,
                                            };
                                        });
                                    } else {
                                        updatedAddresses = mappedAddresses.map((addr: any, index: number) => ({
                                            ...addr,
                                            isPrimary: index === 0 ? true : addr.isPrimary,
                                        }));
                                    }
                                }

                                const addressesWithFlags = updatedAddresses.map(addr => ({
                                    ...addr,
                                    autoFilledViaAadhaar: mappedAddresses.length > 0 ? true : addr.autoFilledViaAadhaar,
                                    autoPopulatedFromSummary: addressPopulatedFromSummary || addr.autoPopulatedFromSummary || false,
                                }));

                                const updatedStep3 = {
                                    ...existingStep3,
                                    addresses: addressesWithFlags,
                                    autoFilledViaAadhaar: mappedAddresses.length > 0 ? true : existingStep3.autoFilledViaAadhaar,
                                    autoPopulatedFromSummary: addressPopulatedFromSummary || existingStep3.autoPopulatedFromSummary || false,
                                };

                                const updatedStep2 = genderValue
                                    ? {
                                        ...existingStep2,
                                        gender: genderValue!,
                                        autoFilledViaAadhaar: true,
                                        autoPopulatedFromSummary: (summaryGenderNormalized ? true : existingStep2.autoPopulatedFromSummary) || false,
                                    }
                                    : existingStep2;

                                if (mappedAddresses.length > 0 || genderValue) {
                                    updateLead(currentLead.id, {
                                        gender: genderValue || existingStep2.gender || currentLead.gender || '',
                                        formData: {
                                            ...currentLead.formData,
                                            step2: updatedStep2,
                                            step3: updatedStep3,
                                        },
                                    });

                                    const messages: string[] = [];
                                    if (mappedAddresses.length > 0) {
                                        messages.push(
                                            addressPopulatedFromSummary
                                                ? 'Address details were auto-populated from the uploaded Aadhaar.'
                                                : 'Address details have been populated from Aadhaar data.'
                                        );
                                    }
                                    if (genderValue) {
                                        messages.push(
                                            summaryGenderNormalized
                                                ? 'Gender was auto-populated from the uploaded Aadhaar.'
                                                : 'Gender has been populated from Aadhaar data.'
                                        );
                                    }

                                    toast({
                                        title: 'Auto-populated',
                                        description: messages.join(' '),
                                        className: 'bg-green-50 border-green-200',
                                    });
                                } else {
                                    toast({
                                        title: 'Upload Successful',
                                        description: 'Aadhaar document uploaded successfully. Parsing in progress...',
                                        className: 'bg-green-50 border-green-200',
                                    });
                                }
                            }
                        }
                    }
                } else {
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

            // Prepare metadata
            const metadata: Record<string, any> = {};
            if (documentType === 'bank_statement' && bankStatementPassword) {
                metadata.password = bankStatementPassword;
            }

            // Upload document via API
            const uploadResult = await handleDocumentUpload(file, documentType, fileId, undefined, { metadata });

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
        if (documentType !== 'PropertyPhotos') {
            setDocumentType('');
        }
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

        if (!isLocationReady) {
            toast({
                title: 'Location Required',
                description: 'Allow location access before capturing documents.',
                variant: 'destructive',
            });
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
        if (doc?.value === 'PropertyPhotos' && !selectedPropertyPhotoType) {
            toast({
                title: 'Select Photo Type',
                description: 'Choose which property image you want to capture before opening the camera.',
                variant: 'destructive',
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

            if (selectedDocument.isPropertyPhotos) {
                if (!selectedPropertyPhotoType) {
                    toast({
                        title: 'Select Photo Type',
                        description: 'Choose which property image you want to capture before uploading.',
                        variant: 'destructive',
                    });
                    return;
                }
                // Store the cropped image for preview and manual upload
                setPendingPropertyPhoto({
                    dataUrl: dataUrl,
                    photoType: selectedPropertyPhotoType as PropertyPhotoType
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

            if (documentType !== 'PropertyPhotos') {
                setDocumentType('');
            }
        }
    };

    const uploadPropertyPhotoCapture = async (dataUrl: string, photoType: PropertyPhotoType) => {
        if (!selectedDocument || selectedDocument.value !== 'PropertyPhotos') {
            toast({
                title: 'Select Property Photos',
                description: 'Choose a property image type before capturing.',
                variant: 'destructive',
            });
            return;
        }

        const option = PROPERTY_PHOTO_OPTIONS.find(opt => opt.value === photoType);
        const displayLabel = option ? `Property Photos - ${option.label}` : selectedDocument.label || 'Property Photo';
        const ownerType = selectedDocument.applicantType;
        const ownerId = selectedDocument.coApplicantId;
        const fileId = Date.now().toString();
        const fileName = `property_${photoType}_${fileId}.jpg`;
        const fileSource = dataURLtoFile(dataUrl, fileName);

        setUploadedFiles(prev => {
            const filtered = prev.filter(file => !(file.type === 'PropertyPhotos' && file.subType === photoType));
            return [
                ...filtered,
                {
                    id: fileId,
                    name: fileName,
                    type: 'PropertyPhotos',
                    subType: photoType,
                    status: 'Processing',
                    previewUrl: dataUrl,
                    fileType: 'image',
                    ownerType,
                    ownerId,
                    label: displayLabel,
                },
            ];
        });

        setIsUploadingPropertyPhoto(true);
        toast({ title: 'Processing', description: `Uploading ${displayLabel}...` });

        // Use the specific property photo type as document type
        const uploadResult = await handleDocumentUpload(fileSource, photoType, fileId, undefined, {
            documentLabel: displayLabel,
        });

        const isSuccess = uploadResult?.success === true;

        setUploadedFiles(prev =>
            prev.map(file =>
                file.id === fileId
                    ? {
                        ...file,
                        status: isSuccess ? 'Success' : 'Failed',
                        error: isSuccess ? undefined : 'Upload failed - backend validation failed',
                    }
                    : file
            )
        );

        setIsUploadingPropertyPhoto(false);

        if (isSuccess) {
            toast({
                title: 'Success',
                description: `${option?.label ?? 'Property photo'} uploaded successfully.`,
                className: 'bg-green-50 border-green-200',
            });
            setSelectedPropertyPhotoType('');
            setPendingPropertyPhoto(null);
        } else {
            toast({
                title: 'Upload Failed',
                description: 'Failed to upload property photo. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handlePropertyPhotoDelete = (photoType: PropertyPhotoType) => {
        setUploadedFiles(prev => prev.filter(file => !(file.type === 'PropertyPhotos' && file.subType === photoType)));
        if (selectedDocument?.value === 'PropertyPhotos') {
            setSelectedPropertyPhotoType(photoType);
        }
        const label = PROPERTY_PHOTO_OPTIONS.find(opt => opt.value === photoType)?.label || 'Property photo';
        toast({
            title: 'Photo Removed',
            description: `${label} removed. Capture again if needed.`,
            className: 'bg-yellow-50 border-yellow-200',
        });
    };

    const handlePropertyPhotoReplace = (photoType: PropertyPhotoType) => {
        setUploadedFiles(prev => prev.filter(file => !(file.type === 'PropertyPhotos' && file.subType === photoType)));
        setSelectedPropertyPhotoType(photoType);
        toast({
            title: 'Capture New Photo',
            description: `Please capture the ${PROPERTY_PHOTO_OPTIONS.find(opt => opt.value === photoType)?.label || 'selected'} image again.`,
        });
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

    const requestLocationPermission = () => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            toast({
                title: 'Location Unavailable',
                description: 'Geolocation is not supported in this browser.',
                variant: 'destructive',
            });
            return;
        }

        setIsRequestingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setManualLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                setIsRequestingLocation(false);
            },
            (error) => {
                setIsRequestingLocation(false);
                toast({
                    title: 'Location Required',
                    description: error.message || 'Please allow location access from browser settings.',
                    variant: 'destructive',
                });
            },
            { enableHighAccuracy: true, timeout: 20000 }
        );
    };

    const getUploadedDocTypes = () => {
        const completed = new Set<string>();
        const successFiles = uploadedFiles.filter(file => file.status === 'Success');

        successFiles.forEach(file => {
            if (file.type !== 'PropertyPhotos') {
                completed.add(file.type);
            }
        });

        const propertyCompleteness = new Set<PropertyPhotoType>();
        successFiles.forEach(file => {
            if (file.type === 'PropertyPhotos' && file.subType) {
                propertyCompleteness.add(file.subType as PropertyPhotoType);
            }
        });

        if (propertyCompleteness.size === PROPERTY_PHOTO_REQUIRED_COUNT) {
            completed.add('PropertyPhotos');
        }

        return completed;
    };

    if (!isLocationReady) {
        return (
            <DashboardLayout title="Document Upload" showNotifications={false} showExitButton={true} onExit={handleExit}>
                <div className="max-w-md mx-auto py-24 px-6 text-center flex flex-col items-center gap-4">
                    <MapPin className="w-10 h-10 text-blue-600" />
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Location Access Required</h2>
                        <p className="text-sm text-gray-600">
                            Please allow location permission to continue with document uploads.
                        </p>
                        {locationErrorMessage && (
                            <p className="text-xs text-red-600 mt-2">{locationErrorMessage}</p>
                        )}
                    </div>
                    <Button onClick={requestLocationPermission} disabled={isRequestingLocation} className="min-w-[200px]">
                        {isRequestingLocation ? (
                            <>
                                <Loader className="w-4 h-4 mr-2 animate-spin" />
                                Requesting...
                            </>
                        ) : (
                            'Allow Location Access'
                        )}
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

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
                                    setBankStatementPassword(''); // Reset password when changing document type
                                    if (value !== 'PropertyPhotos') {
                                        setSelectedPropertyPhotoType('');
                                        setPendingPropertyPhoto(null);
                                    }
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

                            {documentType === 'bank_statement' && (
                                <div className="mt-4">
                                    <Label htmlFor="docPassword">Document Password (Optional)</Label>
                                    <div className="relative mt-1">
                                        <input
                                            type="text"
                                            id="docPassword"
                                            value={bankStatementPassword}
                                            onChange={(e) => setBankStatementPassword(e.target.value)}
                                            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            placeholder="Enter password if protected"
                                        />
                                    </div>
                                </div>
                            )}

                            {documentType && selectedDocument && (
                                <>
                                    {selectedDocument.isPropertyPhotos ? (
                                        <Card className="border-2 border-blue-200">
                                            <CardContent className="p-4 space-y-5">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-sm font-semibold text-gray-900">Property Photos</h3>
                                                            <span className="text-xs text-gray-600">
                                                                ({propertyPhotoSuccessCount}/{PROPERTY_PHOTO_REQUIRED_COUNT} uploaded)
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-500">Capture and upload all required views</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Select Photo Type</Label>
                                                    <Select
                                                        value={selectedPropertyPhotoType}
                                                        onValueChange={(value) => {
                                                            setSelectedPropertyPhotoType(value as PropertyPhotoType);
                                                            // Clear pending photo if switching to a different type
                                                            if (pendingPropertyPhoto && pendingPropertyPhoto.photoType !== value) {
                                                                setPendingPropertyPhoto(null);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-12">
                                                            <SelectValue placeholder="Choose property photo..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {PROPERTY_PHOTO_OPTIONS.map((option) => {
                                                                const uploaded = propertyPhotoFiles[option.value];
                                                                const isComplete = uploaded?.status === 'Success';
                                                                return (
                                                                    <SelectItem
                                                                        key={option.value}
                                                                        value={option.value}
                                                                        disabled={isComplete}
                                                                    >
                                                                        <div className="flex items-center justify-between w-full">
                                                                            <span>{option.label}</span>
                                                                            {isComplete && <CheckCircle className="w-4 h-4 text-green-600" />}
                                                                        </div>
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {selectedPropertyPhotoType && (
                                                    (() => {
                                                        const currentType = selectedPropertyPhotoType as PropertyPhotoType;
                                                        const activeOption = PROPERTY_PHOTO_OPTIONS.find(opt => opt.value === currentType);
                                                        const existingFile = propertyPhotoFiles[currentType];
                                                        const hasPendingForThisType = pendingPropertyPhoto?.photoType === currentType;

                                                        return (
                                                            <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-gray-800 mb-1">{activeOption?.label}</h4>
                                                                        <p className="text-xs text-gray-600">
                                                                            Capture, crop, and upload your image.
                                                                        </p>
                                                                    </div>
                                                                    {existingFile?.status === 'Success' && (
                                                                        <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                                                                            <CheckCircle className="w-4 h-4" />
                                                                            Uploaded
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {existingFile?.status === 'Success' ? (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {existingFile.previewUrl && (
                                                                            <Button
                                                                                variant="secondary"
                                                                                className="flex items-center gap-2"
                                                                                onClick={() => {
                                                                                    setPreviewFile(existingFile);
                                                                                    setShowPreview(true);
                                                                                }}
                                                                            >
                                                                                <Eye className="w-4 h-4" />
                                                                                Preview
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                ) : hasPendingForThisType ? (
                                                                    <div className="space-y-3">
                                                                        <div className="border rounded-lg overflow-hidden">
                                                                            <img
                                                                                src={pendingPropertyPhoto.dataUrl}
                                                                                alt="Cropped preview"
                                                                                className="w-full h-48 object-cover"
                                                                            />
                                                                        </div>
                                                                        <Button
                                                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                                                            onClick={() => {
                                                                                if (pendingPropertyPhoto) {
                                                                                    uploadPropertyPhotoCapture(pendingPropertyPhoto.dataUrl, pendingPropertyPhoto.photoType);
                                                                                }
                                                                            }}
                                                                            disabled={isUploadingPropertyPhoto}
                                                                        >
                                                                            {isUploadingPropertyPhoto ? (
                                                                                <>
                                                                                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                                                                                    Uploading...
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <Upload className="w-4 h-4 mr-2" />
                                                                                    Upload Photo
                                                                                </>
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-wrap items-center gap-3">
                                                                        <Button
                                                                            onClick={startCamera}
                                                                            variant="outline"
                                                                            className="flex items-center gap-2 border-2 border-blue-300 hover:bg-blue-50"
                                                                            disabled={isUploadingPropertyPhoto}
                                                                        >
                                                                            {isUploadingPropertyPhoto ? (
                                                                                <>
                                                                                    <Loader className="w-4 h-4 animate-spin" />
                                                                                    Processing...
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <Camera className="w-4 h-4 text-blue-600" />
                                                                                    Capture from Camera
                                                                                </>
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()
                                                )}

                                                {capturedPropertyPhotos.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-semibold text-gray-800">Captured Photos</h4>
                                                        <div className="space-y-2">
                                                            {capturedPropertyPhotos.map(option => {
                                                                const file = propertyPhotoFiles[option.value];
                                                                const statusLabel = file?.status === 'Success'
                                                                    ? 'Uploaded'
                                                                    : file?.status === 'Processing'
                                                                        ? 'Processing...'
                                                                        : 'Failed';
                                                                return (
                                                                    <div key={option.value} className="border rounded-lg p-3 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                                        <div>
                                                                            <p className="text-sm font-medium text-gray-900">{option.label}</p>
                                                                            <p className="text-xs text-gray-500">{statusLabel}</p>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {file?.previewUrl && file.status === 'Success' && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    className="flex items-center gap-1"
                                                                                    onClick={() => {
                                                                                        setPreviewFile(file);
                                                                                        setShowPreview(true);
                                                                                    }}
                                                                                >
                                                                                    <Eye className="w-4 h-4" />
                                                                                    Preview
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ) : selectedDocument.requiresFrontBack ? (
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
                                        const { applicantDocs, coApplicantDocsMap, collateralDocs, propertyPhotoDocs } = categorizeUploadedFiles(uploadedFiles, availableDocuments, coApplicants);
                                        const shouldShowPropertyGalleryCard = allPropertyPhotosComplete && propertyPhotoDocs.length > 0;
                                        const hasCollateralSection = collateralDocs.length > 0 || shouldShowPropertyGalleryCard;

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
                                                {hasCollateralSection && (
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
                                                                    {shouldShowPropertyGalleryCard && (
                                                                        <Card className="border border-purple-100 bg-purple-50/50">
                                                                            <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                                                <div>
                                                                                    <p className="text-sm font-semibold text-gray-900">Property Images</p>
                                                                                    <p className="text-xs text-gray-600">{PROPERTY_PHOTO_REQUIRED_COUNT} photos uploaded</p>
                                                                                </div>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={() => setShowPropertyGallery(true)}
                                                                                >
                                                                                    Preview
                                                                                </Button>
                                                                            </CardContent>
                                                                        </Card>
                                                                    )}
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

            </div >

            {/* Preview Modal */}
            < Dialog open={showPreview} onOpenChange={setShowPreview} >
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
            </Dialog >
            <Dialog open={showPropertyGallery} onOpenChange={setShowPropertyGallery}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Property Images</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {PROPERTY_PHOTO_OPTIONS.map(option => {
                            const file = propertyPhotoFiles[option.value];
                            return (
                                <div key={option.value} className="space-y-2">
                                    <p className="text-sm font-medium text-gray-900">{option.label}</p>
                                    {file?.previewUrl ? (
                                        <img
                                            src={file.previewUrl}
                                            alt={file.label}
                                            className="w-full h-48 object-cover rounded-lg border"
                                        />
                                    ) : (
                                        <div className="border rounded-lg p-4 text-center text-xs text-gray-500">
                                            Not available
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout >
    );
}

export default function Step8Page() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader className="w-8 h-8 animate-spin text-blue-600" /></div>}>
            <Step8Content />
        </Suspense>
    );
}
