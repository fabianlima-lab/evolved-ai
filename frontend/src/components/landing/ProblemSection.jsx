'use client';

import { useTranslations } from 'next-intl';

export default function ProblemSection() {
  const t = useTranslations('Landing');

  const stats = [
    { number: t('stat1Number'), label: t('stat1Label') },
    { number: t('stat2Number'), label: t('stat2Label') },
    { number: t('stat3Number'), label: t('stat3Label') },
  ];

  return (
    <section className="py-24 px-6 lg:px-12 bg-white">
      <div className="max-w-[750px] mx-auto text-center">
        <p className="text-[0.68rem] uppercase tracking-[0.3em] text-brand-teal font-semibold mb-6">
          {t('problemEyebrow')}
        </p>

        <h2
          className="font-[family-name:var(--font-display)] font-light leading-[1.25] text-brand-charcoal mb-8"
          style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
        >
          {t('problemTitle')} <em className="italic text-brand-teal">{t('problemTitleEm')}</em>
        </h2>

        <p className="text-base leading-[1.9] text-brand-brown font-light">
          {t('problemText')}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-14 pt-14 border-t border-black/[0.06]">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="font-[family-name:var(--font-display)] text-[2.8rem] font-light text-brand-teal leading-none mb-2">
                {stat.number}
              </div>
              <div className="text-[0.72rem] uppercase tracking-[0.12em] text-brand-text-light font-medium leading-[1.5]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
