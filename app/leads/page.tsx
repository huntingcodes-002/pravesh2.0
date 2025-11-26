'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Plus, Eye, Phone, Edit, Calendar, RotateCcw, ChevronLeft, ChevronRight, Play, Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLead, Lead, LeadStatus } from '@/contexts/LeadContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import ApplicationPreview from '@/components/ApplicationPreview';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DatePicker } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useEmblaCarousel from 'embla-carousel-react';

interface FilterState {
  startDate: Date | undefined;
  endDate: Date | undefined;
  status: LeadStatus | 'All';
}

// Helper function to render badge variant based on status
const getStatusBadge = (status: LeadStatus) => {
  const statusMap = {
    'Draft': 'bg-gray-200 text-gray-700 hover:bg-gray-300',
    'Submitted': 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    'Approved': 'bg-green-100 text-green-700 hover:bg-green-200',
    'Disbursed': 'bg-teal-100 text-teal-700 hover:bg-teal-200',
    'Rejected': 'bg-red-100 text-red-700 hover:bg-red-200',
  };
  return (
    <Badge className={cn('text-xs font-semibold uppercase px-3 py-1', statusMap[status] || statusMap['Draft'])}>
      {status}
    </Badge>
  );
};

// Summary Card Component for Carousel
const SummaryCard = ({ title, count, color, bg }: { title: string, count: number, color: string, bg: string }) => (
  <div className="min-w-[150px] sm:min-w-[unset] basis-1/3 flex-shrink-0 flex-grow-0 p-1">
    <Card className={cn("transition-all h-full border-2", bg)}>
      <CardContent className="p-4 flex flex-col items-start space-y-1">
        <p className={cn("text-xl font-bold", color)}>{count}</p>
        <p className="text-xs text-gray-600">{title}</p>
      </CardContent>
    </Card>
  </div>
);


export default function LeadsDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    leads,
    setCurrentLead,
    createLead,
    loading: leadsLoading,
    error: leadsError,
    summaryStats,
    fetchLeadDetails,
  } = useLead();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [filters, setFilters] = useState<FilterState>({ startDate: undefined, endDate: undefined, status: 'All' });
  const [emblaRef, emblaApi] = useEmblaCarousel({ dragFree: true, skipSnaps: true, loop: false });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [isFetchingLead, setIsFetchingLead] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const maskMobileNumber = useCallback((mobile: string | undefined | null) => {
    if (!mobile) return 'N/A';
    const digitsOnly = mobile.replace(/\D/g, '');
    if (digitsOnly.length <= 4) return digitsOnly || 'N/A';
    const maskedSection = 'X'.repeat(digitsOnly.length - 4);
    return `${maskedSection}${digitsOnly.slice(-4)}`;
  }, []);

  // Embla Carousel Controls
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (emblaApi) {
      onSelect();
      emblaApi.on('reInit', onSelect);
      emblaApi.on('select', onSelect);
      return () => {
        emblaApi.off('select', onSelect);
      };
    }
  }, [emblaApi, onSelect]);

  // Auth Redirect Check
  useEffect(() => {
    if (!authLoading) {
      // Check if user is authenticated via sessionStorage (in case AuthContext hasn't loaded yet)
      if (typeof window !== 'undefined') {
        const storedAuth = sessionStorage.getItem('auth');
        const storedUser = sessionStorage.getItem('user');

        // If we have auth data in sessionStorage but user state is null, wait a bit for AuthContext to load
        if (storedAuth && storedUser && !user) {
          // Give AuthContext a moment to load from sessionStorage
          return;
        }
      }

      // Only redirect if we truly don't have a user and no auth data in sessionStorage
      if (!user && typeof window !== 'undefined') {
        const storedAuth = sessionStorage.getItem('auth');
        if (!storedAuth) {
          router.replace('/login');
        }
      }
    }
  }, [user, authLoading, router]);

  // Combined Filter and Search Logic
  const filteredLeads = leads.filter((lead) => {
    const searchMatch =
      (lead.appId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.customerMobile.includes(searchTerm);

    const statusMatch = filters.status === 'All' || lead.status === filters.status;

    const date = new Date(lead.createdAt);
    const startDateMatch = !filters.startDate || date >= filters.startDate;
    const endDateMatch = !filters.endDate || date <= filters.endDate;

    return searchMatch && statusMatch && startDateMatch && endDateMatch;
  });

  const handleStartLead = () => {
    createLead();
    router.push('/lead'); // Changed from '/lead/step1' to '/lead'
  };

  const handleAction = async (lead: Lead, action: 'view' | 'edit' | 'call') => {
    if (action === 'call') {
      setCurrentLead(lead);
      return;
    }

    if (isFetchingLead) {
      return;
    }

    setDetailError(null);
    setActiveLeadId(lead.id);
    setIsFetchingLead(true);

    try {
      const fullLead = await fetchLeadDetails(lead.appId || lead.id);

      if (!fullLead) {
        setDetailError('Unable to load application details.');
        return;
      }

      setCurrentLead(fullLead);

      if (action === 'view') {
        setPreviewLead(fullLead);
      }

      if (action === 'edit') {
        // 1. Check for Main Applicant Mobile Verification (from fresh API data)
        const isMainApplicantVerified = fullLead.formData?.step1?.isMobileVerified;

        if (!isMainApplicantVerified) {
          // If not verified, force OTP flow
          router.push('/lead/new-lead?openOtp=true');
          return;
        }

        // 2. Check for Co-Applicant Mobile Verification
        const coApplicants = fullLead.formData?.coApplicants || [];
        const unverifiedCoApplicant = coApplicants.find((coApp: any) => {
          const basic = coApp.data?.basicDetails ?? coApp.data?.step1;
          return !basic?.isMobileVerified;
        });

        if (unverifiedCoApplicant) {
          router.push(`/lead/co-applicant/new?coApplicantId=${unverifiedCoApplicant.id}&openOtp=true`);
          return;
        }

        // 3. Check Payment Status
        // We can check the payment status from the fullLead object if available
        // or default to new-lead-info which handles payment checks too.
        // However, for better UX, we can redirect directly if needed.
        // For now, let's stick to the standard flow:
        // If verified, go to new-lead-info (which will show payment card if needed)
        // OR if we want to enforce payment page first:

        // Let's check if we can determine payment status from fullLead
        // The fetchLeadDetails might not fully populate payment status if it's not in the standard response
        // But assuming new-lead-info handles it, we can just go there.

        router.push('/lead/new-lead-info');
      }
    } catch (err: any) {
      setDetailError(err?.message || 'Unable to load application details.');
    } finally {
      setIsFetchingLead(false);
      setActiveLeadId(null);
    }
  };

  const handleEditButtonLogic = (lead: Lead) => {
    const isFinalized = ['Submitted', 'Approved', 'Rejected', 'Disbursed'].includes(lead.status);
    const isDraft = lead.status === 'Draft';
    const buttonText = isDraft ? 'Continue' : 'Edit Lead';
    const buttonIcon = isDraft ? <Play className="w-4 h-4 mr-2" /> : <Edit className="w-4 h-4 mr-2" />;

    return { isFinalized, buttonText, buttonIcon };
  }


  const handleClearFilters = () => {
    setFilters({ startDate: undefined, endDate: undefined, status: 'All' });
  };

  // Summary Data for Carousel
  const totalLeads = summaryStats.total ?? leads.length;
  const leadsInDraft = summaryStats.draft ?? leads.filter(l => l.status === 'Draft').length;
  const leadsCompleted = summaryStats.completed ?? leads.filter(l => l.status === 'Submitted').length;
  const leadsSubmitted = leads.filter(l => l.status === 'Submitted').length;
  const leadsApproved = leads.filter(l => l.status === 'Approved').length;
  const leadsRejected = leads.filter(l => l.status === 'Rejected').length;
  const leadsDisbursed = leads.filter(l => l.status === 'Disbursed').length;

  const dashboardCards = [
    { title: 'Total Applications', count: totalLeads, color: 'text-blue-900', bg: 'bg-blue-100' },
    { title: 'Draft Applications', count: leadsInDraft, color: 'text-gray-700', bg: 'bg-gray-100' },
    { title: 'Completed Applications', count: leadsCompleted, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Submitted', count: leadsSubmitted, color: 'text-blue-500', bg: 'bg-blue-50/70' },
    { title: 'Approved', count: leadsApproved, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Rejected', count: leadsRejected, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Disbursed', count: leadsDisbursed, color: 'text-teal-600', bg: 'bg-teal-50' },
  ];

  if (authLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <DashboardLayout title="Lead Dashboard" showNotifications={false}>
      <Sheet open={previewLead !== null} onOpenChange={(open) => !open && setPreviewLead(null)}>
        {/* Preview Modal (Req 4) */}
        <SheetContent side="right" className="w-full sm:max-w-xl p-0">
          {previewLead && <ApplicationPreview lead={previewLead} onClose={() => setPreviewLead(null)} />}
        </SheetContent>
      </Sheet>

      <div className="space-y-6">
        {/* Summary Carousel (Req 1) */}
        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex -mx-1">
              {dashboardCards.map((item, index) => (
                <SummaryCard key={index} {...item} />
              ))}
            </div>
          </div>
          {/* Carousel Controls */}
          <Button
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canScrollPrev}
            variant="outline"
            size="icon"
            className="absolute top-1/2 left-0 transform -translate-y-1/2 h-8 w-8 z-10 bg-white/70 backdrop-blur-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canScrollNext}
            variant="outline"
            size="icon"
            className="absolute top-1/2 right-0 transform -translate-y-1/2 h-8 w-8 z-10 bg-white/70 backdrop-blur-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {leadsError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {leadsError}
          </div>
        )}

        {detailError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            {detailError}
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex items-center space-x-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by App ID, Name, or Mobile"
              className="pl-10 h-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Filter Button (Req 3) */}
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-12 w-12 shrink-0 p-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                <Filter className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 space-y-4">
              <h4 className="font-semibold text-lg border-b pb-2">Filter Leads</h4>

              {/* Status Filter */}
              <div>
                <Label htmlFor="statusFilter">Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value: string) => setFilters({ ...filters, status: value as LeadStatus | 'All' })}
                >
                  <SelectTrigger id="statusFilter" className="h-10">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    {['All', 'Draft', 'Submitted', 'Approved', 'Rejected', 'Disbursed'].map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div>
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal h-10",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.startDate ? format(filters.startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DatePicker
                      mode="single"
                      selected={filters.startDate}
                      onSelect={(date) => setFilters({ ...filters, startDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal h-10",
                        !filters.endDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.endDate ? format(filters.endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DatePicker
                      mode="single"
                      selected={filters.endDate}
                      onSelect={(date) => setFilters({ ...filters, endDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button onClick={handleClearFilters} variant="outline" className="w-full h-10 mt-2">
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Lead List */}
        <div className="space-y-4">
          {leadsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mb-3" />
              <p>Loading applications...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No leads found matching your filters.</p>
          ) : (
            filteredLeads.map((lead) => {
              const { isFinalized, buttonText, buttonIcon } = handleEditButtonLogic(lead);

              return (
                <Card key={lead.id} className="hover:shadow-lg transition-shadow border-2 border-gray-100 cursor-pointer">
                  <CardContent className="p-4">
                    <div
                      className="flex flex-col space-y-3"
                      onClick={() => void handleAction(lead, 'view')}
                    >

                      {/* Row 1: App ID & Status */}
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">
                              {lead.customerName || 'New Lead'}
                            </p>
                            {getStatusBadge(lead.status)}
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            {lead.appId || 'Pending Application ID'}
                          </p>
                        </div>

                        {/* Preview Button (Moved) */}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleAction(lead, 'view');
                          }}
                          variant="outline"
                          size="icon"
                          className="w-10 h-10 rounded-full text-blue-600 hover:bg-blue-50 border-blue-200 flex-shrink-0"
                          disabled={isFetchingLead && activeLeadId === lead.id}
                          title="Application Preview"
                        >
                          {isFetchingLead && activeLeadId === lead.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </Button>
                      </div>

                      {/* Row 2: Mobile & Timestamp */}
                      <div className='border-t border-dashed pt-3'>
                        <p className="text-sm text-gray-500 mb-2">
                          Mobile:{' '}
                          <span className='font-medium text-gray-800'>
                            {maskMobileNumber(lead.customerMobile)}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">
                          Updated: {format(new Date(lead.updatedAt), 'd MMM yyyy, hh:mm a')}
                        </p>
                      </div>

                      {/* Row 3: Action Buttons (Full Sized) */}
                      <div className="grid grid-cols-2 gap-3 pt-3">

                        {/* Call Customer Button */}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleAction(lead, 'call');
                          }}
                          className="h-12 bg-green-500 hover:bg-green-600 text-white font-semibold text-xs sm:text-sm"
                          title="Call Customer"
                        >
                          <Phone className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
                          <span className="truncate">Call Customer</span>
                        </Button>

                        {/* Continue / Edit Button */}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleAction(lead, 'edit');
                          }}
                          disabled={isFinalized || (isFetchingLead && activeLeadId === lead.id)}
                          className={cn(
                            "h-12 font-semibold text-xs sm:text-sm",
                            isFinalized ?
                              "bg-gray-300 text-gray-600 cursor-not-allowed" :
                              "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                          title={isFinalized ? `Application is ${lead.status}` : buttonText}
                        >
                          {isFetchingLead && activeLeadId === lead.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            buttonIcon
                          )}
                          <span className="truncate">{buttonText}</span>
                        </Button>

                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Floating Plus Button */}
        <Button
          onClick={handleStartLead}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-xl bg-blue-600 hover:bg-blue-700"
          title="Create New Lead"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </DashboardLayout>
  );
}
