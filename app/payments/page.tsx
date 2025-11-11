'use client';

import { Card, CardContent } from '@/components/ui/card';
import DashboardLayout from '@/components/DashboardLayout';

export default function PaymentsPage() {
  return (
    <DashboardLayout
      title="Payments"
      showNotifications={false}
      showExitButton={true}
    >
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <Card className="max-w-md border border-gray-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Payments Coming
            </h1>
            <p className="text-sm text-gray-600">
              This page is under construction. Please check back soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

