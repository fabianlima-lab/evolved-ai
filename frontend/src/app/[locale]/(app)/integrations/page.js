'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch, apiPost } from '@/lib/api';

/* ── Inline Icons ── */
const Icon = {
  Check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12l5 5L20 7" />
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

/* ── Integration Card ── */
function IntegrationCard({ integration, t, onConnect }) {
  const [hovered, setHovered] = useState(false);
  const isConnected = integration.status === 'connected';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...CARD_STYLE,
        ...(hovered ? CARD_HOVER : {}),
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '2px',
            background: isConnected ? 'rgba(45,139,111,0.08)' : 'rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon.Chain style={{
              width: 18,
              height: 18,
              color: isConnected ? 'var(--color-success)' : 'var(--color-brand-text-light)',
            }} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--color-txt)' }}>
              {integration.name}
            </div>
            {integration.description && (
              <div style={{ fontSize: '0.7rem', fontWeight: 300, color: 'var(--color-brand-text-light)', marginTop: '1px' }}>
                {integration.description}
              </div>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span style={{
          fontSize: '0.55rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: '3px 10px',
          borderRadius: '2px',
          background: isConnected ? 'rgba(45,139,111,0.08)' : 'rgba(0,0,0,0.03)',
          color: isConnected ? 'var(--color-success)' : 'var(--color-brand-text-light)',
        }}>
          {isConnected ? t('connected') : t('available')}
        </span>
      </div>

      {/* Benefits */}
      {integration.benefits && Array.isArray(integration.benefits) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {integration.benefits.map((benefit, i) => (
            <span key={i} style={{
              fontSize: '0.62rem',
              fontWeight: 400,
              padding: '3px 8px',
              borderRadius: '2px',
              background: 'rgba(139,196,198,0.08)',
              color: 'var(--color-brand-teal-dark)',
            }}>
              {benefit}
            </span>
          ))}
        </div>
      )}

      {/* Connect button (only for available) */}
      {!isConnected && (
        <button
          onClick={() => onConnect(integration.slug)}
          style={{
            alignSelf: 'flex-start',
            padding: '8px 20px',
            fontSize: '0.62rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            background: 'var(--color-brand-deep-green)',
            color: 'var(--color-brand-cream)',
            border: 'none',
            borderRadius: '0px',
            cursor: 'pointer',
            transition: 'opacity 0.3s ease',
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.85'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          {t('connect')}
        </button>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function IntegrationsPage() {
  const t = useTranslations('Integrations');
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/integrations')
      .then((data) => {
        setIntegrations(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async (slug) => {
    try {
      const updated = await apiPost(`/integrations/${slug}/connect`);
      setIntegrations((prev) =>
        prev.map((i) => (i.slug === slug ? { ...i, status: 'connected', connectedAt: new Date() } : i)),
      );
    } catch (err) {
      console.error('Connect failed:', err.message);
    }
  };

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

  const connected = integrations.filter(i => i.status === 'connected');
  const available = integrations.filter(i => i.status !== 'connected');

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt" style={{ fontWeight: 300 }}>
        {t('title')}
      </h1>
      <p style={{ fontSize: '0.82rem', fontWeight: 300, color: 'var(--color-brand-brown)', marginTop: '8px', lineHeight: 1.6 }}>
        {t('subtitle')}
      </p>

      {/* Summary bar */}
      <div className="flex items-center gap-4 mt-4 text-sm">
        <span className="text-success font-medium">{connected.length} {t('connected')}</span>
        <span className="text-txt-dim">.</span>
        <span className="text-txt-muted">{available.length} {t('available')}</span>
      </div>

      {integrations.length === 0 ? (
        <p style={{ fontSize: '0.82rem', fontWeight: 300, color: 'var(--color-brand-text-light)', marginTop: '24px' }}>
          {t('noIntegrations')}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px', marginTop: '24px' }}>
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.slug}
              integration={integration}
              t={t}
              onConnect={handleConnect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
