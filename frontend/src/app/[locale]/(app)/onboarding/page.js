'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { apiPost, apiFetch, apiPatch } from '@/lib/api';

const TOTAL_STEPS = 4;

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

// Shared input style
const inputStyle = {
  width: '100%',
  padding: '14px',
  border: '1px solid var(--color-border)',
  borderRadius: '2px',
  fontSize: '0.875rem',
  backgroundColor: 'transparent',
  color: 'var(--color-txt)',
  outline: 'none',
  transition: 'border-color 0.3s ease',
  fontFamily: 'var(--font-body)',
};

// ── Step Indicator: 4 bars ──
function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '32px' }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const isDone = i < current;
        const isActive = i === current;
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
        Step 1 of {TOTAL_STEPS}
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

// ── Step 2: About You + What Drains You (step 1) ──
function StepAboutYou({ userName, setUserName, userRole, setUserRole, selectedDrains, setSelectedDrains, onNext, onBack, saving }) {
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

  const canContinue = userName.trim() && selectedDrains.length > 0 && !saving;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '40px 24px',
        backgroundColor: 'var(--color-brand-cream)',
        animation: 'fadeSlideUp 0.4s ease-out',
        overflowY: 'auto',
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
        Step 2 of {TOTAL_STEPS}
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
        A little about{' '}
        <em style={{ color: 'var(--color-brand-teal)', fontStyle: 'italic' }}>you</em>
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: '15px',
          color: 'var(--color-txt-muted)',
          textAlign: 'center',
          maxWidth: '460px',
          lineHeight: 1.7,
          marginBottom: '32px',
          fontFamily: 'var(--font-body)',
        }}
      >
        So your assistant can hit the ground running.
      </p>

      {/* Name + Role fields */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          maxWidth: '540px',
          width: '100%',
          marginBottom: '32px',
        }}
      >
        <div style={{ flex: 1 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.65rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'var(--color-txt)',
              marginBottom: '8px',
              fontFamily: 'var(--font-body)',
            }}
          >
            Your first name
          </label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="e.g. Sarah"
            maxLength={50}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand-teal)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.65rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'var(--color-txt)',
              marginBottom: '8px',
              fontFamily: 'var(--font-body)',
            }}
          >
            Your role
          </label>
          <input
            type="text"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            placeholder="e.g. Vet nurse, Practice owner"
            maxLength={100}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand-teal)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
          />
        </div>
      </div>

      {/* Drain section label */}
      <p
        style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: 'var(--color-txt)',
          marginBottom: '16px',
          fontFamily: 'var(--font-body)',
          maxWidth: '540px',
          width: '100%',
        }}
      >
        What drains you most? <span style={{ fontWeight: 400, color: 'var(--color-txt-muted)' }}>Pick up to 2</span>
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
          disabled={!canContinue}
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
            cursor: canContinue ? 'pointer' : 'not-allowed',
            opacity: canContinue ? 1 : 0.5,
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

// ── Step 3: Connect Google (step 2) ──
function StepGoogle({ googleConnected, onConnect, onSkip, connecting }) {
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

      {/* Google badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(66, 133, 244, 0.08)',
          padding: '8px 20px',
          borderRadius: '999px',
          marginBottom: '24px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        <span
          style={{
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#4285F4',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
          }}
        >
          Google Integration
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
        <em style={{ color: 'var(--color-brand-teal)', fontStyle: 'italic' }}>Google</em>
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
        Your assistant needs access to your calendar and email to actually help.
        One click — Google handles the rest.
      </p>

      {googleConnected ? (
        /* Connected state */
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(52, 168, 83, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <span style={{ color: '#34A853', fontSize: '36px' }}>&#10003;</span>
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
            Google connected!
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--color-txt-muted)', fontFamily: 'var(--font-body)' }}>
            Calendar, Gmail, and Drive are ready to go.
          </p>
        </div>
      ) : (
        <>
          {/* What gets connected */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              justifyContent: 'center',
              maxWidth: '480px',
              width: '100%',
              marginBottom: '36px',
              flexWrap: 'wrap',
            }}
          >
            {[
              { icon: '📅', label: 'Calendar' },
              { icon: '📧', label: 'Gmail' },
              { icon: '📁', label: 'Drive' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  flex: '1 1 100px',
                }}
              >
                <span style={{ fontSize: '28px' }}>{item.icon}</span>
                <span
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-txt-muted)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Connect button */}
          <button
            type="button"
            onClick={onConnect}
            disabled={connecting}
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
              cursor: connecting ? 'not-allowed' : 'pointer',
              opacity: connecting ? 0.6 : 1,
              width: '100%',
              maxWidth: '320px',
              fontFamily: 'var(--font-body)',
              transition: 'opacity 0.2s ease',
            }}
          >
            {connecting ? (
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
                Connecting...
              </span>
            ) : (
              'Connect Google'
            )}
          </button>
        </>
      )}

      {/* Continue (if connected) or Skip */}
      {googleConnected ? (
        <button
          type="button"
          onClick={onSkip}
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

// ── Step 4: Connect WhatsApp (step 3) ──
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
      <StepIndicator current={3} />

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
        This is where your assistant lives. Send a quick message to connect
        your WhatsApp — it takes 10 seconds.
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

  // Step 2: About you + drains
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [selectedDrains, setSelectedDrains] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);

  // Step 3: Google OAuth
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  // Step 4: WhatsApp
  const [connectionCode, setConnectionCode] = useState(null);
  const [whatsappNumber, setWhatsappNumber] = useState(
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
  );
  const [connected, setConnected] = useState(false);
  const pollRef = useRef(null);

  // On mount: check if Google is already connected (e.g. from signup flow)
  // and check if returning from OAuth callback
  useEffect(() => {
    // Check URL params from callback redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') === 'connected') {
      setGoogleConnected(true);
      // Restore step to Google step so user sees the success state
      setStep(2);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (params.get('google') === 'error') {
      setStep(2);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Otherwise, check backend to see if Google scopes are already connected
    apiFetch('/dashboard/stats')
      .then((stats) => {
        if (stats.google_connected) {
          setGoogleConnected(true);
        }
      })
      .catch(() => {});
  }, []);

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

  // Step 2 -> Step 3 (or skip to Step 4 if Google already connected)
  const handleStep2Next = async () => {
    setSavingProfile(true);
    try {
      const profileData = {
        name: userName.trim(),
        role: userRole.trim() || undefined,
        drains: selectedDrains,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      };
      await apiPost('/subscribers/profile', profileData);
    } catch {
      // Non-blocking
    }
    setSavingProfile(false);

    // Check if Google is already connected (e.g. from signup flow)
    if (googleConnected) {
      // Skip Google step, go straight to WhatsApp
      handleGoogleDone();
      return;
    }

    setStep(2);
    updateStep('google_oauth');
  };

  // Step 2 back to Step 1
  const handleStep2Back = () => {
    setStep(0);
  };

  // Step 3: Connect Google — redirect to Google consent
  const handleGoogleConnect = async () => {
    setConnectingGoogle(true);
    try {
      const data = await apiFetch('/auth/google/url');
      if (data.url) {
        // Store onboarding state so callback can restore it
        sessionStorage.setItem('eai_onboarding', JSON.stringify({
          assistantName,
          userName,
          userRole,
          selectedDrains,
        }));
        // Tell callback page to redirect back to onboarding
        sessionStorage.setItem('eai_google_return', 'onboarding');
        window.location.href = data.url;
      }
    } catch {
      setConnectingGoogle(false);
    }
  };

  // Step 3 -> Step 4: Move to WhatsApp
  const handleGoogleDone = async () => {
    setStep(3);
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

  // Restore onboarding state from sessionStorage (after Google OAuth redirect)
  useEffect(() => {
    const saved = sessionStorage.getItem('eai_onboarding');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.assistantName) setAssistantName(data.assistantName);
        if (data.userName) setUserName(data.userName);
        if (data.userRole) setUserRole(data.userRole);
        if (data.selectedDrains) setSelectedDrains(data.selectedDrains);
        sessionStorage.removeItem('eai_onboarding');
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Poll for WhatsApp connection when on step 4 (step index 3)
  useEffect(() => {
    if (step !== 3 || connected) return;

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

  // Step 1: Name Assistant
  if (step === 0) {
    return (
      <StepNameAssistant
        assistantName={assistantName}
        setAssistantName={setAssistantName}
        onNext={handleStep1Next}
      />
    );
  }

  // Step 2: About You + Drains
  if (step === 1) {
    return (
      <StepAboutYou
        userName={userName}
        setUserName={setUserName}
        userRole={userRole}
        setUserRole={setUserRole}
        selectedDrains={selectedDrains}
        setSelectedDrains={setSelectedDrains}
        onNext={handleStep2Next}
        onBack={handleStep2Back}
        saving={savingProfile}
      />
    );
  }

  // Step 3: Connect Google
  if (step === 2) {
    return (
      <StepGoogle
        googleConnected={googleConnected}
        onConnect={handleGoogleConnect}
        onSkip={handleGoogleDone}
        connecting={connectingGoogle}
      />
    );
  }

  // Step 4: WhatsApp Connect
  if (step === 3) {
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
