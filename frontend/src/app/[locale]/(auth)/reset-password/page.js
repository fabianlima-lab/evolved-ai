'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { apiPost } from '@/lib/api';

export default function ResetPasswordPage() {
  const t = useTranslations('Auth');
  const tCommon = useTranslations('Common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Auto-redirect to login after successful reset
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => router.push('/login'), 3000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  // No token in URL
  if (!token) {
    return (
      <Card className="w-full max-w-md p-8 text-center">
        <div className="text-4xl mb-4">🔗</div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-txt mb-2">{t('invalidResetLink')}</h2>
        <Link href="/forgot-password" className="text-accent text-sm hover:underline mt-4 inline-block">
          {t('requestNewLink')}
        </Link>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-md p-8 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-txt mb-2">{t('resetSuccess')}</h2>
        <p className="text-txt-muted text-sm">{t('resetSuccessDesc')}</p>
      </Card>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError(t('passwordsNoMatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('passwordMinLength') || 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await apiPost('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? t('networkError')
          : err.message || t('resetFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-8">
      <div className="text-center mb-8">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl text-txt font-semibold tracking-[0.02em] no-underline">
          The Evolved Vets <span className="font-light italic text-brand-teal">AI</span>
        </Link>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-txt mt-6">{t('resetTitle')}</h2>
        <p className="text-sm text-txt-muted mt-1">{t('resetSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('newPassword')}
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordMinPlaceholder')}
          required
        />
        <Input
          label={t('confirmPassword')}
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t('confirmPassword')}
          required
        />
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          {t('resetPassword')}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-txt-muted hover:text-txt">
          {t('backToLogin')}
        </Link>
      </div>
    </Card>
  );
}
