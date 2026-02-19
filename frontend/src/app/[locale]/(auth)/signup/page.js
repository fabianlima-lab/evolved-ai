'use client';

import { useState, Suspense } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { GoogleLogin } from '@react-oauth/google';
import { apiPost } from '@/lib/api';
import { useGoogleAuth } from '@/lib/google-auth';

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/*  Google OAuth button with custom styling                           */
/* ------------------------------------------------------------------ */
function GoogleButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.6rem',
        padding: '0.75rem 1rem',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '2px',
        background: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontFamily: 'var(--font-body)',
        fontSize: '0.75rem',
        fontWeight: 500,
        color: 'var(--color-txt)',
        letterSpacing: '0.02em',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Google "G" SVG */}
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
      </svg>
      Continue with Google
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main signup split-layout                                          */
/* ------------------------------------------------------------------ */
function SignupContent() {
  const t = useTranslations('Auth');
  const tCommon = useTranslations('Common');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const { handleCredentialResponse, loading: googleLoading, error: googleError } = useGoogleAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/auth/signup', {
        firstName,
        lastName,
        email,
        password,
      });
      localStorage.setItem('eai_token', data.token);
      if (plan === 'pro' || plan === 'pro_tribe') {
        localStorage.setItem('eai_selected_plan', plan);
      }
      router.push('/onboarding');
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? t('networkError')
          : err.message || t('signupFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || googleError;
  const isSubmitting = loading || googleLoading;

  /* ---- inline style objects ---- */

  const labelStyle = {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: 'var(--color-brand-brown)',
    marginBottom: '0.35rem',
    fontFamily: 'var(--font-body)',
  };

  const inputStyle = {
    width: '100%',
    padding: '14px',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '2px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--color-txt)',
    background: '#fff',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  };

  const inputFocusHandler = (e) => {
    e.target.style.borderColor = 'var(--color-brand-teal)';
    e.target.style.boxShadow = '0 0 0 2px rgba(139,196,198,0.25)';
  };

  const inputBlurHandler = (e) => {
    e.target.style.borderColor = 'rgba(0,0,0,0.08)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ============================== */}
      {/*  LEFT — Visual / Brand Panel   */}
      {/* ============================== */}
      <div
        className="hidden md:flex"
        style={{
          width: '50%',
          flexShrink: 0,
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '3.5rem 3.5rem 3rem',
          background: 'var(--color-brand-deep-green)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Radial gradient decoration — top-right */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-8rem',
            right: '-8rem',
            width: '28rem',
            height: '28rem',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,196,198,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Brand mark */}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--color-brand-cream)',
            letterSpacing: '0.02em',
            marginBottom: '2.5rem',
          }}
        >
          The Evolved Vets{' '}
          <span style={{ fontWeight: 300, fontStyle: 'italic', color: 'var(--color-brand-teal)' }}>
            AI
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem, 3vw, 2.8rem)',
            fontWeight: 300,
            lineHeight: 1.2,
            color: 'var(--color-brand-cream)',
            margin: '0 0 1.5rem',
          }}
        >
          Your personal chief of staff&nbsp;&mdash;{' '}
          <span style={{ fontStyle: 'italic', color: 'var(--color-brand-teal)' }}>
            built for your life
          </span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.92rem',
            lineHeight: 1.7,
            color: 'rgba(247,244,238,0.7)',
            maxWidth: '34rem',
            margin: '0 0 2.5rem',
          }}
        >
          You deserve more than survival mode. This AI assistant handles your
          calendar, inbox, tasks, wellness, and boundaries via WhatsApp.
        </p>

        {/* Testimonial */}
        <div
          style={{
            borderTop: '1px solid rgba(247,244,238,0.12)',
            paddingTop: '2rem',
            marginTop: 'auto',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.05rem',
              fontStyle: 'italic',
              lineHeight: 1.6,
              color: 'rgba(247,244,238,0.85)',
              margin: '0 0 1rem',
            }}
          >
            &ldquo;I finally feel like I have a handle on my week. It&rsquo;s like having
            an executive assistant who actually understands military life.&rdquo;
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'var(--color-brand-teal)',
              margin: 0,
            }}
          >
            &mdash; Former Army Officer, Beta User
          </p>
        </div>
      </div>

      {/* ============================== */}
      {/*  RIGHT — Sign-up Form          */}
      {/* ============================== */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2.5rem 1.5rem',
          background: 'var(--color-brand-cream)',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: '26rem' }}>
          {/* Eyebrow */}
          <p
            style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'var(--color-brand-teal)',
              margin: '0 0 0.5rem',
              fontFamily: 'var(--font-body)',
            }}
          >
            GET STARTED
          </p>

          {/* Heading */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              fontWeight: 400,
              color: 'var(--color-txt)',
              margin: '0 0 0.4rem',
              lineHeight: 1.2,
            }}
          >
            Create your{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--color-brand-teal)' }}>
              account
            </span>
          </h2>

          {/* Subtitle */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              color: 'var(--color-txt-muted)',
              margin: '0 0 1.75rem',
            }}
          >
            Start your 3-day free trial. Cancel anytime.
          </p>

          {/* Auth toggle tabs */}
          <div
            style={{
              display: 'flex',
              gap: '0.25rem',
              marginBottom: '1.75rem',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <Link
              href="/signup"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'var(--color-txt)',
                borderBottom: '2px solid var(--color-accent)',
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
                marginBottom: '-1px',
              }}
            >
              {tCommon('signUp')}
            </Link>
            <Link
              href="/login"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'var(--color-txt-muted)',
                borderBottom: '2px solid transparent',
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
                marginBottom: '-1px',
                transition: 'color 0.2s',
              }}
            >
              {tCommon('signIn')}
            </Link>
          </div>

          {/* Google OAuth */}
          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
            <div style={{ marginBottom: '1.25rem' }}>
              <GoogleLogin
                onSuccess={handleCredentialResponse}
                onError={() => setError(t('googleFailed'))}
                theme="outline"
                size="large"
                width="416"
                text="continue_with"
              />
            </div>
          ) : (
            <GoogleButton disabled />
          )}

          {/* "or" divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              margin: '1.25rem 0',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-txt-dim)',
                fontFamily: 'var(--font-body)',
                textTransform: 'lowercase',
              }}
            >
              {tCommon('or')}
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem' }}>
            {/* First + Last name row */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="firstName" style={labelStyle}>
                  {t('firstName') ?? 'First Name'}
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  required
                  style={inputStyle}
                  onFocus={inputFocusHandler}
                  onBlur={inputBlurHandler}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="lastName" style={labelStyle}>
                  {t('lastName') ?? 'Last Name'}
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  required
                  style={inputStyle}
                  onFocus={inputFocusHandler}
                  onBlur={inputBlurHandler}
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="email" style={labelStyle}>
                {t('email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                required
                style={inputStyle}
                onFocus={inputFocusHandler}
                onBlur={inputBlurHandler}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="password" style={labelStyle}>
                {t('password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordMinPlaceholder')}
                minLength={8}
                required
                style={inputStyle}
                onFocus={inputFocusHandler}
                onBlur={inputBlurHandler}
              />
            </div>

            {/* Error message */}
            {displayError && (
              <p
                style={{
                  color: 'var(--color-danger)',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {displayError}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.85rem 1.5rem',
                background: isSubmitting
                  ? 'var(--color-brand-deep-green-dark)'
                  : 'var(--color-brand-deep-green)',
                color: 'var(--color-brand-cream)',
                border: 'none',
                borderRadius: '0px',
                fontFamily: 'var(--font-body)',
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'background 0.2s, opacity 0.2s',
              }}
            >
              {isSubmitting ? '...' : t('createAccount')}
            </button>
          </form>

          {/* Footer text */}
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-txt-dim)',
                fontFamily: 'var(--font-body)',
                lineHeight: 1.6,
                margin: '0 0 0.4rem',
              }}
            >
              By signing up you agree to our{' '}
              <Link
                href="/terms"
                style={{
                  color: 'var(--color-accent)',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Terms
              </Link>{' '}
              &amp;{' '}
              <Link
                href="/privacy"
                style={{
                  color: 'var(--color-accent)',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Privacy Policy
              </Link>
            </p>
            <p
              style={{
                fontSize: '0.65rem',
                color: 'var(--color-txt-dim)',
                fontFamily: 'var(--font-body)',
                margin: 0,
              }}
            >
              Private, encrypted, and fully secured
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
