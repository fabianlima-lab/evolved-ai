'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { apiPost } from '@/lib/api';

export default function ForgotPasswordPage() {
  const t = useTranslations('Auth');
  const tCommon = useTranslations('Common');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiPost('/auth/forgot-password', { email });
      setSent(true);
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

  if (sent) {
    return (
      <Card className="w-full max-w-md p-8 text-center">
        <div className="text-4xl mb-4">📧</div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-txt mb-2">{t('resetSent')}</h2>
        <p className="text-txt-muted text-sm mb-6">{t('resetSentDesc')}</p>
        <Link
          href="/login"
          className="text-accent text-sm hover:underline"
        >
          {t('backToLogin')}
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-8">
      <div className="text-center mb-8">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl text-txt font-semibold tracking-[0.02em] no-underline">
          The Evolved Vets <span className="font-light italic text-brand-teal">AI</span>
        </Link>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-txt mt-6">{t('forgotTitle')}</h2>
        <p className="text-sm text-txt-muted mt-1">{t('forgotSubtitle')}</p>
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
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          {t('sendResetLink')}
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
