'use client';

import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';

export default function SkillsPage() {
  const t = useTranslations('Skills');

  const SKILLS = [
    {
      categoryKey: 'messaging',
      items: [
        { nameKey: 'whatsapp', status: 'active', icon: '💬' },
      ],
    },
    {
      categoryKey: 'productivity',
      items: [
        { nameKey: 'gmail', status: 'not_connected', icon: '✉️' },
        { nameKey: 'googleCalendar', status: 'not_connected', icon: '📅' },
        { nameKey: 'notion', status: 'not_connected', icon: '📝' },
        { nameKey: 'googleDrive', status: 'not_connected', icon: '📁' },
      ],
    },
    {
      categoryKey: 'creative',
      items: [
        { nameKey: 'midjourney', status: 'not_connected', icon: '🎨' },
        { nameKey: 'canva', status: 'not_connected', icon: '🖼️' },
      ],
    },
    {
      categoryKey: 'development',
      items: [
        { nameKey: 'github', status: 'not_connected', icon: '🐙' },
        { nameKey: 'vercel', status: 'not_connected', icon: '▲' },
      ],
    },
    {
      categoryKey: 'builtInCategory',
      items: [
        { nameKey: 'webSearch', status: 'built_in', icon: '🌐' },
        { nameKey: 'persistentMemory', status: 'built_in', icon: '🧠' },
      ],
    },
  ];

  const STATUS_STYLES = {
    active: { labelKey: 'active', color: 'text-success', bg: 'bg-success/10' },
    built_in: { labelKey: 'builtIn', color: 'text-accent', bg: 'bg-accent/10' },
    not_connected: { labelKey: 'notConnected', color: 'text-txt-dim', bg: 'bg-elevated' },
    coming_soon: { labelKey: 'comingSoon', color: 'text-txt-dim', bg: 'bg-elevated' },
  };

  const activeCount = SKILLS.flatMap((c) => c.items).filter((i) => i.status === 'active').length;
  const builtInCount = SKILLS.flatMap((c) => c.items).filter((i) => i.status === 'built_in').length;
  const availableCount = SKILLS.flatMap((c) => c.items).filter((i) => i.status === 'not_connected').length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">{t('title')}</h1>

      {/* Summary bar */}
      <div className="flex items-center gap-4 mt-4 text-sm">
        <span className="text-success font-medium">{activeCount} {t('active')}</span>
        <span className="text-txt-dim">·</span>
        <span className="text-accent font-medium">{builtInCount} {t('builtIn')}</span>
        <span className="text-txt-dim">·</span>
        <span className="text-txt-muted">{availableCount} {t('available')}</span>
      </div>

      {/* Skill categories */}
      <div className="mt-8 space-y-8">
        {SKILLS.map((category) => (
          <div key={category.categoryKey}>
            <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">
              {t(category.categoryKey)}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {category.items.map((skill) => {
                const style = STATUS_STYLES[skill.status];
                const dimmed = skill.status === 'not_connected' || skill.status === 'coming_soon';
                return (
                  <Card
                    key={skill.nameKey}
                    className={`p-4 flex items-center gap-4 ${dimmed ? 'opacity-50' : ''}`}
                  >
                    <span className="text-2xl">{skill.icon}</span>
                    <div className="flex-1">
                      <span className="text-sm text-txt font-medium">{t(skill.nameKey)}</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-[var(--radius-card)] ${style.color} ${style.bg}`}>
                      {t(style.labelKey)}
                    </span>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Help callout */}
      <Card className="mt-8 p-6">
        <p className="text-sm text-txt-muted">
          {t('helpText')}
        </p>
      </Card>
    </div>
  );
}
