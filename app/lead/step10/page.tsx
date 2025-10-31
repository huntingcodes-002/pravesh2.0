'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Step10Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/404');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Page not found</p>
    </div>
  );
}