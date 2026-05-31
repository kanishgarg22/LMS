'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    authApi.login('', '')
      .then(res => { setAuth(res.data.data.token, res.data.data.user, res.data.data.company); })
      .catch(() => {})
      .finally(() => router.replace('/attendance'));
  }, [router, setAuth]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
