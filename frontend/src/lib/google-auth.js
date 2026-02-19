'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { apiPost, apiFetch } from './api';

/**
 * Determines where to send a user after auth based on their progress:
 * - Onboarding never completed → /onboarding
 * - Onboarding complete (even if agent is down) → /dashboard
 */
export async function resolveDestination() {
  try {
    const stats = await apiFetch('/dashboard/stats');

    // Only send to onboarding if they've never completed it
    if (stats.onboarding_step && stats.onboarding_step !== 'complete') {
      return '/onboarding';
    }

    return '/dashboard';
  } catch {
    // If stats fail, safest default is onboarding
    return '/onboarding';
  }
}

export function useGoogleAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleCredentialResponse = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/auth/google', {
        credential: credentialResponse.credential,
      });
      localStorage.setItem('eai_token', data.token);

      if (data.is_new_subscriber) {
        // New Google signup — chain directly into OAuth consent for
        // Calendar/Gmail/Drive scopes so everything is connected before
        // the user even starts onboarding.
        try {
          const oauthData = await apiFetch('/auth/google/url');
          if (oauthData.url) {
            sessionStorage.setItem('eai_google_return', 'onboarding');
            window.location.href = oauthData.url;
            return; // Don't setLoading(false) — we're navigating away
          }
        } catch {
          // If scope request fails, still send to onboarding —
          // they can connect Google in step 3
        }
        router.push('/onboarding');
      } else {
        // Returning user — route to wherever they left off
        const dest = await resolveDestination();
        router.push(dest);
      }
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return { handleCredentialResponse, loading, error, setError };
}
