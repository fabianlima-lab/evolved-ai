'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch, apiPost } from '@/lib/api';

/* ── Inline Icons ── */
const Icon = {
  Heart: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  Brain: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
      <path d="M9 21h6M10 17v4M14 17v4" />
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  TrendUp: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Star: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Zap: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Chain: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
};

/* ── Styles ── */
const CARD_STYLE = {
  background: 'var(--color-brand-white)',
  border: '1px solid rgba(0,0,0,0.03)',
  borderRadius: '2px',
  transition: 'all 0.4s ease',
};

const EYEBROW = {
  fontSize: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '0.3em',
  fontWeight: 500,
  color: 'var(--color-brand-teal)',
  marginBottom: '6px',
};

/* ── Trait Bar ── */
function TraitBar({ label, value, icon: IconComp }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
      <IconComp style={{ width: 16, height: 16, color: 'var(--color-brand-teal)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-txt)' }}>{label}</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-brand-teal-dark)' }}>{value}%</span>
        </div>
        <div style={{
          height: '4px',
          borderRadius: '2px',
          background: 'rgba(139,196,198,0.15)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${value}%`,
            height: '100%',
            background: 'var(--color-brand-teal)',
            borderRadius: '2px',
            transition: 'width 0.8s ease',
          }} />
        </div>
      </div>
    </div>
  );
}

/* ── Level Badge ── */
function LevelBadge({ level, t }) {
  const labels = {
    1: t('levelLabel1'),
    2: t('levelLabel2'),
    3: t('levelLabel3'),
    4: t('levelLabel4'),
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 14px',
      borderRadius: '2px',
      background: 'rgba(139,196,198,0.1)',
      border: '1px solid rgba(139,196,198,0.2)',
    }}>
      <Icon.Star style={{ width: 14, height: 14, color: 'var(--color-brand-teal)' }} />
      <span style={{
        fontSize: '0.65rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: 'var(--color-brand-teal-dark)',
      }}>
        {t('level', { level })} — {labels[level] || labels[4]}
      </span>
    </div>
  );
}

/* ── Timeline Event ── */
function TimelineEvent({ event }) {
  const typeIcons = {
    milestone: Icon.Star,
    skill_installed: Icon.Zap,
    integration_connected: Icon.Chain,
    admin_push: Icon.TrendUp,
  };

  const EventIcon = typeIcons[event.eventType] || Icon.Star;
  const date = new Date(event.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      padding: '12px 0',
      borderBottom: '1px solid rgba(0,0,0,0.03)',
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '2px',
        background: 'rgba(139,196,198,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <EventIcon style={{ width: 14, height: 14, color: 'var(--color-brand-teal)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--color-txt)' }}>
          {event.title}
        </div>
        {event.description && (
          <div style={{ fontSize: '0.7rem', fontWeight: 300, color: 'var(--color-brand-text-light)', marginTop: '2px' }}>
            {event.description}
          </div>
        )}
      </div>
      <div style={{ fontSize: '0.65rem', fontWeight: 300, color: 'var(--color-brand-text-light)', flexShrink: 0 }}>
        {date}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function MeetPage() {
  const t = useTranslations('Meet');
  const [companion, setCompanion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/companion')
      .then(setCompanion)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
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

  if (!companion) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">{t('title', { name: 'Your Assistant' })}</h1>
        <p className="text-sm text-txt-muted mt-2">Deploy your assistant first to see their profile.</p>
      </div>
    );
  }

  const name = companion.name || 'Your Assistant';

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt" style={{ fontWeight: 300 }}>
          {t('title', { name })}
        </h1>
        <p style={{ fontSize: '0.82rem', fontWeight: 300, color: 'var(--color-brand-brown)', marginTop: '8px', lineHeight: 1.6 }}>
          {t('subtitle')}
        </p>
        <div style={{ marginTop: '16px' }}>
          <LevelBadge level={companion.level} t={t} />
        </div>
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Traits Card */}
        <div style={{ ...CARD_STYLE, padding: '24px' }}>
          <div style={EYEBROW}>{t('traits')}</div>
          <TraitBar label={t('warmth')} value={companion.traits.warmth} icon={Icon.Heart} />
          <TraitBar label={t('knowsYou')} value={companion.traits.knowsYou} icon={Icon.Brain} />
          <TraitBar label={t('reliability')} value={companion.traits.reliability} icon={Icon.Shield} />
          <TraitBar label={t('growth')} value={companion.traits.growth} icon={Icon.TrendUp} />
        </div>

        {/* Stats Card */}
        <div style={{ ...CARD_STYLE, padding: '24px' }}>
          <div style={EYEBROW}>{t('stats')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
            {[
              { label: t('totalMessages'), value: companion.stats.totalMessages },
              { label: t('daysTogether'), value: companion.stats.daysSinceCreation },
              { label: t('activeSkills'), value: companion.stats.activeSkills },
              { label: t('connectedIntegrations'), value: companion.stats.connectedIntegrations },
            ].map((stat) => (
              <div key={stat.label}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.8rem',
                  fontWeight: 300,
                  color: 'var(--color-txt)',
                  lineHeight: 1.1,
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.65rem', fontWeight: 300, color: 'var(--color-brand-text-light)', marginTop: '4px' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skills */}
      {companion.skills.length > 0 && (
        <div style={{ ...CARD_STYLE, padding: '24px', marginTop: '20px' }}>
          <div style={EYEBROW}>{t('skills')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {companion.skills.filter(s => s.status === 'active').map((skill) => (
              <span key={skill.slug} style={{
                fontSize: '0.7rem',
                fontWeight: 400,
                padding: '5px 12px',
                borderRadius: '2px',
                background: 'rgba(139,196,198,0.1)',
                color: 'var(--color-brand-teal-dark)',
                border: '1px solid rgba(139,196,198,0.15)',
              }}>
                {skill.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Integrations */}
      {companion.integrations.length > 0 && (
        <div style={{ ...CARD_STYLE, padding: '24px', marginTop: '20px' }}>
          <div style={EYEBROW}>{t('integrations')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {companion.integrations.filter(i => i.status === 'connected').map((integ) => (
              <span key={integ.slug} style={{
                fontSize: '0.7rem',
                fontWeight: 400,
                padding: '5px 12px',
                borderRadius: '2px',
                background: 'rgba(45,139,111,0.08)',
                color: 'var(--color-success)',
                border: '1px solid rgba(45,139,111,0.1)',
              }}>
                {integ.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Journey Timeline */}
      <div style={{ ...CARD_STYLE, padding: '24px', marginTop: '20px' }}>
        <div style={EYEBROW}>{t('journey')}</div>
        {companion.journey.length === 0 ? (
          <p style={{ fontSize: '0.78rem', fontWeight: 300, color: 'var(--color-brand-text-light)', marginTop: '8px' }}>
            {t('noEvents')}
          </p>
        ) : (
          <div style={{ marginTop: '4px' }}>
            {companion.journey.map((event) => (
              <TimelineEvent key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
