'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Step5Page() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to 404 or back to leads page
    router.replace('/leads');
  }, [router]);

  return null;
}