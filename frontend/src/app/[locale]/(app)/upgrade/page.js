'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { apiPost } from '@/lib/api';

export default function UpgradePage() {
  const t = useTranslations('Upgrade');
  const [loading, setLoading] = useState(null);

  const PLANS = [
    {
      id: 'pro',
      nameKey: 'proName',
      priceKey: 'proPrice',
      periodKey: 'proPeriod',
      featureKeys: [
        'feature_1agent',
        'feature_telegram',
        'feature_unlimited',
        'feature_search',
        'feature_customName',
        'feature_memory',
      ],
    },
    {
      id: 'pro_tribe',
      nameKey: 'proTribeName',
      priceKey: 'proTribePrice',
      periodKey: 'proTribePeriod',
      featureKeys: [
        'feature_3agents',
        'feature_allPro',
        'feature_priority',
      ],
    },
  ];

  const handleChoose = async (plan) => {
    setLoading(plan);
    try {
      const data = await apiPost('/billing/checkout', { plan });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout failed:', err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">
          {t('title')}
        </h1>
        <p className="text-txt-muted mt-3">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
        {PLANS.map((plan) => (
          <Card key={plan.id} className="p-8 flex flex-col">
            <h3 className="font-[family-name:var(--font-display)] text-2xl text-txt">{t(plan.nameKey)}</h3>
            <div className="mt-4">
              <span className="text-4xl font-bold text-txt">{t(plan.priceKey)}</span>
              <span className="text-txt-muted text-sm">{t(plan.periodKey)}</span>
            </div>
            <ul className="mt-6 space-y-3 flex-1">
              {plan.featureKeys.map((fKey) => (
                <li key={fKey} className="flex items-start gap-2 text-sm text-txt-body">
                  <span className="text-success mt-0.5">✓</span>
                  {t(fKey)}
                </li>
              ))}
            </ul>
            <Button
              onClick={() => handleChoose(plan.id)}
              loading={loading === plan.id}
              className="w-full mt-8"
            >
              {t('choose', { name: t(plan.nameKey) })}
            </Button>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-txt-dim mt-8">
        {t('secureCheckout')}
      </p>
    </div>
  );
}
