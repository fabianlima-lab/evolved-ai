'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SectionLabel from '@/components/ui/SectionLabel';
import { GOAL_OPTIONS } from '@/lib/constants';
import { apiPost } from '@/lib/api';

export default function OnboardingPage() {
  const t = useTranslations('Onboarding');
  const tGoals = useTranslations('Goals');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      await apiPost('/subscribers/goals', { goals: selected });
    } catch {
      // Non-blocking — continue even if save fails
    }
    router.push('/agents');
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <SectionLabel>{t('step')}</SectionLabel>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt mt-3">
          {t('title')}
        </h1>
        <p className="text-txt-muted mt-2">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GOAL_OPTIONS.map((goal) => {
          const active = selected.includes(goal.id);
          return (
            <Card
              key={goal.id}
              className={`p-5 cursor-pointer transition-all duration-200 ${
                active
                  ? 'ring-2 ring-accent border-transparent'
                  : 'hover:border-elevated'
              }`}
              onClick={() => toggle(goal.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{goal.icon}</span>
                <span className="text-txt font-medium">{tGoals(goal.labelKey)}</span>
                {active && (
                  <span className="ml-auto text-accent text-lg">✓</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <Button
          onClick={handleContinue}
          loading={loading}
          disabled={selected.length === 0}
          className="px-10"
        >
          {t('continue')}
        </Button>
      </div>
    </div>
  );
}
