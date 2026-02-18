'use client';

import { useTranslations } from 'next-intl';

export default function TestimonialsSection() {
  const t = useTranslations('Landing');

  return (
    <section className="py-24 px-6 lg:px-12 bg-white">
      <div className="max-w-[700px] mx-auto text-center">
        {/* Top divider */}
        <div className="w-[60px] h-px bg-brand-teal mx-auto mb-12" />

        {/* Quote */}
        <div
          className="font-[family-name:var(--font-display)] font-light italic leading-[1.5] text-brand-charcoal relative mb-8"
          style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}
        >
          {/* Large quote mark */}
          <span
            className="font-[family-name:var(--font-display)] absolute top-[-2.5rem] left-1/2 -translate-x-1/2 text-brand-teal/30 leading-none"
            style={{ fontSize: '5rem' }}
          >
            &ldquo;
          </span>
          {t('testimonialQuote')}
        </div>

        {/* Author */}
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.15em] text-brand-charcoal">
          {t('testimonialAuthor')}
        </p>
        <p className="text-[0.75rem] text-brand-text-light font-light mt-1">
          {t('testimonialRole')}
        </p>

        {/* Bottom divider */}
        <div className="w-[60px] h-px bg-brand-teal mx-auto mt-12" />
      </div>
    </section>
  );
}
