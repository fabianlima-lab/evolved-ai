'use client';

import { useTranslations } from 'next-intl';

function FeatureIcon({ type }) {
  const icons = {
    calendar: (
      <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand-teal" strokeWidth="1.5" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
    email: (
      <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand-teal" strokeWidth="1.5" fill="none">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    leadership: (
      <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand-teal" strokeWidth="1.5" fill="none">
        <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
        <line x1="10" y1="22" x2="14" y2="22" />
        <line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    ),
    aligned: (
      <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand-teal" strokeWidth="1.5" fill="none">
        <path d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    heart: (
      <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand-teal" strokeWidth="1.5" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    finance: (
      <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand-teal" strokeWidth="1.5" fill="none">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  };

  return <div className="w-12 h-12 flex items-center justify-center mb-6">{icons[type]}</div>;
}

export default function FeaturesGrid() {
  const t = useTranslations('Landing');

  const features = [
    { icon: 'calendar', title: t('feat1Title'), body: t('feat1Body'), tag: t('feat1Tag') },
    { icon: 'email', title: t('feat2Title'), body: t('feat2Body'), tag: t('feat2Tag') },
    { icon: 'leadership', title: t('feat3Title'), body: t('feat3Body'), tag: t('feat3Tag') },
    { icon: 'aligned', title: t('feat4Title'), body: t('feat4Body'), tag: t('feat4Tag') },
    { icon: 'heart', title: t('feat5Title'), body: t('feat5Body'), tag: t('feat5Tag') },
    { icon: 'finance', title: t('feat6Title'), body: t('feat6Body'), tag: t('feat6Tag') },
  ];

  return (
    <section id="features" className="py-24 px-6 lg:px-12" style={{ background: 'var(--color-brand-cream)' }}>
      <div className="max-w-[1000px] mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-brand-teal font-semibold mb-6">
            {t('featuresEyebrow')}
          </p>
          <h2
            className="font-[family-name:var(--font-display)] font-light leading-[1.25] text-brand-charcoal"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            {t('featuresTitle')}<br />
            <em className="italic text-brand-teal">{t('featuresTitleEm')}</em>
          </h2>
        </div>

        {/* Grid - 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feat, i) => (
            <div
              key={i}
              className="bg-white p-10 border border-black/[0.03] relative transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.06)]"
              style={{ borderRadius: '2px' }}
            >
              <FeatureIcon type={feat.icon} />
              <h3 className="font-[family-name:var(--font-display)] text-2xl font-medium mb-3 text-brand-charcoal">
                {feat.title}
              </h3>
              <p className="text-[0.88rem] leading-[1.7] text-brand-brown font-light">
                {feat.body}
              </p>
              <span className="inline-block mt-4 text-[0.65rem] uppercase tracking-[0.15em] text-brand-teal font-semibold px-3 py-1 bg-brand-teal/[0.12]" style={{ borderRadius: '2px' }}>
                {feat.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
