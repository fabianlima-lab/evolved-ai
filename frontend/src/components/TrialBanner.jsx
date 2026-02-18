'use client';

import { useTranslations } from 'next-intl';
import { KAJABI_CHECKOUT_URL } from '@/lib/constants';

export default function TrialBanner({ trialEndsAt }) {
  const t = useTranslations('TrialBanner');

  if (!trialEndsAt) return null;

  const now = new Date();
  const end = new Date(trialEndsAt);
  const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

  if (daysLeft <= 0) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-[var(--radius-btn)] px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm text-danger font-medium">{t('expired')}</span>
        <a
          href={KAJABI_CHECKOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-danger hover:underline"
        >
          {t('upgradeNow')}
        </a>
      </div>
    );
  }

  return (
    <div className="bg-accent-glow border border-[rgba(232,99,43,0.3)] rounded-[var(--radius-btn)] px-4 py-2.5 flex items-center justify-between">
      <span className="text-sm text-txt-body">
        {t('freeTrial')} &middot; <strong className="text-txt">{daysLeft === 1 ? t('daysLeft', { count: daysLeft }) : t('daysLeftPlural', { count: daysLeft })}</strong>
      </span>
      <a
        href={KAJABI_CHECKOUT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-accent hover:underline"
      >
        {t('upgrade')}
      </a>
    </div>
  );
}
