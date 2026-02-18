'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { apiPost, apiFetch } from './api';

/**
 * Determines where to send a user after Google auth based on their progress:
 * - Onboarding not complete → /onboarding
 * - Everything done → /dashboard
 */
export async function resolveDestination() {
  try {
    const stats = await apiFetch('/dashboard/stats');

    // If onboarding is not complete, send them back
    if (stats.onboarding_step && stats.onboarding_step !== 'complete') {
      return '/onboarding';
    }

    // No agent deployed yet → onboarding
    if (stats.active_agents === 0) return '/onboarding';

    // Fully onboarded
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
