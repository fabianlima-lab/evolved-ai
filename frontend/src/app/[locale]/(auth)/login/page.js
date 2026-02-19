'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { GoogleLogin } from '@react-oauth/google';
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
    <div className="flex min-h-screen">
      {/* ───────── LEFT: Visual Panel ───────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 xl:p-16 relative overflow-hidden"
        style={{ backgroundColor: 'var(--color-brand-deep-green)' }}
      >
        {/* Radial gradient decorative element */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: '600px',
            height: '600px',
            bottom: '-200px',
            right: '-200px',
            background: 'radial-gradient(circle, rgba(139,196,198,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Top: Brand mark */}
        <div>
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-[1.35rem] font-semibold tracking-[0.02em] no-underline"
            style={{ color: 'var(--color-brand-cream)' }}
          >
            The Evolved Vets{' '}
            <span className="font-light italic" style={{ color: 'var(--color-brand-teal)' }}>
              AI
            </span>
          </Link>
        </div>

        {/* Center: Heading + subtitle */}
        <div className="flex-1 flex flex-col justify-center max-w-lg">
          <h1
            className="font-[family-name:var(--font-display)] font-light leading-[1.15] mb-6"
            style={{
              color: 'var(--color-brand-cream)',
              fontSize: 'clamp(2.4rem, 3.5vw, 3.6rem)',
            }}
          >
            Welcome{' '}
            <span className="italic" style={{ color: 'var(--color-brand-teal)' }}>
              back
            </span>
          </h1>
          <p
            className="text-[1rem] leading-relaxed max-w-sm"
            style={{ color: 'var(--color-brand-text-light)' }}
          >
            Your assistant has been keeping things running while you were away.
            From force to flow.
          </p>
        </div>

        {/* Bottom: Testimonial */}
        <div
          className="border-t pt-6"
          style={{ borderColor: 'rgba(247, 244, 238, 0.1)' }}
        >
          <p
            className="font-[family-name:var(--font-display)] italic text-[1.05rem] leading-relaxed mb-3"
            style={{ color: 'rgba(247, 244, 238, 0.7)' }}
          >
            &ldquo;I opened my phone to 3 things already handled. That feeling of
            relief is addictive.&rdquo;
          </p>
          <p
            className="text-[0.75rem] tracking-[0.08em] uppercase"
            style={{ color: 'rgba(247, 244, 238, 0.4)' }}
          >
            Dr. Maya L., Veterinary Surgeon
          </p>
        </div>
      </div>

      {/* ───────── RIGHT: Form Panel ───────── */}
      <div
        className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 sm:px-12"
        style={{ backgroundColor: 'var(--color-brand-cream)' }}
      >
        <div className="w-full max-w-md">
          {/* Eyebrow */}
          <p
            className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] mb-3"
            style={{ color: 'var(--color-brand-teal)' }}
          >
            WELCOME BACK
          </p>

          {/* Heading */}
          <h2
            className="font-[family-name:var(--font-display)] font-light text-[2.2rem] leading-[1.2] mb-2"
            style={{ color: 'var(--color-brand-deep-green)' }}
          >
            Sign{' '}
            <span className="italic" style={{ color: 'var(--color-brand-teal)' }}>
              in
            </span>
          </h2>

          {/* Subtitle */}
          <p
            className="text-[0.85rem] mb-8"
            style={{ color: 'var(--color-brand-brown)' }}
          >
            Your assistant is waiting for you.
          </p>

          {/* Auth toggle tabs */}
          <div
            className="flex gap-0 mb-8"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
          >
            <Link
              href="/signup"
              className="px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.2em] no-underline"
              style={{
                color: 'var(--color-brand-brown)',
                borderBottom: '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tCommon('signUp')}
            </Link>
            <Link
              href="/login"
              className="px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.2em] no-underline"
              style={{
                color: 'var(--color-brand-deep-green)',
                borderBottom: '2px solid var(--color-brand-teal)',
                marginBottom: '-1px',
              }}
            >
              {tCommon('signIn')}
            </Link>
          </div>

          {/* Google OAuth */}
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
              className="w-full flex items-center justify-center gap-2 py-3 text-sm cursor-not-allowed opacity-50"
              style={{
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '2px',
                color: 'var(--color-brand-brown)',
              }}
            >
              {t('continueGoogle')}
            </button>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(0,0,0,0.08)' }} />
            <span
              className="text-[0.7rem] uppercase tracking-[0.15em]"
              style={{ color: 'var(--color-brand-text-light)' }}
            >
              {tCommon('or')}
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(0,0,0,0.08)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block mb-2"
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: 'var(--color-brand-deep-green)',
                }}
              >
                {t('email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                required
                className="w-full outline-none transition-colors"
                style={{
                  padding: '14px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: '2px',
                  fontSize: '0.875rem',
                  backgroundColor: 'transparent',
                  color: 'var(--color-brand-deep-green)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand-teal)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(0,0,0,0.08)')}
              />
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block mb-2"
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: 'var(--color-brand-deep-green)',
                }}
              >
                {t('password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                required
                className="w-full outline-none transition-colors"
                style={{
                  padding: '14px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: '2px',
                  fontSize: '0.875rem',
                  backgroundColor: 'transparent',
                  color: 'var(--color-brand-deep-green)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand-teal)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(0,0,0,0.08)')}
              />
            </div>

            {/* Error message */}
            {displayError && (
              <p className="text-[0.8rem]" style={{ color: 'var(--color-brand-alert, #C94152)' }}>
                {displayError}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full transition-opacity disabled:opacity-60"
              style={{
                backgroundColor: 'var(--color-brand-deep-green)',
                color: 'var(--color-brand-cream)',
                borderRadius: '0px',
                border: 'none',
                padding: '14px 24px',
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                cursor: loading || googleLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading || googleLoading ? '...' : tCommon('signIn')}
            </button>
          </form>

          {/* Footer link */}
          <div className="mt-6 text-center">
            <Link
              href="/forgot-password"
              className="text-[0.75rem] no-underline hover:underline"
              style={{ color: 'var(--color-brand-brown)' }}
            >
              {t('forgotPassword')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
