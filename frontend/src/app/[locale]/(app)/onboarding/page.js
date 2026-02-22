'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { apiPost, apiPatch, apiFetch } from '@/lib/api';

// ── Main Onboarding Page ──
// Onboarding is WhatsApp-first: the AI handles naming, learning about the user,
// and everything else via conversation. The web flow just connects WhatsApp.
export default function OnboardingPage() {
  const t = useTranslations('Onboarding');
  const router = useRouter();

  // WhatsApp state
  const [connectionCode, setConnectionCode] = useState(null);
  const [whatsappNumber, setWhatsappNumber] = useState(
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
  );
  const [connected, setConnected] = useState(false);
  const pollRef = useRef(null);

  // Track onboarding step on backend
  const updateStep = useCallback(async (stepName) => {
    try {
      await apiPatch('/subscribers/onboarding-step', { step: stepName });
    } catch {
      // Non-blocking
    }
  }, []);

  // Request WhatsApp connection code on mount
  useEffect(() => {
    updateStep('whatsapp_connect');

    (async () => {
      try {
        const data = await apiPost('/channels/connect/request', {
          channel: 'whatsapp',
        });
        setConnectionCode(data.code || data.connection_code);
        if (data.whatsapp_number) {
          setWhatsappNumber(data.whatsapp_number);
        }
      } catch {
        setConnectionCode(null);
      }
    })();
  }, [updateStep]);

  // Poll for WhatsApp connection
  useEffect(() => {
    if (connected) return;

    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch('/channels/status');
        if (data.whatsapp_connected) {
          setConnected(true);
          clearInterval(pollRef.current);
        }
      } catch {
        // Silently retry
      }
    }, 3000);

    return () => clearInterval(pollRef.current);
  }, [connected]);

  // After WhatsApp connect: deploy agent + redirect to dashboard
  const handleDone = async () => {
    try {
      await apiPost('/agents/deploy', {});
    } catch {
      // Non-blocking — agent may already exist
    }

    await updateStep('complete');
    router.push('/dashboard');
  };

  const waLink =
    whatsappNumber && connectionCode
      ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(connectionCode)}`
      : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '40px 24px',
        backgroundColor: 'var(--color-brand-cream)',
        animation: 'fadeSlideUp 0.4s ease-out',
      }}
    >
      {/* WhatsApp badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(37, 211, 102, 0.1)',
          padding: '8px 20px',
          borderRadius: '999px',
          marginBottom: '24px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        <span
          style={{
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#25D366',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
          }}
        >
          Get Started
        </span>
      </div>

      {/* Heading */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 400,
          color: 'var(--color-txt)',
          marginBottom: '12px',
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        Connect{' '}
        <em style={{ color: 'var(--color-brand-teal)', fontStyle: 'italic' }}>WhatsApp</em>
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: '15px',
          color: 'var(--color-txt-muted)',
          textAlign: 'center',
          maxWidth: '480px',
          lineHeight: 1.7,
          marginBottom: '36px',
          fontFamily: 'var(--font-body)',
        }}
      >
        Your assistant lives on WhatsApp. Send a quick message to connect
        — it takes 10 seconds. She&apos;ll take it from there.
      </p>

      {connected ? (
        /* Connected state */
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(37, 211, 102, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <span style={{ color: '#25D366', fontSize: '36px' }}>&#10003;</span>
          </div>
          <h3
            style={{
              fontSize: '20px',
              fontWeight: 500,
              color: 'var(--color-txt)',
              marginBottom: '8px',
              fontFamily: 'var(--font-display)',
            }}
          >
            WhatsApp connected!
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--color-txt-muted)', fontFamily: 'var(--font-body)' }}>
            Your assistant is ready to chat. She&apos;ll introduce herself and get to know you.
          </p>
        </div>
      ) : (
        <>
          {/* Connection card */}
          <div
            style={{
              backgroundColor: 'var(--color-brand-white)',
              borderRadius: '2px',
              borderTop: '2px solid #25D366',
              padding: '32px',
              maxWidth: '360px',
              width: '100%',
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            {connectionCode ? (
              <div style={{ textAlign: 'center' }}>
                {/* Primary CTA — Open WhatsApp button */}
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      backgroundColor: '#25D366',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0px',
                      padding: '16px 24px',
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: '24px',
                      textDecoration: 'none',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Open WhatsApp
                  </a>
                )}

                {/* Divider */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--color-txt-dim)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    or text this code
                  </span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
                </div>

                {/* Connection code display */}
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '32px',
                    fontWeight: 700,
                    letterSpacing: '0.3em',
                    color: 'var(--color-txt)',
                    marginBottom: '8px',
                  }}
                >
                  {connectionCode}
                </div>

                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-txt-muted)',
                    fontFamily: 'var(--font-body)',
                    lineHeight: 1.6,
                  }}
                >
                  Send this code to{' '}
                  <strong style={{ color: 'var(--color-txt)' }}>
                    {whatsappNumber || '(737) 330-3234'}
                  </strong>
                  {' '}on WhatsApp
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    border: '3px solid var(--color-border)',
                    borderTopColor: 'var(--color-brand-teal)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    margin: '0 auto 16px',
                  }}
                />
                <p style={{ fontSize: '13px', color: 'var(--color-txt-muted)', fontFamily: 'var(--font-body)' }}>
                  Generating connection code...
                </p>
              </div>
            )}
          </div>

          {/* Steps */}
          {connectionCode && (
            <div
              style={{
                display: 'flex',
                gap: '24px',
                justifyContent: 'center',
                maxWidth: '540px',
                width: '100%',
                marginBottom: '24px',
                flexWrap: 'wrap',
              }}
            >
              {[
                { num: 1, text: 'Tap "Open WhatsApp" above' },
                { num: 2, text: 'Send the pre-filled code' },
                { num: 3, text: 'You\'re connected!' },
              ].map((s) => (
                <div
                  key={s.num}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    flex: '1 1 140px',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(139, 196, 198, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--color-brand-teal)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {s.num}
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-txt-muted)',
                      textAlign: 'center',
                      lineHeight: 1.5,
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {s.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Waiting indicator */}
          {connectionCode && (
            <p
              style={{
                fontSize: '12px',
                color: 'var(--color-txt-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                fontFamily: 'var(--font-body)',
              }}
            >
              Waiting for connection
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: 'var(--color-brand-teal)',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'pulse-dot 1.5s ease-in-out infinite',
                }}
              />
            </p>
          )}
        </>
      )}

      {/* Continue to dashboard after connection */}
      {connected && (
        <button
          type="button"
          onClick={handleDone}
          style={{
            backgroundColor: 'var(--color-brand-deep-green)',
            color: 'var(--color-brand-cream)',
            border: 'none',
            borderRadius: '0px',
            padding: '16px 40px',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            cursor: 'pointer',
            width: '100%',
            maxWidth: '320px',
            marginTop: '24px',
            fontFamily: 'var(--font-body)',
          }}
        >
          Go to Dashboard
        </button>
      )}
    </div>
  );
}
