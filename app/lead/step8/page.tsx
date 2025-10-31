'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, CheckCircle, XCircle, Loader, Trash2, RotateCcw, Camera, AlertTriangle, User, Users, Home, ChevronDown, X, Image as ImageIcon } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead } from '@/contexts/LeadContext';
import { validateFile } from '@/lib/mock-auth';
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

// Helper function to generate dynamic document list
const generateDocumentList = (lead: any) => {
    const documents: any[] = [];
    
    // Main applicant documents - only PAN and Aadhaar
    const mainApplicantName = getApplicantName(lead?.customerFirstName, lead?.customerLastName);
    
    // Check if main applicant has PAN
    const mainApplicantHasPan = lead?.formData?.step2?.hasPan === 'yes';
    
    if (mainApplicantHasPan) {
        // Add PAN for main applicant (required)
        documents.push({
            value: "PAN",
            label: `PAN - ${mainApplicantName}`,
            fileTypes: ["image"],
            requiresCamera: true,
            applicantType: "main",
            required: true,
            requiresFrontBack: false
        });
    }
    
    // Add Aadhaar for main applicant (required)
    documents.push({
        value: "Adhaar",
        label: `Aadhaar - ${mainApplicantName}`,
        fileTypes: ["image"],
        requiresCamera: true,
        applicantType: "main",
        required: true,
        requiresFrontBack: true
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

export default function Step8Page() {
  const { currentLead, updateLead } = useLead();
  const router = useRouter();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [selectedEntity, setSelectedEntity] = useState('');
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
    const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({});
    
    // Preview state
    const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    const totalSteps = 10;
    
    // Generate dynamic document list based on current lead data
    const availableDocuments = currentLead ? generateDocumentList(currentLead) : [];
    
    // Generate entity options
    const getEntityOptions = (): EntityOption[] => {
        if (!currentLead) return [];
        
        const entities: EntityOption[] = [];
        
        // Main applicant
        const mainApplicantName = currentLead.customerName || 'Applicant';
        entities.push({
            value: 'applicant',
            label: `Applicant - ${mainApplicantName}`,
            type: 'main'
        });
        
        // Co-applicants
        const coApplicants = currentLead?.formData?.coApplicants || [];
        coApplicants.forEach((coApp: any, index: number) => {
            const coApplicantName = getApplicantName(coApp?.data?.step1?.firstName, coApp?.data?.step1?.lastName);
            entities.push({
                value: `coapplicant-${coApp.id}`,
                label: `Co-Applicant ${index + 1} - ${coApplicantName}`,
                type: 'coapplicant',
                coApplicantId: coApp.id
            });
        });
        
        // Collateral
        entities.push({
            value: 'collateral',
            label: 'Collateral',
            type: 'collateral'
        });
        
        return entities;
    };
    
    const entityOptions = getEntityOptions();
    const selectedEntityData = entityOptions.find(e => e.value === selectedEntity);
    
    // Filter documents based on selected entity
    const getFilteredDocuments = () => {
        if (!selectedEntity || !selectedEntityData) return [];
        
        if (selectedEntityData.type === 'main') {
            return availableDocuments.filter(doc => doc.applicantType === 'main');
        } else if (selectedEntityData.type === 'coapplicant') {
            return availableDocuments.filter(doc => 
                doc.applicantType === 'coapplicant' && 
                doc.coApplicantId === selectedEntityData.coApplicantId
            );
        } else if (selectedEntityData.type === 'collateral') {
            return availableDocuments.filter(doc => doc.applicantType === 'collateral');
        }
        
        return [];
    };
    
    const filteredDocuments = getFilteredDocuments();
    const selectedDocument = filteredDocuments.find(doc => doc.value === documentType);

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

    // Handle file selection (for non-front/back documents)
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        
        // Validate file type
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

        // Create preview URL for images
        const reader = new FileReader();
        reader.onloadend = () => {
            const previewUrl = reader.result as string;
            
            const newFile: UploadedFile = {
                id: fileId,
                name: file.name,
                type: documentType,
                status: 'Processing',
                previewUrl: isPdf ? undefined : previewUrl,
                fileType: isPdf ? 'pdf' : 'image'
            };

            setUploadedFiles((prev) => [...prev, newFile]);
            toast({ title: 'Processing', description: `Uploading ${file.name}...` });

            setTimeout(() => {
                const validation = validateFile(file.name);
                setUploadedFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId
                            ? { ...f, status: validation.valid ? 'Success' : 'Failed', error: validation.error }
                            : f
                    )
                );
                toast({
                    title: validation.valid ? 'Success' : 'Failed',
                    description: validation.valid ? `${file.name} uploaded successfully` : validation.error || 'File validation failed',
                    variant: validation.valid ? 'default' : 'destructive',
                    className: validation.valid ? 'bg-green-50 border-green-200' : ''
                });
            }, 1500);
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
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            setIsCameraOpen(true);
        } catch (err: any) {
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setCameraPermissionDenied(true);
            } else {
                toast({ title: 'Camera Error', description: 'Could not access the camera.', variant: 'destructive' });
            }
        }
    };

    useEffect(() => {
        if (isCameraOpen && stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [isCameraOpen, stream]);

    const captureImage = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
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
                    // For regular documents - fixed to include preview
                    const newFile: UploadedFile = {
                        id: fileId,
                        name: `capture_${fileId}.jpg`,
                        type: documentType,
                        status: 'Success',
                        previewUrl: dataUrl,
                        fileType: 'image'
                    };
                    setUploadedFiles((prev) => [...prev, newFile]);
                    toast({ title: 'Success', description: 'Image captured and uploaded successfully.', className: 'bg-green-50 border-green-200' });
                    setDocumentType('');
                }
            }
            stopCamera();
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

    const handleAddPropertyPhoto = () => {
        setSelectedEntity('collateral');
        setDocumentType('CollateralPhotos');
        // Trigger file input click
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 100);
    };

    // Handle front/back button click
    const handleFrontBackClick = (side: 'front' | 'back') => {
        setUploadMode(side);
        setShowUploadMethodModal(true);
    };

    // Handle upload document button click (for front/back documents)
    const handleUploadFrontBackDocument = () => {
        if (!frontFile || !backFile || !documentType) return;

        setIsUploading(true);
        setUploadError('');
        const fileId = Date.now().toString();

        const newFile: UploadedFile = {
            id: fileId,
            name: `${documentType}_combined`,
            type: documentType,
            status: 'Processing',
            frontName: frontFile.name,
            backName: backFile.name,
            frontPreviewUrl: frontFile.dataUrl,
            backPreviewUrl: backFile.dataUrl,
            fileType: 'image'
        };

        setUploadedFiles((prev) => [...prev, newFile]);
        toast({ title: 'Processing', description: 'Validating documents...' });

        setTimeout(() => {
            // Mock validation - validate both together
            const frontValidation = validateFile(frontFile.name);
            const backValidation = validateFile(backFile.name);
            
            const isValid = frontValidation.valid && backValidation.valid;
            const error = !frontValidation.valid ? frontValidation.error : backValidation.error;

            setUploadedFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId
                        ? { ...f, status: isValid ? 'Success' : 'Failed', error: error }
                        : f
                )
            );

            if (isValid) {
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
                setUploadError(error || 'Validation failed');
                toast({
                    title: 'Validation Failed',
                    description: error || 'Document validation failed',
                    variant: 'destructive'
                });
            }
            setIsUploading(false);
        }, 1500);
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
                        </div>
                    </div>
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
                            {selectedDocument?.fileTypes.length > 0 && (
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
                                <Label htmlFor="entitySelect">Select Applicant / Collateral</Label>
                                <Select 
                                    value={selectedEntity} 
                                    onValueChange={(value) => {
                                        // Close all sections first
                                        const newOpenSections: { [key: string]: boolean } = {};
                                        
                                        // Open the newly selected section
                                        if (value === 'applicant') {
                                            newOpenSections['applicant'] = true;
                                        } else if (value.startsWith('coapplicant-')) {
                                            newOpenSections[value] = true;
                                        } else if (value === 'collateral') {
                                            newOpenSections['collateral'] = true;
                                        }
                                        
                                        setOpenSections(newOpenSections);
                                        setSelectedEntity(value);
                                        setDocumentType('');
                                    }}
                                >
                                    <SelectTrigger id="entitySelect" className="h-12">
                                        <SelectValue placeholder="Choose applicant or collateral..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {entityOptions.map(entity => (
                                            <SelectItem key={entity.value} value={entity.value}>
                                                {entity.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {selectedEntity && (
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
                            )}

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
                                <p className="text-xs mb-2">1. Select applicant/co-applicant/collateral from the first dropdown</p>
                                <p className="text-xs mb-2">2. Select document type from the second dropdown</p>
                                <p className="text-xs">3. Upload file or capture photo</p>
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
                                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(file.id)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-100 flex-shrink-0">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
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
                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleAddPropertyPhoto();
                                                                            }}
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-8 px-3 text-xs border-purple-300 text-purple-600 hover:bg-purple-50"
                                                                        >
                                                                            <span className="mr-1">+</span> Property Photos
                                                                        </Button>
                                                                        <ChevronDown className={cn("w-5 h-5 text-gray-500 transition-transform", openSections['collateral'] && "rotate-180")} />
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent>
                                                            <CardContent className="px-4 pb-4 pt-0">
                                                                {collateralDocs.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        {collateralDocs.map(renderDocumentCard)}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-4 text-gray-500 text-sm">
                                                                        No collateral documents uploaded yet
                                                                    </div>
                                                                )}
                                                            </CardContent>
                                                        </CollapsibleContent>
                                                    </Card>
                                                </Collapsible>
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
