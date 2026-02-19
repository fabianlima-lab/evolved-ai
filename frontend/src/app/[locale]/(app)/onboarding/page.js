'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { apiPost, apiFetch, apiPatch } from '@/lib/api';

const TOTAL_STEPS = 3;

const NAME_SUGGESTIONS = ['Nova', 'Sage', 'Aria', 'Luna', 'Iris', 'Wren', 'Cleo', 'Ember'];

const DRAIN_OPTIONS = [
  {
    id: 'schedule_chaos',
    label: 'Schedule chaos',
    description: 'Back-to-back shifts, no recovery time',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: 'admin_overload',
    label: 'Admin overload',
    description: 'Emails, forms, follow-ups piling up',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    id: 'decision_fatigue',
    label: 'Decision fatigue',
    description: 'Too many small choices draining you',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: 'mental_load',
    label: 'Mental load',
    description: 'Carrying everything in your head',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="17" x2="12" y2="22" />
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
      </svg>
    ),
  },
];

// ── Step Indicator: 3 bars ──
function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '32px' }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const isDone = i < current;
        const isActive = i === current;
        const isPending = i > current;
        return (
          <div
            key={i}
            style={{
              height: '3px',
              borderRadius: '2px',
              transition: 'all 0.4s ease',
              width: isActive ? '48px' : '24px',
              backgroundColor: isDone
                ? 'var(--color-brand-teal-dark)'
                : isActive
                  ? 'var(--color-brand-teal)'
                  : isPending
                    ? 'var(--color-border)'
                    : 'var(--color-border)',
            }}
          />
        );
      })}
    </div>
  );
}

// ── Step 1: Name Your Assistant (step 0) ──
function StepNameAssistant({ assistantName, setAssistantName, onNext }) {
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
      {/* Eyebrow */}
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: 'var(--color-brand-teal)',
          fontWeight: 600,
          marginBottom: '16px',
          fontFamily: 'var(--font-body)',
        }}
      >
        Step 1 of 3
      </p>

      {/* Decorative line */}
      <div
        style={{
          width: '60px',
          height: '1px',
          backgroundColor: 'var(--color-brand-teal)',
          marginBottom: '32px',
        }}
      />

      {/* Heading */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 400,
          color: 'var(--color-txt)',
          marginBottom: '16px',
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        Name your{' '}
        <em style={{ color: 'var(--color-brand-teal)', fontStyle: 'italic' }}>assistant</em>
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: '15px',
          color: 'var(--color-txt-muted)',
          textAlign: 'center',
          maxWidth: '480px',
          lineHeight: 1.7,
          marginBottom: '40px',
          fontFamily: 'var(--font-body)',
        }}
      >
        This is the beginning of a relationship. Give her a name that feels right
        — something you&apos;d trust to have your back.
      </p>

      {/* Large centered input */}
      <input
        type="text"
        value={assistantName}
        onChange={(e) => setAssistantName(e.target.value)}
        placeholder="e.g. Nova, Sage, Aria..."
        maxLength={50}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2rem',
          textAlign: 'center',
          border: 'none',
          borderBottom: '2px solid var(--color-border)',
          backgroundColor: 'transparent',
          color: 'var(--color-txt)',
          padding: '12px 16px',
          width: '100%',
          maxWidth: '400px',
          outline: 'none',
          transition: 'border-color 0.3s ease',
          marginBottom: '24px',
        }}
        onFocus={(e) => {
          e.target.style.borderBottomColor = 'var(--color-brand-teal)';
        }}
        onBlur={(e) => {
          e.target.style.borderBottomColor = 'var(--color-border)';
        }}
      />

      {/* Name suggestion pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'center',
          maxWidth: '440px',
          marginBottom: '40px',
        }}
      >
        {NAME_SUGGESTIONS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setAssistantName(name)}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.05em',
              border: '1px solid var(--color-border)',
              borderRadius: '999px',
              backgroundColor:
                assistantName === name
                  ? 'var(--color-brand-teal)'
                  : 'transparent',
              color:
                assistantName === name
                  ? 'var(--color-brand-cream)'
                  : 'var(--color-txt-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Continue button */}
      <button
        type="button"
        onClick={onNext}
        disabled={!assistantName.trim()}
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
          cursor: assistantName.trim() ? 'pointer' : 'not-allowed',
          opacity: assistantName.trim() ? 1 : 0.5,
          transition: 'opacity 0.2s ease',
          width: '100%',
          maxWidth: '320px',
          fontFamily: 'var(--font-body)',
        }}
      >
        Continue
      </button>

      {/* Footer hint */}
      <p
        style={{
          fontSize: '13px',
          fontStyle: 'italic',
          color: 'var(--color-txt-dim)',
          marginTop: '24px',
          fontFamily: 'var(--font-body)',
        }}
      >
        You can always change this later.
      </p>
    </div>
  );
}

// ── Step 2: What Drains You Most? (step 1) ──
function StepDrains({ selectedDrains, setSelectedDrains, onNext, onBack, saving }) {
  const toggleDrain = (id) => {
    setSelectedDrains((prev) => {
      if (prev.includes(id)) {
        return prev.filter((d) => d !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

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
      {/* Step indicator */}
      <StepIndicator current={1} />

      {/* Eyebrow */}
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: 'var(--color-brand-teal)',
          fontWeight: 600,
          marginBottom: '24px',
          fontFamily: 'var(--font-body)',
        }}
      >
        Step 2 of 3
      </p>

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
        What drains you{' '}
        <em style={{ color: 'var(--color-brand-teal)', fontStyle: 'italic' }}>most?</em>
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: '15px',
          color: 'var(--color-txt-muted)',
          textAlign: 'center',
          maxWidth: '460px',
          lineHeight: 1.7,
          marginBottom: '40px',
          fontFamily: 'var(--font-body)',
        }}
      >
        Pick the top 2 — this helps your assistant know where to start.
      </p>

      {/* 2x2 Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          maxWidth: '540px',
          width: '100%',
          marginBottom: '40px',
        }}
      >
        {DRAIN_OPTIONS.map((option) => {
          const isSelected = selectedDrains.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleDrain(option.id)}
              style={{
                backgroundColor: isSelected
                  ? 'rgba(139, 196, 198, 0.1)'
                  : 'var(--color-brand-white)',
                border: isSelected
                  ? '2px solid var(--color-brand-teal)'
                  : '1px solid var(--color-border)',
                borderRadius: '2px',
                padding: '24px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.25s ease',
                transform: isSelected ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: isSelected
                  ? '0 8px 24px rgba(0,0,0,0.08)'
                  : '0 1px 3px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                }
              }}
            >
              <div
                style={{
                  color: isSelected
                    ? 'var(--color-brand-teal)'
                    : 'var(--color-txt-muted)',
                  marginBottom: '12px',
                  transition: 'color 0.2s ease',
                }}
              >
                {option.icon}
              </div>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--color-txt)',
                  marginBottom: '6px',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {option.label}
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--color-txt-muted)',
                  lineHeight: 1.5,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Bottom buttons */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          maxWidth: '540px',
          width: '100%',
        }}
      >
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          style={{
            flex: 1,
            padding: '16px 24px',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            backgroundColor: 'transparent',
            color: 'var(--color-txt-body)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'var(--font-body)',
          }}
        >
          Back
        </button>

        {/* Continue button */}
        <button
          type="button"
          onClick={onNext}
          disabled={selectedDrains.length === 0 || saving}
          style={{
            flex: 2,
            padding: '16px 24px',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            border: 'none',
            borderRadius: '0px',
            backgroundColor: 'var(--color-brand-deep-green)',
            color: 'var(--color-brand-cream)',
            cursor: selectedDrains.length > 0 && !saving ? 'pointer' : 'not-allowed',
            opacity: selectedDrains.length > 0 && !saving ? 1 : 0.5,
            transition: 'opacity 0.2s ease',
            fontFamily: 'var(--font-body)',
          }}
        >
          {saving ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }}
              />
              Saving...
            </span>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Connect WhatsApp (step 2) ──
function StepWhatsApp({ connectionCode, connected, whatsappNumber, onSkip, onConnect }) {
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
      {/* Step indicator */}
      <StepIndicator current={2} />

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
          WhatsApp Integration
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
        This is where your assistant lives. Scan the QR code below to link your
        WhatsApp — it takes 10 seconds.
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
            Your assistant is ready to chat.
          </p>
        </div>
      ) : (
        <>
          {/* QR Card */}
          <div
            style={{
              backgroundColor: 'var(--color-brand-white)',
              borderRadius: '2px',
              borderTop: '2px solid var(--color-brand-teal)',
              padding: '32px',
              maxWidth: '320px',
              width: '100%',
              marginBottom: '24px',
              transition: 'box-shadow 0.3s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
            }}
          >
            {connectionCode ? (
              <div style={{ textAlign: 'center' }}>
                {/* QR placeholder area */}
                <div
                  style={{
                    width: '200px',
                    height: '200px',
                    margin: '0 auto 20px',
                    backgroundColor: 'var(--color-elevated)',
                    border: '1px dashed var(--color-border)',
                    borderRadius: '2px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-txt-dim)" strokeWidth="1.5">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="3" height="3" />
                    <rect x="18" y="18" width="3" height="3" />
                    <rect x="18" y="14" width="3" height="1" />
                    <rect x="14" y="18" width="1" height="3" />
                  </svg>
                  <span style={{ fontSize: '11px', color: 'var(--color-txt-dim)', fontFamily: 'var(--font-body)' }}>
                    QR Code
                  </span>
                </div>

                {/* Connection code display */}
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '24px',
                    fontWeight: 700,
                    letterSpacing: '0.3em',
                    color: 'var(--color-txt)',
                    marginBottom: '12px',
                  }}
                >
                  {connectionCode}
                </div>

                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-txt-dim)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Open WhatsApp &rarr; Linked Devices &rarr; Scan QR Code
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

          {/* 3 Steps instruction */}
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
                { num: 1, text: 'Open WhatsApp on your phone' },
                { num: 2, text: 'Go to Linked Devices' },
                { num: 3, text: 'Scan the QR code above' },
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

          {/* Open WhatsApp link */}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '13px',
                color: '#25D366',
                fontWeight: 500,
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                marginBottom: '12px',
                fontFamily: 'var(--font-body)',
              }}
            >
              On mobile? Tap here to open WhatsApp directly
            </a>
          )}
        </>
      )}

      {/* Skip / Continue */}
      {connected ? (
        <button
          type="button"
          onClick={onConnect}
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
          Continue
        </button>
      ) : (
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            color: 'var(--color-txt-dim)',
            cursor: 'pointer',
            marginTop: '16px',
            fontFamily: 'var(--font-body)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          Skip for now — I&apos;ll connect later
        </button>
      )}
    </div>
  );
}

// ── Main Onboarding Page ──
export default function OnboardingPage() {
  const t = useTranslations('Onboarding');
  const router = useRouter();

  // Step state
  const [step, setStep] = useState(0);

  // Step 1: Assistant name
  const [assistantName, setAssistantName] = useState('');

  // Step 2: Drains
  const [selectedDrains, setSelectedDrains] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);

  // Step 3: WhatsApp
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

  // Step 1 -> Step 2
  const handleStep1Next = () => {
    setStep(1);
    updateStep('conversational');
  };

  // Step 2 -> Step 3: save drains profile, request WhatsApp code
  const handleStep2Next = async () => {
    setSavingProfile(true);
    try {
      const profileData = {
        name: assistantName.trim(),
        drains: selectedDrains,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      };
      await apiPost('/subscribers/profile', profileData);
    } catch {
      // Non-blocking
    }
    setSavingProfile(false);

    setStep(2);
    updateStep('whatsapp_connect');

    // Request WhatsApp connection code
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
  };

  // Step 2 back to Step 1
  const handleStep2Back = () => {
    setStep(0);
  };

  // Poll for WhatsApp connection when on step 3 (step index 2)
  useEffect(() => {
    if (step !== 2 || connected) return;

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
  }, [step, connected]);

  // After WhatsApp connect or skip: auto-deploy + redirect to dashboard
  const handleWhatsAppDone = async () => {
    try {
      await apiPost('/agents/deploy', {
        name: assistantName.trim(),
      });
    } catch {
      // Non-blocking — agent may already exist
    }

    await updateStep('complete');
    router.push('/dashboard');
  };

  // Step 1: Name Assistant (full viewport, no outer wrapper)
  if (step === 0) {
    return (
      <StepNameAssistant
        assistantName={assistantName}
        setAssistantName={setAssistantName}
        onNext={handleStep1Next}
      />
    );
  }

  // Step 2: What Drains You
  if (step === 1) {
    return (
      <StepDrains
        selectedDrains={selectedDrains}
        setSelectedDrains={setSelectedDrains}
        onNext={handleStep2Next}
        onBack={handleStep2Back}
        saving={savingProfile}
      />
    );
  }

  // Step 3: WhatsApp Connect
  if (step === 2) {
    return (
      <StepWhatsApp
        connectionCode={connectionCode}
        connected={connected}
        whatsappNumber={whatsappNumber}
        onSkip={handleWhatsAppDone}
        onConnect={handleWhatsAppDone}
      />
    );
  }

  return null;
}
