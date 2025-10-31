'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

interface CreatePaymentLinkProps {
  onLinkCreate: (feeType: 'Login / IMD Fee' | 'Other Fee', amount: number, remarks: string) => void;
  prefillData?: { feeType: 'Login / IMD Fee' | 'Other Fee', amount: number, remarks: string } | null;
}

export default function CreatePaymentLink({ onLinkCreate, prefillData }: CreatePaymentLinkProps) {
  const router = useRouter();
  const feeType = 'Login / IMD Fee';
  const amount = 1180;
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (prefillData) {
      setRemarks(prefillData.remarks);
    }
  }, [prefillData]);


  const handleSubmit = () => {
    onLinkCreate(feeType, amount, remarks);
  };
  
  const handlePrevious = () => {
    router.push('/lead/step10');
  };
  
  const canSubmit = true;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Subtitle */}
        <p className="text-sm text-gray-600 text-center">
          Generate a secure link to collect the Login / IMD Fee from the customer.
        </p>

        {/* Payment Details Section */}
        <div className="space-y-6">
          <h3 className="text-base font-semibold text-gray-900">Payment Details</h3>
          
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Fee Type
            </Label>
            <div className="flex items-center px-4 h-12 bg-[#F3F4F6] border border-gray-300 rounded-lg">
              <span className="text-[#003366] font-medium">Login / IMD Fee</span>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Amount
            </Label>
            <div className="flex items-center px-4 h-12 bg-[#F3F4F6] border border-gray-300 rounded-lg">
              <span className="text-[#003366] font-medium">₹ 1,180 (incl. GST)</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Standard Login / IMD Fee including GST.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="remarks" className="text-sm font-medium text-gray-700">
                Remarks
              </Label>
              <span className="text-xs text-gray-500">Optional</span>
            </div>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional note for internal reference."
              maxLength={100}
              rows={3}
              className="rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{remarks.length}/100</p>
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <Button 
            onClick={handlePrevious} 
            variant="outline" 
            className="flex-1 h-12 rounded-lg"
          >
            Previous
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit} 
            className="flex-1 h-12 rounded-lg bg-[#0072CE] hover:bg-[#005a9e]"
          >
            Send to Customer
          </Button>
        </div>
      </div>
    </>
  );
}