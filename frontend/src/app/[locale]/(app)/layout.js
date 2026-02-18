'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppNav } from '@/components/Nav';
import SupportButton from '@/components/SupportButton';

function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  // Hide nav on onboarding — show only after reaching dashboard
  const hideNav = pathname?.startsWith('/onboarding');

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem('eai_token');
    if (!token) {
      router.push('/login');
    } else {
      setChecked(true);
    }
  }, [loading, router]);

  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {!hideNav && <AppNav userEmail={user?.email} />}
      <div className={hideNav ? '' : 'pt-16'}>{children}</div>
    </>
  );
}

export default function AppLayout({ children }) {
  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
      <SupportButton />
    </AuthProvider>
  );
}
