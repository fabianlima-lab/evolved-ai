'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { GoogleLogin } from '@react-oauth/google';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { apiPost } from '@/lib/api';
import { useGoogleAuth, resolveDestination } from '@/lib/google-auth';

export default function LoginPage() {
  const t = useTranslations('Auth');
  const tCommon = useTranslations('Common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { handleCredentialResponse, loading: googleLoading, error: googleError } = useGoogleAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/auth/login', { email, password });
      localStorage.setItem('eai_token', data.token);

      // Smart routing — pick up where the user left off
      const dest = await resolveDestination();
      router.push(dest);
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? t('networkError')
          : err.message || t('signInFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || googleError;

  return (
    <Card className="w-full max-w-md p-8">
      <div className="text-center mb-8">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl text-txt">
          {tCommon('brandName')}
        </Link>
        <div className="flex justify-center gap-1 mt-6">
          <Link href="/signup" className="px-4 py-2 text-sm font-medium text-txt-muted border-b-2 border-transparent hover:text-txt">
            {tCommon('signUp')}
          </Link>
          <Link href="/login" className="px-4 py-2 text-sm font-medium text-txt border-b-2 border-accent">
            {tCommon('signIn')}
          </Link>
        </div>
      </div>

      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleCredentialResponse}
            onError={() => setError(t('googleFailed'))}
            theme="outline"
            size="large"
            width="400"
            text="continue_with"
          />
        </div>
      ) : (
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-2 border border-border rounded-[var(--radius-btn)] py-3 text-sm text-txt-dim cursor-not-allowed opacity-50"
        >
          {t('continueGoogle')}
        </button>
      )}

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-txt-dim">{tCommon('or')}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('email')}
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          required
        />
        <div>
          <Input
            label={t('password')}
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            required
          />
          <div className="mt-1 text-right">
            <Link href="/forgot-password" className="text-xs text-accent hover:underline">
              {t('forgotPassword')}
            </Link>
          </div>
        </div>
        {displayError && <p className="text-danger text-sm">{displayError}</p>}
        <Button type="submit" loading={loading || googleLoading} className="w-full">
          {tCommon('signIn')}
        </Button>
      </form>
    </Card>
  );
}
