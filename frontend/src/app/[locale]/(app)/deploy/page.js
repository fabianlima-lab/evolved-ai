'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import SectionLabel from '@/components/ui/SectionLabel';
import { apiFetch } from '@/lib/api';

export default function DeployPage() {
  const t = useTranslations('Deploy');
  const [agent, setAgent] = useState(null);
  const router = useRouter();

  useEffect(() => {
    apiFetch('/agents/mine')
      .then((data) => {
        const list = Array.isArray(data) ? data : data.agents || [];
        if (list.length > 0) {
          const active = list.find((a) => a.isActive || a.is_active) || list[0];
          setAgent(active);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-center">
      <SectionLabel>{t('step')}</SectionLabel>

      <div className="mt-8 mb-6">
        <div className="relative w-40 h-40 mx-auto">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse bg-accent"
          />
          <div className="relative w-full h-full rounded-full bg-accent/20 flex items-center justify-center text-accent text-5xl font-bold border-2 border-border">
            {agent?.name?.charAt(0) || '✓'}
          </div>
        </div>
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl text-txt mt-6">
        {t('title')}
      </h1>

      {agent && (
        <div className="mt-3">
          <span className="font-[family-name:var(--font-display)] text-2xl text-txt">
            {agent.name}
          </span>
        </div>
      )}

      <p className="text-txt-muted mt-6 max-w-md mx-auto">
        {t('description')}
      </p>

      <div className="mt-10">
        <Button
          onClick={() => router.push('/dashboard')}
          className="px-10"
        >
          {t('goToDashboard')}
        </Button>
      </div>
    </div>
  );
}
