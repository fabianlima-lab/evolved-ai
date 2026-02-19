'use client';

import { useTranslations } from 'next-intl';
import { KAJABI_CHECKOUT_URL } from '@/lib/constants';

export default function PricingSection() {
  const t = useTranslations('Landing');

  const features = Array.from({ length: 16 }, (_, i) => t(`pricingFeat${i + 1}`));

  return (
    <section id="pricing" className="py-24 px-6 lg:px-12 bg-brand-mint">
      <div className="max-w-[620px] mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-brand-teal font-semibold mb-6">
            {t('pricingEyebrow')}
          </p>
          <h2
            className="font-[family-name:var(--font-display)] font-light leading-[1.25] text-brand-charcoal"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            {t('pricingTitle')} <em className="italic text-brand-teal">{t('pricingTitleEm')}</em>
          </h2>
        </div>

        {/* Pricing Card */}
        <div className="bg-white px-12 py-14 text-center relative border-2 border-brand-teal transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.06)]">
          {/* Badge */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-teal text-brand-deep-green text-[0.6rem] uppercase tracking-[0.2em] font-bold px-6 py-1.5">
            {t('pricingBadge')}
          </div>

          {/* Name & Tagline */}
          <div className="font-[family-name:var(--font-display)] text-[1.8rem] font-medium text-brand-charcoal mb-1">
            {t('pricingName')}
          </div>
          <div className="text-[0.78rem] text-brand-text-light font-light italic mb-6">
            {t('pricingTagline')}
          </div>

          {/* Price */}
          <div className="mb-1">
            <strong className="font-[family-name:var(--font-display)] text-[3.5rem] text-brand-charcoal font-normal">
              {t('pricingPrice')}
            </strong>
            <span className="text-[0.85rem] text-brand-text-light font-normal">
              {t('pricingPeriod')}
            </span>
          </div>
          {/* Divider */}
          <div className="w-10 h-px bg-brand-sand mx-auto mb-8" />

          {/* Features - 2 columns */}
          <ul className="text-left list-none mb-10 columns-1 sm:columns-2 gap-8">
            {features.map((feat, i) => (
              <li
                key={i}
                className="text-[0.82rem] text-brand-brown py-2 pl-6 relative font-light leading-[1.5] break-inside-avoid"
              >
                <span className="absolute left-0 top-[0.65rem] text-[0.6rem] text-brand-teal">✦</span>
                {feat}
              </li>
            ))}
          </ul>

          {/* CTA Button */}
          <a
            href={KAJABI_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 text-[0.72rem] uppercase tracking-[0.2em] font-semibold bg-brand-teal text-brand-deep-green hover:bg-brand-deep-green hover:text-brand-cream hover:shadow-[0_8px_30px_rgba(22,43,29,0.2)] transition-all duration-300 no-underline text-center mb-4"
          >
            {t('pricingCta')}
          </a>

          {/* Note */}
          <div className="text-[0.75rem] text-brand-text-light italic">
            {t('pricingNote')}
          </div>
        </div>

        {/* Add-on card */}
        <div className="mt-8 px-8 py-6 text-center border border-brand-teal/20" style={{ background: 'rgba(139, 196, 198, 0.08)' }}>
          <div className="font-[family-name:var(--font-display)] text-[1.1rem] font-medium text-brand-charcoal mb-1">
            {t('pricingAddonTitle')}
          </div>
          <div className="text-[0.78rem] text-brand-brown font-light leading-[1.6]">
            {t('pricingAddonDesc')}
          </div>
          <div className="text-[0.8rem] text-brand-teal-dark font-semibold mt-2">
            {t('pricingAddonPrice')}
          </div>
        </div>
      </div>
    </section>
  );
}
