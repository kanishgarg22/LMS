'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, setAuth } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/attendance');
      return;
    }
    // Silent auto-login — user never sees a login screen
    const email    = process.env.NEXT_PUBLIC_APP_EMAIL    || 'admin@sharma.com';
    const password = process.env.NEXT_PUBLIC_APP_PASSWORD || 'admin123';
    authApi.login(email, password)
      .then(res => {
        const { token, user, company } = res.data.data;
        setAuth(token, user, company);
        router.replace('/attendance');
      })
      .catch(() => router.replace('/attendance'));
  }, [isAuthenticated, router, setAuth]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
