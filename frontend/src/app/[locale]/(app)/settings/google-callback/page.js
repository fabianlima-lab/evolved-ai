'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';

/**
 * Google OAuth Callback Page
 *
 * Google redirects here after the user grants consent.
 * This page reads the authorization code from the URL,
 * sends it to the backend to exchange for tokens,
 * then redirects back to wherever the user came from.
 *
 * URL: /settings/google-callback?code=XXX&state=YYY
 *
 * Supports returnTo via sessionStorage:
 *   - 'onboarding' → redirects to /onboarding?google=connected
 *   - default → redirects to /settings
 */
export default function GoogleCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    // Determine where to redirect after completion
    const returnTo = sessionStorage.getItem('eai_google_return') || 'settings';
    sessionStorage.removeItem('eai_google_return');

    const getRedirectPath = (success) => {
      if (returnTo === 'onboarding') {
        return `/onboarding?google=${success ? 'connected' : 'error'}`;
      }
      return '/settings';
    };

    if (errorParam) {
      setStatus('error');
      setError(errorParam === 'access_denied'
        ? 'You cancelled the Google connection. Redirecting...'
        : `Google returned an error: ${errorParam}`);
      setTimeout(() => router.replace(getRedirectPath(false)), 3000);
      return;
    }

    if (!code) {
      setStatus('error');
      setError('No authorization code received. Redirecting...');
      setTimeout(() => router.replace(getRedirectPath(false)), 3000);
      return;
    }

    // Exchange the code for tokens via the backend
    apiPost('/auth/google/callback', { code })
      .then(() => {
        setStatus('success');
        // Short delay so user sees success before redirect
        setTimeout(() => router.replace(getRedirectPath(true)), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'Failed to connect Google. Please try again.');
        setTimeout(() => router.replace(getRedirectPath(false)), 3000);
      });
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        {status === 'connecting' && (
          <>
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-txt-muted">Connecting your Google account...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl">&#10003;</div>
            <p className="text-txt font-medium">Google connected!</p>
            <p className="text-txt-muted text-sm">Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl">&#9888;</div>
            <p className="text-txt font-medium">Connection Issue</p>
            <p className="text-txt-muted text-sm">{error}</p>
          </>
        )}
      </div>
    </div>
  );
}
