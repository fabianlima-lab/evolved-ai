'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function Footer() {
  const t = useTranslations('Landing');

  return (
    <footer className="py-12 px-6 lg:px-12 text-center" style={{ background: '#0f1f14', color: 'rgba(247, 244, 238, 0.4)' }}>
      {/* Logo */}
      <div className="font-[family-name:var(--font-display)] text-[1.2rem] font-semibold mb-4" style={{ color: 'rgba(247, 244, 238, 0.6)' }}>
        {t('footerTagline')}
      </div>

      {/* Links */}
      <ul className="flex justify-center gap-8 list-none mb-6 flex-wrap">
        <li>
          <a href="https://evolvedvets.com" target="_blank" rel="noopener noreferrer" className="text-[0.7rem] uppercase tracking-[0.15em] no-underline hover:text-brand-teal transition-colors" style={{ color: 'rgba(247, 244, 238, 0.4)' }}>
            {t('footerHome')}
          </a>
        </li>
        <li>
          <a href="https://evolvedvets.com/coaching" target="_blank" rel="noopener noreferrer" className="text-[0.7rem] uppercase tracking-[0.15em] no-underline hover:text-brand-teal transition-colors" style={{ color: 'rgba(247, 244, 238, 0.4)' }}>
            {t('footerCoaching')}
          </a>
        </li>
        <li>
          <a href="https://evolvedvets.com/membership" target="_blank" rel="noopener noreferrer" className="text-[0.7rem] uppercase tracking-[0.15em] no-underline hover:text-brand-teal transition-colors" style={{ color: 'rgba(247, 244, 238, 0.4)' }}>
            {t('footerMembership')}
          </a>
        </li>
        <li>
          <a href="https://evolvedvets.com/podcast" target="_blank" rel="noopener noreferrer" className="text-[0.7rem] uppercase tracking-[0.15em] no-underline hover:text-brand-teal transition-colors" style={{ color: 'rgba(247, 244, 238, 0.4)' }}>
            {t('footerPodcast')}
          </a>
        </li>
        <li>
          <Link href="/privacy" className="text-[0.7rem] uppercase tracking-[0.15em] no-underline hover:text-brand-teal transition-colors" style={{ color: 'rgba(247, 244, 238, 0.4)' }}>
            {t('footerPrivacy')}
          </Link>
        </li>
        <li>
          <Link href="/terms" className="text-[0.7rem] uppercase tracking-[0.15em] no-underline hover:text-brand-teal transition-colors" style={{ color: 'rgba(247, 244, 238, 0.4)' }}>
            {t('footerTerms')}
          </Link>
        </li>
      </ul>

      {/* Copyright */}
      <p className="text-[0.7rem] tracking-[0.05em]">
        {t('footerCopyright')}
      </p>
    </footer>
  );
}
