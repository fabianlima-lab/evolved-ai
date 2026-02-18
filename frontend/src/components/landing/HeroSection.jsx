'use client';

import { useTranslations } from 'next-intl';
import { KAJABI_CHECKOUT_URL } from '@/lib/constants';

export default function HeroSection() {
  const t = useTranslations('Landing');

  return (
    <section className="min-h-screen flex items-center justify-center relative pt-32 pb-20 lg:pt-36 lg:pb-24 px-6 lg:px-12 overflow-hidden" style={{ background: 'var(--color-brand-cream)' }}>
      {/* Subtle radial gradients */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(139, 196, 198, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(206, 236, 228, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(225, 199, 166, 0.08) 0%, transparent 50%)
          `,
        }}
      />

      <div className="max-w-[800px] text-center relative z-[2]">
        {/* Eyebrow */}
        <p
          className="text-[0.7rem] uppercase tracking-[0.3em] text-brand-teal font-semibold mb-8"
          style={{ opacity: 0, animation: 'fadeUp 1s ease 0.2s forwards' }}
        >
          {t('heroEyebrow')}
        </p>

        {/* Headline */}
        <h1
          className="font-[family-name:var(--font-display)] text-brand-charcoal font-light leading-[1.15] mb-6"
          style={{ fontSize: 'clamp(2.8rem, 6vw, 4.5rem)', opacity: 0, animation: 'fadeUp 1s ease 0.4s forwards' }}
        >
          {t('heroHeadline')}<br />
          {t('heroHeadline2')}<br />
          <em className="italic text-brand-teal font-normal">{t('heroHeadlineEm')}</em>
        </h1>

        {/* Subheadline */}
        <p
          className="text-[1.05rem] leading-[1.8] text-brand-brown font-light max-w-[580px] mx-auto mb-10"
          style={{ opacity: 0, animation: 'fadeUp 1s ease 0.6s forwards' }}
        >
          {t('heroSub')}
        </p>

        {/* CTAs — hash scroll handled by page-level interceptor */}
        <div
          className="flex gap-4 justify-center flex-wrap"
          style={{ opacity: 0, animation: 'fadeUp 1s ease 0.8s forwards' }}
        >
          <a
            href={KAJABI_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand-deep-green text-brand-cream px-10 py-4 text-[0.72rem] uppercase tracking-[0.2em] font-semibold border-none cursor-pointer transition-all duration-400 no-underline inline-block hover:bg-brand-teal hover:text-brand-deep-green hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(139,196,198,0.3)]"
          >
            {t('heroCta')}
          </a>
          <button
            onClick={() => {
              const el = document.getElementById('how');
              if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo(0, top);
                window.history.replaceState(null, '', '#how');
              }
            }}
            className="bg-transparent text-brand-charcoal px-10 py-4 text-[0.72rem] uppercase tracking-[0.2em] font-semibold border-[1.5px] border-brand-charcoal cursor-pointer transition-all duration-400 hover:bg-brand-deep-green hover:text-brand-cream hover:-translate-y-0.5"
          >
            {t('heroSecondaryCta')}
          </button>
        </div>

        {/* Note */}
        <p
          className="mt-6 text-[0.78rem] text-brand-text-light italic"
          style={{ opacity: 0, animation: 'fadeUp 1s ease 1s forwards' }}
        >
          {t('heroNote')}<br />
          <span className="inline-flex items-center gap-1">🔒 {t('heroNoteSecurity')}</span>
        </p>
      </div>
    </section>
  );
}
