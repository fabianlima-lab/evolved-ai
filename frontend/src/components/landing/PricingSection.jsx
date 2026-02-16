'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function PricingSection() {
  const t = useTranslations('Pricing');

  const PLANS = [
    {
      nameKey: 'trialName',
      priceKey: 'trialPrice',
      periodKey: 'trialPeriod',
      features: ['feature_1agent', 'feature_whatsapp', 'feature_unlimited', 'feature_search', 'feature_preview'],
      ctaKey: 'trialCta',
      href: '/signup?plan=trial',
      highlight: false,
    },
    {
      nameKey: 'activeName',
      priceKey: 'activePrice',
      periodKey: 'activePeriod',
      badgeKey: 'activeBadge',
      features: ['feature_1agent', 'feature_whatsapp', 'feature_unlimited', 'feature_search', 'feature_memory', 'feature_priority'],
      ctaKey: 'activeCta',
      href: '/signup?plan=active',
      highlight: true,
    },
  ];

  return (
    <section id="pricing" className="py-20 px-6 text-center">
      <span className="text-xs font-semibold text-accent tracking-[2px] uppercase">
        {t('label')}
      </span>
      <h2 className="font-[family-name:var(--font-display)] text-[clamp(32px,4vw,48px)] font-bold text-txt mt-3 mb-2">
        {t('title')}
      </h2>
      <p className="text-[17px] text-txt-muted mb-12">
        {t('subtitle')}
      </p>

      <div className="flex gap-5 justify-center flex-wrap max-w-[600px] mx-auto">
        {PLANS.map((plan) => (
          <div
            key={plan.nameKey}
            className={`flex-1 min-w-[240px] max-w-[270px] rounded-[var(--radius-card)] p-8 text-left relative ${
              plan.highlight
                ? 'bg-accent/8 border border-accent/30'
                : 'bg-card border border-border'
            }`}
          >
            {plan.badgeKey && (
              <div
                className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent rounded-full px-3.5 py-0.5 text-xs font-bold text-white"
              >
                {t(plan.badgeKey)}
              </div>
            )}

            <h3 className="text-xl font-bold text-txt mb-1">{t(plan.nameKey)}</h3>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="font-[family-name:var(--font-display)] text-4xl font-extrabold text-txt">{t(plan.priceKey)}</span>
              <span className="text-[15px] text-txt-muted">{t(plan.periodKey)}</span>
            </div>

            {plan.features.map((f) => (
              <div key={f} className="flex items-center gap-2 py-1.5 text-[15px] text-txt-muted">
                <span className="text-success text-xs">&#10003;</span> {t(f)}
              </div>
            ))}

            <Link
              href={plan.href}
              className={`block w-full text-center mt-5 py-2.5 rounded-[var(--radius-btn)] text-[15px] font-semibold transition-all ${
                plan.highlight
                  ? 'bg-accent text-white hover:opacity-90'
                  : 'border border-border text-txt-muted hover:bg-elevated'
              }`}
            >
              {t(plan.ctaKey)}
            </Link>
          </div>
        ))}
      </div>

      <p className="text-[13px] text-txt-dim mt-8">
        {t('trustLine')}
      </p>
    </section>
  );
}
