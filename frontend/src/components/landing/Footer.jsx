'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations('Footer');

  return (
    <footer className="border-t border-border mt-10">
      <div className="max-w-6xl mx-auto px-6 py-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-lg">⚔️</span>
          <span className="font-[family-name:var(--font-display)] font-bold text-sm text-txt-dim tracking-wider">{t('brand')}</span>
        </div>
        <p className="text-[13px] text-txt-dim">
          {t('copyright', { year: new Date().getFullYear() })}
          {' '}&middot;{' '}
          <Link href="/privacy" className="text-txt-dim hover:text-accent transition-colors">{t('privacy')}</Link>
          {' '}&middot;{' '}
          <a href="mailto:support@evolved.ai" className="text-txt-dim hover:text-accent transition-colors">{t('contact')}</a>
        </p>
      </div>
    </footer>
  );
}
