'use client';

import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useLead, CoApplicant } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader, UploadCloud, X, FileText, CheckCircle, AlertCircle, Image as ImageIcon, Camera, Upload, AlertTriangle } from 'lucide-react';
import { uploadDocument, uploadCoApplicantDocument, isApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ReactCrop, { Crop, PixelCrop, makeAspectCrop, centerCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

function CoApplicantAadhaarUploadContent() {
    const { currentLead, updateCoApplicant } = useLead();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const coApplicantId = searchParams.get('coApplicantId');

    const coApplicant: CoApplicant | undefined = useMemo(() => {
        if (!currentLead || !coApplicantId) return undefined;
        return currentLead.formData?.coApplicants?.find((ca: CoApplicant) => ca.id === coApplicantId);
    }, [currentLead, coApplicantId]);

    const [frontFile, setFrontFile] = useState<File | null>(null);
    const [backFile, setBackFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    // Camera and crop states
    const [uploadMode, setUploadMode] = useState<'front' | 'back' | null>(null);
    const [showUploadMethodModal, setShowUploadMethodModal] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [capturedImageSrc, setCapturedImageSrc] = useState<string>('');
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
    const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
    const [locationCoords, setLocationCoords] = useState<{ latitude: string; longitude: string } | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get location for upload
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocationCoords({
                        latitude: position.coords.latitude.toFixed(6),
                        longitude: position.coords.longitude.toFixed(6),
                    });
                },
                (error) => {
                    console.warn('Location access denied:', error);
                }
            );
        }
    }, []);

    useEffect(() => {
        if (!currentLead || !coApplicant) {
            router.replace('/lead/co-applicant-info');
        }
    }, [currentLead, coApplicant, router]);

    // Camera functions
    const startCamera = async () => {
        if (!locationCoords) {
            toast({
                title: 'Location Required',
                description: 'Allow location access before capturing documents.',
                variant: 'destructive',
            });
            return;
        }

        setCameraPermissionDenied(false);
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            setIsCameraOpen(true);
            setShowUploadMethodModal(false);
        } catch (err: any) {
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setCameraPermissionDenied(true);
            } else {
                toast({ title: 'Camera Error', description: 'Could not access the camera.', variant: 'destructive' });
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

    const captureImage = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context && videoRef.current) {
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setCapturedImageSrc(dataUrl);
                setShowCropModal(true);
                stopCamera();
            }
        }
    };

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const crop = makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            16 / 9,
            width,
            height
        );
        const centeredCrop = centerCrop(crop, width, height);
        setCrop(centeredCrop);
    };

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

    const handleCropComplete = async () => {
        if (!imageRef || !completedCrop) {
            toast({ title: 'Error', description: 'No crop selected', variant: 'destructive' });
            return;
        }

        const croppedImageUrl = await getCroppedImg(imageRef, completedCrop);
        const file = dataURLtoFile(croppedImageUrl, `aadhaar_${uploadMode}_${Date.now()}.jpg`);
        
        if (uploadMode === 'front') {
            setFrontFile(file);
        } else if (uploadMode === 'back') {
            setBackFile(file);
        }
        
        setShowCropModal(false);
        setCapturedImageSrc('');
        setCrop(undefined);
        setCompletedCrop(undefined);
    };

    useEffect(() => {
        if (isCameraOpen && stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [isCameraOpen, stream]);

    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    const handleUpload = async () => {
        if (!frontFile || !backFile || !currentLead?.appId || typeof coApplicant?.workflowIndex !== 'number') return;

        if (!locationCoords) {
            toast({
                title: "Location Required",
                description: "Please allow location access to upload documents.",
                variant: "destructive"
            });
            return;
        }

        setIsUploading(true);

        try {
            // Use the specific co-applicant upload function
            const response = await uploadCoApplicantDocument({
                application_id: currentLead.appId,
                co_applicant_index: coApplicant.workflowIndex,
                document_type: 'aadhaar_card',
                front_file: frontFile,
                back_file: backFile,
                latitude: locationCoords.latitude,
                longitude: locationCoords.longitude,
            });

            if (isApiError(response)) {
                throw new Error(response.error || 'Failed to upload document');
            }

            // Update local state
            updateCoApplicant(currentLead.id, coApplicantId!, {
                relationship: coApplicant.relationship,
                data: {
                    ...coApplicant.data,
                    step3: {
                        ...coApplicant.data?.step3,
                        autoFilledViaAadhaar: true // Mark as auto-filled/verified
                    }
                }
            });

            toast({
                title: 'Upload Successful',
                description: 'Aadhaar card uploaded and processed successfully.',
                className: 'bg-green-50 border-green-200',
            });

            // Redirect back to the info page
            router.push('/lead/co-applicant-info');

        } catch (error: any) {
            toast({
                title: 'Upload Failed',
                description: error.message || 'Something went wrong. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
    };

    if (!currentLead || !coApplicant) return null;

    return (
        <DashboardLayout
            title="Upload Aadhaar"
            showNotifications={false}
            showExitButton
            onExit={() => router.push('/lead/co-applicant-info')}
        >
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

            {/* Crop Modal */}
            {showCropModal && capturedImageSrc && (
                <Dialog open={showCropModal} onOpenChange={setShowCropModal}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Crop Image - {uploadMode === 'front' ? 'Front Side' : 'Back Side'}</DialogTitle>
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
            {cameraPermissionDenied && (
                <Dialog open={cameraPermissionDenied} onOpenChange={setCameraPermissionDenied}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center">
                                <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" /> Camera Access Required
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-gray-600">
                            Please allow camera access in your browser settings to capture documents directly from your device.
                        </p>
                        <div className="flex justify-end space-x-2 mt-4">
                            <Button variant="outline" onClick={() => setCameraPermissionDenied(false)}>Close</Button>
                            <Button onClick={() => { setCameraPermissionDenied(false); startCamera(); }}>
                                Try Again
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Upload Method Modal */}
            <Dialog open={showUploadMethodModal} onOpenChange={setShowUploadMethodModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Choose Upload Method - {uploadMode === 'front' ? 'Front Side' : 'Back Side'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        <Button
                            onClick={startCamera}
                            variant="outline"
                            className="w-full flex items-center justify-center h-20 space-y-1 border-2 border-blue-300 hover:bg-blue-50"
                        >
                            <Camera className="w-6 h-6 text-blue-600 mr-2" />
                            <span className="text-sm font-medium">Capture from Camera</span>
                        </Button>
                        <Button
                            onClick={() => {
                                if (uploadMode === 'front') {
                                    document.getElementById('aadhaar-front-input')?.click();
                                } else {
                                    document.getElementById('aadhaar-back-input')?.click();
                                }
                            }}
                            variant="outline"
                            className="w-full flex items-center justify-center h-20 space-y-1 border-2 border-blue-300 hover:bg-blue-50"
                        >
                            <Upload className="w-6 h-6 text-blue-600 mr-2" />
                            <span className="text-sm font-medium">Select from Files</span>
                        </Button>
                        <div className="text-xs text-gray-600 mt-2">
                            <p className="font-medium">Accepted file types:</p>
                            <p>PNG, JPG, JPEG, HEIC</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="max-w-2xl mx-auto p-4">
                <Card className="border-0 shadow-none bg-transparent">
                    <CardContent className="p-0 space-y-6">
                        {/* Upload Card */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900">Upload Aadhaar</h2>
                                </div>
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Required</Badge>
                            </div>

                            {/* Info Alert */}
                            <div className="bg-blue-50 rounded-lg p-3 flex gap-3 mb-6">
                                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-800 leading-relaxed">
                                    Please upload Aadhaar card for {coApplicant.data?.basicDetails?.fullName || 'Co-Applicant'} to auto-fill address details and verify identity.
                                </p>
                            </div>

                            <div className="space-y-6">
                                <h3 className="font-semibold text-gray-900">Aadhaar - {coApplicant.data?.basicDetails?.fullName || 'Co-Applicant'}</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Front Side */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-600 block">Front Side</label>
                                        <div
                                            onClick={() => {
                                                setUploadMode('front');
                                                setShowUploadMethodModal(true);
                                            }}
                                            className={cn(
                                                "aspect-[4/3] rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden",
                                                frontFile ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-blue-500 hover:bg-gray-50"
                                            )}
                                        >
                                            <input
                                                id="aadhaar-front-input"
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        setFrontFile(e.target.files[0]);
                                                        setShowUploadMethodModal(false);
                                                    }
                                                }}
                                            />
                                            {frontFile ? (
                                                <div className="w-full h-full relative">
                                                    <img
                                                        src={URL.createObjectURL(frontFile)}
                                                        alt="Front Preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                        <CheckCircle className="w-8 h-8 text-white" />
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="absolute bottom-2 right-2 bg-white/90 hover:bg-white"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setUploadMode('front');
                                                            setShowUploadMethodModal(true);
                                                        }}
                                                    >
                                                        Replace
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                                                    <span className="text-xs text-gray-500 font-medium">Upload Front</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Back Side */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-600 block">Back Side</label>
                                        <div
                                            onClick={() => {
                                                setUploadMode('back');
                                                setShowUploadMethodModal(true);
                                            }}
                                            className={cn(
                                                "aspect-[4/3] rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden",
                                                backFile ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-blue-500 hover:bg-gray-50"
                                            )}
                                        >
                                            <input
                                                id="aadhaar-back-input"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        setBackFile(e.target.files[0]);
                                                        setShowUploadMethodModal(false);
                                                    }
                                                }}
                                            />
                                            {backFile ? (
                                                <div className="w-full h-full relative">
                                                    <img
                                                        src={URL.createObjectURL(backFile)}
                                                        alt="Back Preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                        <CheckCircle className="w-8 h-8 text-white" />
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="absolute bottom-2 right-2 bg-white/90 hover:bg-white"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setUploadMode('back');
                                                            setShowUploadMethodModal(true);
                                                        }}
                                                    >
                                                        Replace
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                                                    <span className="text-xs text-gray-500 font-medium">Upload Back</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-xl text-sm"
                                    disabled={!frontFile || !backFile || isUploading}
                                    onClick={handleUpload}
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        'Upload Aadhaar'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

export default function CoApplicantAadhaarUploadPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
            <CoApplicantAadhaarUploadContent />
        </Suspense>
    );
}
