'use client';

import { useTranslations } from 'next-intl';

export default function EcosystemSection() {
  const t = useTranslations('Landing');

  return (
    <section className="py-24 px-6 lg:px-12" style={{ background: 'var(--color-brand-cream)' }}>
      <div className="max-w-[900px] mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-brand-teal font-semibold mb-6">
            {t('ecosystemEyebrow')}
          </p>
          <h2
            className="font-[family-name:var(--font-display)] font-light leading-[1.25] text-brand-charcoal"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            {t('ecosystemTitle')} <em className="italic text-brand-teal">{t('ecosystemTitleEm')}</em>
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Membership */}
          <div className="bg-white px-8 py-10 text-center border border-black/[0.04] transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.06)] relative">
            <div className="mb-4 h-7 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand-teal" strokeWidth="1.5" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-display)] text-[1.3rem] font-medium text-brand-charcoal mb-2">
              {t('eco1Title')}
            </h3>
            <p className="text-[0.8rem] leading-[1.7] text-brand-brown font-light">
              {t('eco1Body')}
            </p>
            <a href="https://evolvedvets.com/membership" target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-[0.68rem] uppercase tracking-[0.15em] text-brand-teal font-semibold no-underline hover:text-brand-deep-green transition-colors">
              {t('eco1Link')} →
            </a>
          </div>

          {/* AI Assistant - Current */}
          <div className="bg-white px-8 py-10 text-center border-2 border-brand-teal transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.06)] relative">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand-teal text-brand-deep-green text-[0.55rem] uppercase tracking-[0.15em] font-bold px-3 py-1 whitespace-nowrap">
              {t('eco2Badge')}
            </div>
            <div className="mb-4 h-7 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand-teal" strokeWidth="1.5" fill="none">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-display)] text-[1.3rem] font-medium text-brand-charcoal mb-2">
              {t('eco2Title')}
            </h3>
            <p className="text-[0.8rem] leading-[1.7] text-brand-brown font-light">
              {t('eco2Body')}
            </p>
            <a href="#pricing" className="inline-block mt-4 text-[0.68rem] uppercase tracking-[0.15em] text-brand-teal font-semibold no-underline hover:text-brand-deep-green transition-colors">
              {t('eco2Link')} →
            </a>
          </div>

          {/* 1:1 Coaching */}
          <div className="bg-white px-8 py-10 text-center border border-black/[0.04] transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.06)] relative">
            <div className="mb-4 h-7 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-brand-teal" strokeWidth="1.5" fill="none">
                <path d="M6 3v12" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-display)] text-[1.3rem] font-medium text-brand-charcoal mb-2">
              {t('eco3Title')}
            </h3>
            <p className="text-[0.8rem] leading-[1.7] text-brand-brown font-light">
              {t('eco3Body')}
            </p>
            <a href="https://evolvedvets.com/coaching" target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-[0.68rem] uppercase tracking-[0.15em] text-brand-teal font-semibold no-underline hover:text-brand-deep-green transition-colors">
              {t('eco3Link')} →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
