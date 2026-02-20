'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { KAJABI_CHECKOUT_URL } from '@/lib/constants';

/* ================================================================
   SVG Icon components (inline, no external deps)
   ================================================================ */
const Icon = {
  Home: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 12L12 3l9 9" /><path d="M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
    </svg>
  ),
  Chat: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  Person: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0112 0v1" />
    </svg>
  ),
  Chain: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
  Card: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
    </svg>
  ),
  Question: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  ),
  WhatsApp: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  ),
  Calendar: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  Mail: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" />
    </svg>
  ),
  Drive: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2L2 19h20L12 2z" /><path d="M7.5 12h9" />
    </svg>
  ),
  Ring: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" />
    </svg>
  ),
  Chevron: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  ArrowRight: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
};

/* ================================================================
   Helpers
   ================================================================ */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function extractName(email) {
  if (!email) return 'there';
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1).replace(/[._-]/g, ' ').split(' ')[0];
}

/* ================================================================
   Shared style objects
   ================================================================ */
const CARD_STYLE = {
  background: 'var(--color-brand-white)',
  border: '1px solid rgba(0,0,0,0.03)',
  borderRadius: '2px',
  transition: 'all 0.4s ease',
};

const CARD_HOVER = {
  transform: 'translateY(-4px)',
  boxShadow: '0 16px 48px rgba(0,0,0,0.06)',
};

const EYEBROW = {
  fontSize: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '0.3em',
  fontWeight: 500,
  color: 'var(--color-brand-teal)',
  marginBottom: '6px',
};

const CARD_HEADING = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.3rem',
  fontWeight: 500,
  color: 'var(--color-txt)',
  marginBottom: '16px',
};

const BODY_SM = {
  fontSize: '0.78rem',
  fontWeight: 300,
  color: 'var(--color-brand-brown)',
  lineHeight: 1.6,
};

const BODY_MD = {
  fontSize: '0.85rem',
  fontWeight: 300,
  color: 'var(--color-brand-brown)',
  lineHeight: 1.6,
};

/* ================================================================
   Hover-card wrapper
   ================================================================ */
function HoverCard({ children, style, className, ...rest }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={className}
      style={{
        ...CARD_STYLE,
        ...(hovered ? CARD_HOVER : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ================================================================
   TUNED SCORE RING
   ================================================================ */
function TunedRing({ percent }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg className="tuned-ring-svg" width="100" height="100" viewBox="0 0 100 100">
      <circle className="tuned-ring-bg" cx="50" cy="50" r="40" />
      <circle
        className="tuned-ring-fill"
        cx="50"
        cy="50"
        r="40"
        style={{ strokeDashoffset: offset }}
      />
    </svg>
  );
}

/* ================================================================
   STATUS BADGE
   ================================================================ */
function StatusBadge({ label, variant = 'default' }) {
  const variants = {
    connected: { bg: 'rgba(45,139,111,0.08)', color: 'var(--color-success)' },
    pending: { bg: 'rgba(212,129,107,0.08)', color: 'var(--color-brand-alert)' },
    coming: { bg: 'rgba(0,0,0,0.03)', color: 'var(--color-txt-dim)' },
    default: { bg: 'rgba(0,0,0,0.03)', color: 'var(--color-brand-text-light)' },
    done: { bg: 'rgba(45,139,111,0.08)', color: 'var(--color-success)' },
  };
  const v = variants[variant] || variants.default;
  return (
    <span className="status-chip-item" style={{
      background: v.bg,
      color: v.color,
      fontSize: '0.55rem',
    }}>
      {label}
    </span>
  );
}

/* ================================================================
   ONBOARDING CHECKLIST ITEM
   ================================================================ */
function ChecklistItem({ done, label }) {
  const cls = done ? 'ob-check-done' : 'ob-check-pending';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
      <div
        className={cls}
        style={{
          width: 20,
          height: 20,
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {done && <Icon.Check style={{ width: 12, height: 12, color: 'white' }} />}
      </div>
      <span style={{
        ...BODY_SM,
        textDecoration: done ? 'line-through' : 'none',
        opacity: done ? 0.5 : 1,
      }}>
        {label}
      </span>
    </div>
  );
}

/* ================================================================
   QUICK ACTION CARD
   ================================================================ */
function QuickAction({ icon: IconComp, label, description, href, onClick }) {
  const Wrapper = href ? Link : 'button';
  const wrapperProps = href ? { href } : { onClick };

  return (
    <Wrapper
      {...wrapperProps}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 18px',
        background: 'var(--color-brand-white)',
        border: '1px solid rgba(0,0,0,0.04)',
        borderRadius: '2px',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'rgba(139,196,198,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <IconComp style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--color-txt)' }}>{label}</div>
        {description && <div style={{ fontSize: '0.68rem', fontWeight: 300, color: 'var(--color-brand-text-light)', marginTop: '2px' }}>{description}</div>}
      </div>
      <Icon.Chevron style={{ width: 16, height: 16, color: 'var(--color-txt-dim)', flexShrink: 0 }} />
    </Wrapper>
  );
}

/* ================================================================
   MAIN DASHBOARD PAGE
   ================================================================ */
export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const router = useRouter();
  const { logout } = useAuth();

  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [apiIntegrations, setApiIntegrations] = useState(null);

  useEffect(() => {
    apiFetch('/dashboard/stats').then(setStats).catch(() => {});
    apiFetch('/agents/mine')
      .then((data) => {
        const list = Array.isArray(data) ? data : data.agents || [];
        setAgents(list);
      })
      .catch(() => {});
    apiFetch('/dashboard/messages?limit=5')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setMessages(list);
      })
      .catch(() => {});
    apiFetch('/integrations')
      .then((data) => setApiIntegrations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  /* Computed values */
  const userName = useMemo(() => extractName(stats?.email), [stats?.email]);
  const assistantName = useMemo(() => agents[0]?.name || 'Your Assistant', [agents]);

  const tunedScore = useMemo(() => {
    if (!stats) return 0;
    let score = 0;
    if (stats.whatsapp_connected) score += 25;
    if (stats.google_connected) score += 25;
    if (stats.goals) score += 15;
    if (stats.onboarding_step === 'complete') score += 10;
    if (agents.length > 0) score += 15;
    score += 10;
    return Math.min(score, 100);
  }, [stats, agents]);

  /* ── Loading skeleton ── */
  if (!stats) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg)',
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '2px solid var(--color-accent)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── Paywall: trial expired or cancelled ── */
  if (stats.trial_expired || stats.tier === 'cancelled') {
    return (
      <div style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '96px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '24px' }}>&#9203;</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.8rem',
          fontWeight: 400,
          color: 'var(--color-txt)',
          marginBottom: '16px',
        }}>
          {stats.tier === 'cancelled' ? t('subscriptionEnded') : t('trialEnded')}
        </h1>
        <p style={{
          ...BODY_MD,
          maxWidth: 340,
          margin: '0 auto 32px',
        }}>
          {stats.tier === 'cancelled' ? t('subscriptionEndedDesc') : t('trialEndedDesc')}
        </p>
        <button
          onClick={() => window.open(KAJABI_CHECKOUT_URL, '_blank')}
          style={{
            padding: '14px 36px',
            background: 'var(--color-brand-deep-green)',
            color: 'var(--color-brand-cream)',
            border: 'none',
            borderRadius: '0px',
            fontSize: '0.8rem',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          {t('upgradeNow')}
        </button>
        <p style={{
          fontSize: '0.7rem',
          color: 'var(--color-txt-dim)',
          marginTop: '16px',
        }}>
          {t('upgradeNote')}
        </p>

        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
        }}>
          <a
            href="mailto:support@evolvedvets.com"
            style={{
              fontSize: '0.7rem',
              fontWeight: 400,
              color: 'var(--color-brand-teal)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Contact support
          </a>
          <button
            onClick={logout}
            style={{
              fontSize: '0.7rem',
              fontWeight: 400,
              color: 'var(--color-txt-dim)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  /* ── Onboarding checklist states ── */
  const profileData = stats.profile_data || {};
  const onboardingItems = [
    { label: 'Created account', done: !!stats.email },
    { label: 'Connected WhatsApp', done: stats.whatsapp_connected },
    { label: 'Name your assistant', done: agents.length > 0 },
    { label: 'Share what drains you most', done: !!stats.goals || !!profileData.drains },
    { label: 'Connect Google Calendar', done: stats.google_connected },
    { label: 'Set your top 3 priorities', done: !!(profileData.priorities && profileData.priorities.length > 0) },
  ];

  const completedSteps = onboardingItems.filter((i) => i.done).length;
  const totalSteps = onboardingItems.length;
  const allComplete = completedSteps === totalSteps;

  /* ── Integration rows ── */
  const ICON_MAP = { whatsapp: Icon.WhatsApp, 'google-calendar': Icon.Calendar, gmail: Icon.Mail, 'google-drive': Icon.Drive, 'oura-ring': Icon.Ring };
  const integrations = apiIntegrations
    ? apiIntegrations.map((i) => ({
        name: i.name,
        icon: ICON_MAP[i.slug] || Icon.Chain,
        connected: i.status === 'connected',
        status: i.status === 'connected' ? 'Connected' : i.status === 'coming_soon' ? 'Coming soon' : 'Not yet',
        comingSoon: i.status === 'coming_soon',
      }))
    : [
        { name: 'WhatsApp', icon: Icon.WhatsApp, connected: stats.whatsapp_connected, status: stats.whatsapp_connected ? 'Connected' : 'Not yet' },
        { name: 'Google Calendar', icon: Icon.Calendar, connected: stats.google_connected, status: stats.google_connected ? 'Connected' : 'Not yet' },
      ];

  /* ──────────────────────────────────────────────
     RENDER — No sidebar, clean card layout
     ────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <main style={{
        maxWidth: 780,
        margin: '0 auto',
        padding: '24px 24px 80px',
      }}>
        {/* ─── Greeting ─── */}
        <section style={{ marginBottom: '32px' }}>
          <div style={EYEBROW}>Home</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            fontWeight: 300,
            color: 'var(--color-txt)',
            lineHeight: 1.2,
            marginBottom: '10px',
          }}>
            {getGreeting()},{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--color-brand-teal)' }}>
              {userName}
            </span>
          </h1>
          <p style={{ ...BODY_MD, maxWidth: 540 }}>
            Here is a snapshot of your account. Chat with {assistantName} on WhatsApp or right here from the web.
          </p>

          {/* Trial banner */}
          {stats.tier === 'trial' && stats.trial_days_remaining != null && (
            <div style={{
              marginTop: '16px',
              padding: '10px 16px',
              background: 'rgba(212,129,107,0.06)',
              border: '1px solid rgba(212,129,107,0.12)',
              borderRadius: '2px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 500,
                color: 'var(--color-brand-alert)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                Trial: {stats.trial_days_remaining} day{stats.trial_days_remaining !== 1 ? 's' : ''} remaining
              </span>
              <button
                onClick={() => window.open(KAJABI_CHECKOUT_URL, '_blank')}
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 500,
                  color: 'var(--color-brand-deep-green)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Upgrade
              </button>
            </div>
          )}
        </section>

        {/* ─── Quick Actions ─── */}
        <section style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}>
            <QuickAction
              icon={Icon.WhatsApp}
              label="Chat on WhatsApp"
              description="Message your assistant"
              onClick={() => window.open('https://wa.me/', '_blank')}
            />
            <QuickAction
              icon={Icon.Calendar}
              label="Connect Google"
              description={stats.google_connected ? 'Calendar & email synced' : 'Calendar, email & drive'}
              href="/settings"
            />
          </div>
        </section>

        {/* ─── Companion Card ─── */}
        <section style={{ marginBottom: '24px' }}>
          <HoverCard style={{ padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '28px', flexWrap: 'wrap' }}>
              {/* Level ring */}
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: 100, height: 100 }}>
                  <TunedRing percent={stats.companion ? Math.round((stats.companion.traits.warmth + stats.companion.traits.knowsYou + stats.companion.traits.reliability + stats.companion.traits.growth) / 4) : tunedScore} />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.5rem',
                      fontWeight: 500,
                      color: 'var(--color-txt)',
                      lineHeight: 1,
                    }}>
                      {stats.companion?.level || 1}
                    </span>
                    <span style={{
                      fontSize: '0.5rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.2em',
                      color: 'var(--color-brand-teal)',
                      marginTop: '2px',
                    }}>
                      Level
                    </span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={EYEBROW}>Companion</div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 500,
                  color: 'var(--color-txt)',
                  marginBottom: '8px',
                }}>
                  {assistantName} is learning you
                </h2>
                <p style={{ ...BODY_SM, marginBottom: '16px', maxWidth: 400 }}>
                  Every conversation, skill, and integration builds the relationship. {assistantName} evolves with you over time.
                </p>

                {/* Trait mini bars */}
                {stats.companion ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                    {[
                      { label: 'Warmth', value: stats.companion.traits.warmth },
                      { label: 'Knows You', value: stats.companion.traits.knowsYou },
                      { label: 'Reliability', value: stats.companion.traits.reliability },
                      { label: 'Growth', value: stats.companion.traits.growth },
                    ].map((trait) => (
                      <div key={trait.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 400, color: 'var(--color-brand-text-light)' }}>{trait.label}</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: 500, color: 'var(--color-brand-teal-dark)' }}>{trait.value}%</span>
                        </div>
                        <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(139,196,198,0.12)', overflow: 'hidden' }}>
                          <div style={{ width: `${trait.value}%`, height: '100%', background: 'var(--color-brand-teal)', borderRadius: '2px', transition: 'width 0.8s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <StatusBadge
                      label={stats.whatsapp_connected ? 'WhatsApp connected' : 'WhatsApp not connected'}
                      variant={stats.whatsapp_connected ? 'connected' : 'pending'}
                    />
                    <StatusBadge
                      label={stats.google_connected ? 'Calendar connected' : 'Calendar -- not yet'}
                      variant={stats.google_connected ? 'connected' : 'pending'}
                    />
                  </div>
                )}
              </div>
            </div>
          </HoverCard>
        </section>

        {/* ─── 2-column: Integrations + Onboarding ─── */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}>
          {/* Integration Status */}
          <HoverCard style={{ padding: '24px 28px' }}>
            <div style={EYEBROW}>Integrations</div>
            <h3 style={CARD_HEADING}>Integration Status</h3>
            <div>
              {integrations.map((integ, i) => {
                const IconComp = integ.icon;
                return (
                  <div key={i} className="integration-status-row">
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '2px',
                      background: integ.connected ? 'rgba(45,139,111,0.06)' : 'rgba(0,0,0,0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <IconComp style={{
                        width: 16,
                        height: 16,
                        color: integ.connected ? 'var(--color-success)' : 'var(--color-txt-dim)',
                      }} />
                    </div>
                    <span style={{ ...BODY_SM, flex: 1, fontSize: '0.8rem' }}>{integ.name}</span>
                    <StatusBadge
                      label={integ.status}
                      variant={integ.connected ? 'connected' : integ.comingSoon ? 'coming' : 'pending'}
                    />
                  </div>
                );
              })}
            </div>
            <Link
              href="/settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '16px',
                fontSize: '0.7rem',
                fontWeight: 500,
                color: 'var(--color-brand-teal)',
                textDecoration: 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Manage integrations <Icon.ArrowRight style={{ width: 12, height: 12 }} />
            </Link>
          </HoverCard>

          {/* Onboarding Progress — only show if not complete */}
          {!allComplete ? (
            <HoverCard style={{ padding: '24px 28px' }}>
              <div style={EYEBROW}>Getting started</div>
              <h3 style={CARD_HEADING}>Onboarding Progress</h3>
              <div style={{
                fontSize: '0.65rem',
                fontWeight: 500,
                color: 'var(--color-brand-text-light)',
                marginBottom: '12px',
              }}>
                {completedSteps} of {totalSteps} complete
              </div>

              {/* Progress bar */}
              <div style={{
                width: '100%',
                height: 4,
                background: 'var(--color-brand-cream)',
                borderRadius: '2px',
                marginBottom: '16px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(completedSteps / totalSteps) * 100}%`,
                  height: '100%',
                  background: 'var(--color-brand-teal)',
                  borderRadius: '2px',
                  transition: 'width 0.6s ease',
                }} />
              </div>

              <div>
                {onboardingItems.map((item, i) => (
                  <ChecklistItem key={i} done={item.done} label={item.label} />
                ))}
              </div>
            </HoverCard>
          ) : (
            /* Account summary when onboarding is complete */
            <HoverCard style={{ padding: '24px 28px' }}>
              <div style={EYEBROW}>Account</div>
              <h3 style={CARD_HEADING}>Your Account</h3>
              <div>
                <div className="account-info-row">
                  <span style={{ ...BODY_SM, color: 'var(--color-txt-dim)' }}>Email</span>
                  <span style={{
                    ...BODY_SM,
                    color: 'var(--color-txt)',
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{stats.email}</span>
                </div>
                <div className="account-info-row">
                  <span style={{ ...BODY_SM, color: 'var(--color-txt-dim)' }}>Plan</span>
                  <StatusBadge
                    label={stats.tier === 'trial' ? 'Trial' : stats.tier === 'active' ? 'Active' : stats.tier || '--'}
                    variant={stats.tier === 'trial' ? 'pending' : 'connected'}
                  />
                </div>
                <div className="account-info-row">
                  <span style={{ ...BODY_SM, color: 'var(--color-txt-dim)' }}>Assistant</span>
                  <span style={{ ...BODY_SM, color: 'var(--color-brand-teal)' }}>{assistantName}</span>
                </div>
                <div className="account-info-row">
                  <span style={{ ...BODY_SM, color: 'var(--color-txt-dim)' }}>Price</span>
                  <span style={{ ...BODY_SM, color: 'var(--color-txt)' }}>
                    {stats.tier === 'trial' ? '$0 (trial)' : '$49/mo'}
                  </span>
                </div>
                {stats.tier === 'trial' && stats.trial_ends_at && (
                  <div className="account-info-row">
                    <span style={{ ...BODY_SM, color: 'var(--color-txt-dim)' }}>Trial ends</span>
                    <span style={{ ...BODY_SM, color: 'var(--color-brand-alert)' }}>
                      {formatDate(stats.trial_ends_at)}
                    </span>
                  </div>
                )}
              </div>
              <Link
                href="/settings"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  color: 'var(--color-brand-teal)',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Manage account <Icon.ArrowRight style={{ width: 12, height: 12 }} />
              </Link>
            </HoverCard>
          )}
        </section>

        {/* ─── Recent Activity ─── */}
        <section style={{ marginBottom: '24px' }}>
          <HoverCard style={{ padding: '24px 28px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={EYEBROW}>Activity</div>
              <h3 style={{ ...CARD_HEADING, marginBottom: 0 }}>Recent Messages</h3>
            </div>
            {messages.length > 0 ? (
              <div>
                {messages.map((msg) => (
                  <div key={msg.id} className="activity-log-item">
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-success)',
                      flexShrink: 0,
                      marginTop: '6px',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '0.6rem',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          color: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-success)',
                        }}>
                          {msg.role === 'user' ? 'You' : assistantName}
                        </span>
                        {msg.channel && (
                          <span style={{
                            fontSize: '0.5rem',
                            fontWeight: 400,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'var(--color-txt-dim)',
                            padding: '1px 6px',
                            background: 'rgba(0,0,0,0.02)',
                            borderRadius: '2px',
                          }}>
                            {msg.channel}
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.6rem',
                          color: 'var(--color-txt-dim)',
                          marginLeft: 'auto',
                          flexShrink: 0,
                        }}>
                          {timeAgo(msg.createdAt || msg.created_at)}
                        </span>
                      </div>
                      <p style={{
                        ...BODY_SM,
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '40px 0',
              }}>
                <p style={{ ...BODY_SM, opacity: 0.5 }}>No activity yet. Start chatting with {assistantName} to see activity here.</p>
              </div>
            )}
          </HoverCard>
        </section>

        {/* ─── Support ─── */}
        <section style={{ marginBottom: '24px' }}>
          <HoverCard style={{ padding: '24px 28px' }}>
            <div style={EYEBROW}>Help</div>
            <h3 style={CARD_HEADING}>Support</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              <a
                href="https://wa.me/message/evolvedai"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  background: 'rgba(37,211,102,0.04)',
                  border: '1px solid rgba(37,211,102,0.1)',
                  borderRadius: '2px',
                  textDecoration: 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                <Icon.WhatsApp style={{ width: 16, height: 16, color: '#25D366' }} />
                <span style={{ ...BODY_SM, color: 'var(--color-txt)' }}>Chat with support</span>
              </a>
              <a
                href="mailto:support@evolvedvets.com"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  background: 'rgba(0,0,0,0.01)',
                  border: '1px solid rgba(0,0,0,0.04)',
                  borderRadius: '2px',
                  textDecoration: 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                <Icon.Mail style={{ width: 16, height: 16, color: 'var(--color-txt-muted)' }} />
                <span style={{ ...BODY_SM, color: 'var(--color-txt)' }}>Email us</span>
              </a>
            </div>
          </HoverCard>
        </section>
      </main>
    </div>
  );
}
