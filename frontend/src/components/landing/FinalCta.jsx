'use client';

import { useTranslations } from 'next-intl';
import { KAJABI_CHECKOUT_URL } from '@/lib/constants';

export default function FinalCTA() {
  const t = useTranslations('Landing');

  return (
    <section id="start" className="py-24 px-6 lg:px-12 bg-brand-deep-green text-center relative overflow-hidden">
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 30% 50%, rgba(139, 196, 198, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 50%, rgba(206, 236, 228, 0.06) 0%, transparent 50%)
          `,
        }}
      />

      <div className="max-w-[650px] mx-auto relative z-[2]">
        <p className="text-[0.68rem] uppercase tracking-[0.3em] text-brand-teal-light font-semibold mb-6">
          {t('ctaEyebrow')}
        </p>

        <h2
          className="font-[family-name:var(--font-display)] font-light leading-[1.25] text-brand-cream mb-6"
          style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
        >
          {t('ctaTitle')} <em className="italic text-brand-teal-light">{t('ctaTitleEm')}</em> {t('ctaTitle2')}
        </h2>

        <p className="text-base leading-[1.8] font-light mb-10" style={{ color: 'rgba(247, 244, 238, 0.65)' }}>
          {t('ctaSub')}
        </p>

        <a
          href={KAJABI_CHECKOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brand-teal text-brand-deep-green px-10 py-4 text-[0.72rem] uppercase tracking-[0.2em] font-semibold border-none cursor-pointer transition-all duration-400 no-underline inline-block hover:bg-brand-cream hover:text-brand-deep-green hover:-translate-y-0.5"
        >
          {t('ctaCta')}
        </a>
      </div>
    </section>
  );
}
