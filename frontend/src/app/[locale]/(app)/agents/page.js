'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SectionLabel from '@/components/ui/SectionLabel';
import { apiPost } from '@/lib/api';

export default function AgentsPage() {
  const t = useTranslations('Agents');
  const [name, setName] = useState('');
  const [deploying, setDeploying] = useState(false);
  const router = useRouter();

  const handleDeploy = async () => {
    if (!name.trim()) return;

    setDeploying(true);
    try {
      await apiPost('/agents/deploy', {
        name: name.trim(),
        systemPrompt: `You are ${name.trim()}, a personal AI assistant created by Evolved AI. You are warm, polished, calm, capable, and empowering. Help the user with whatever they need.`,
      });
      router.push('/channel');
    } catch (err) {
      console.error('Deploy failed:', err.message);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <SectionLabel>{t('step')}</SectionLabel>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt mt-3">
          {t('title')}
        </h1>
      </div>

      <Card className="p-8">
        <div className="space-y-6">
          <Input
            label={t('nameLabel')}
            id="agent-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            maxLength={100}
          />
        </div>
      </Card>

      <div className="mt-10 text-center">
        <Button
          onClick={handleDeploy}
          loading={deploying}
          disabled={!name.trim()}
          className="px-10"
        >
          {name.trim() ? t('deploy', { name: name.trim() }) : t('deployDefault')}
        </Button>
      </div>
    </div>
  );
}
