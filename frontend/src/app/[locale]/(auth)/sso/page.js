'use client';

import { useEffect, useState } from 'react';
import { useRouter, Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { resolveDestination } from '@/lib/google-auth';

// Landing page for Okta SSO (e.g. the VEG Okta tile). The backend callback
// redirects here with the session token in the URL fragment so it never
// appears in server logs: /sso#token=...  or  /sso#error=...
export default function SsoPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');

    if (!token) {
      setError(params.get('error') ? t('ssoFailed') : t('ssoMissingToken'));
      return;
    }

    // Clear the fragment so the token doesn't linger in the address bar / history
    window.history.replaceState(null, '', window.location.pathname);
    localStorage.setItem('eai_token', token);

    (async () => {
      const dest = await resolveDestination();
      router.push(dest);
    })();
  }, [router, t]);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ backgroundColor: 'var(--color-brand-cream)' }}
    >
      <div className="text-center max-w-md">
        <p
          className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] mb-3"
          style={{ color: 'var(--color-brand-teal)' }}
        >
          {t('ssoEyebrow')}
        </p>
        <h1
          className="font-[family-name:var(--font-display)] font-light text-[2rem] leading-[1.2] mb-4"
          style={{ color: 'var(--color-brand-deep-green)' }}
        >
          {error ? t('ssoErrorTitle') : t('ssoSigningIn')}
        </h1>
        {error ? (
          <>
            <p className="text-[0.9rem] mb-6" style={{ color: 'var(--color-brand-brown)' }}>
              {error}
            </p>
            <Link
              href="/login"
              className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] no-underline hover:underline"
              style={{ color: 'var(--color-brand-teal)' }}
            >
              {t('ssoBackToLogin')}
            </Link>
          </>
        ) : (
          <p className="text-[0.9rem]" style={{ color: 'var(--color-brand-brown)' }}>
            {t('ssoWait')}
          </p>
        )}
      </div>
    </div>
  );
}
