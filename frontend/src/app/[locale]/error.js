'use client';

import { useTranslations } from 'next-intl';

export default function Error({ reset }) {
  const t = useTranslations('Error');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-txt">{t('title')}</h1>
      <p className="text-txt-muted">{t('message')}</p>
      <button
        onClick={() => reset()}
        className="bg-accent text-brand-cream px-6 py-3 rounded-[var(--radius-btn)] text-sm font-semibold uppercase tracking-[0.2em] hover:opacity-90 transition-all cursor-pointer"
      >
        {t('tryAgain')}
      </button>
    </div>
  );
}
