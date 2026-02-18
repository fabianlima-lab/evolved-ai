'use client';

import { useTranslations } from 'next-intl';

export default function HowItWorksSection() {
  const t = useTranslations('Landing');

  const steps = [
    { num: '1', title: t('how1Title'), body: t('how1Body') },
    { num: '2', title: t('how2Title'), body: t('how2Body') },
    { num: '3', title: t('how3Title'), body: t('how3Body') },
  ];

  return (
    <section id="how" className="py-24 px-6 lg:px-12 bg-brand-deep-green text-brand-cream">
      <div className="max-w-[900px] mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-brand-teal-light font-semibold mb-6">
            {t('howEyebrow')}
          </p>
          <h2
            className="font-[family-name:var(--font-display)] font-light leading-[1.25] text-brand-cream"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            {t('howTitle')} <em className="italic text-brand-teal-light">{t('howTitleEm')}</em>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-7 left-[16.5%] right-[16.5%] h-px bg-brand-teal/30" />

          {steps.map((step) => (
            <div key={step.num} className="text-center relative">
              {/* Number circle */}
              <div className="w-14 h-14 border-[1.5px] border-brand-teal rounded-full flex items-center justify-center mx-auto mb-6 bg-brand-deep-green relative z-[2]">
                <span className="font-[family-name:var(--font-display)] text-[1.4rem] font-normal text-brand-teal-light">
                  {step.num}
                </span>
              </div>

              <h3 className="font-[family-name:var(--font-display)] text-[1.3rem] font-medium text-brand-cream mb-3">
                {step.title}
              </h3>
              <p className="text-[0.82rem] leading-[1.7] font-light" style={{ color: 'rgba(247, 244, 238, 0.6)' }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
