'use client';

import { useTranslations } from 'next-intl';

const ICONS = ['📧', '💔', '📅', '🧠'];

export default function PainPointsSection() {
  const t = useTranslations('Landing');

  const items = [
    { icon: ICONS[0], title: t('pain1Title'), body: t('pain1Body') },
    { icon: ICONS[1], title: t('pain2Title'), body: t('pain2Body') },
    { icon: ICONS[2], title: t('pain3Title'), body: t('pain3Body') },
    { icon: ICONS[3], title: t('pain4Title'), body: t('pain4Body') },
  ];

  return (
    <section className="bg-brand-mint-bg py-20 lg:py-28">
      <div className="max-w-[1200px] mx-auto px-6">
        <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-light text-brand-charcoal text-center tracking-[-0.01em]">
          {t('painTitle')}
        </h2>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, i) => (
            <div
              key={i}
              className="bg-brand-cream border border-brand-beige/40 p-6 shadow-[0_4px_20px_rgba(34,34,34,0.06)] hover:shadow-[0_8px_30px_rgba(34,34,34,0.1)] hover:-translate-y-1 transition-all duration-400"
              style={{ borderRadius: '2px' }}
            >
              <span className="text-3xl">{item.icon}</span>
              <h3 className="mt-4 text-lg font-[family-name:var(--font-display)] font-medium text-brand-charcoal">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-brand-brown leading-relaxed">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
