'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import { apiFetch, apiPost } from '@/lib/api';

/* ── Icon map: backend stores icon as a string slug, we render emoji ── */
const ICON_MAP = {
  'sunrise': '🌅',
  'message-circle': '💬',
  'search': '🔍',
  'check-square': '✅',
  'brain': '🧠',
  'bell': '🔔',
  'calendar': '📅',
  'mail': '✉️',
  'hard-drive': '📁',
  'globe': '🌐',
  'zap': '⚡',
  'shield': '🛡️',
  'star': '⭐',
  'heart': '❤️',
  'book': '📖',
};

const CATEGORY_LABELS = {
  communication: 'Communication',
  productivity: 'Productivity',
  research: 'Research',
  wellness: 'Wellness',
};

export default function SkillsPage() {
  const t = useTranslations('Skills');
  const [skills, setSkills] = useState(null);
  const [activating, setActivating] = useState(null);

  useEffect(() => {
    apiFetch('/evolution/skills')
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]));
  }, []);

  const handleActivate = async (slug) => {
    setActivating(slug);
    try {
      await apiPost(`/evolution/skills/${slug}/activate`);
      // Refresh skills list
      const data = await apiFetch('/evolution/skills');
      setSkills(Array.isArray(data) ? data : []);
    } catch {
      // Silently fail — could show toast
    } finally {
      setActivating(null);
    }
  };

  const STATUS_STYLES = {
    active: { label: t('active'), color: 'text-success', bg: 'bg-success/10' },
    available: { label: t('available'), color: 'text-accent', bg: 'bg-accent/10' },
    coming_soon: { label: t('comingSoon'), color: 'text-txt-dim', bg: 'bg-elevated' },
  };

  // Loading state
  if (skills === null) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">{t('title')}</h1>
        <div className="mt-8 flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Group skills by category
  const grouped = {};
  for (const skill of skills) {
    const cat = skill.category || 'productivity';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(skill);
  }

  const activeCount = skills.filter((s) => s.status === 'active').length;
  const availableCount = skills.filter((s) => s.status === 'available').length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">{t('title')}</h1>

      {/* Summary bar */}
      <div className="flex items-center gap-4 mt-4 text-sm">
        <span className="text-success font-medium">{activeCount} {t('active')}</span>
        <span className="text-txt-dim">·</span>
        <span className="text-accent font-medium">{availableCount} {t('available')}</span>
      </div>

      {/* Skill categories */}
      <div className="mt-8 space-y-8">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">
              {CATEGORY_LABELS[category] || category}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((skill) => {
                const style = STATUS_STYLES[skill.status] || STATUS_STYLES.available;
                const dimmed = skill.status === 'coming_soon';
                const canActivate = skill.status === 'available';
                return (
                  <Card
                    key={skill.slug}
                    className={`p-4 flex items-center gap-4 ${dimmed ? 'opacity-50' : ''}`}
                  >
                    <span className="text-2xl">{ICON_MAP[skill.icon] || '⚙️'}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-txt font-medium block">{skill.name}</span>
                      {skill.description && (
                        <span className="text-xs text-txt-muted block mt-0.5 truncate">{skill.description}</span>
                      )}
                    </div>
                    {canActivate ? (
                      <button
                        onClick={() => handleActivate(skill.slug)}
                        disabled={activating === skill.slug}
                        className="text-xs font-medium px-3 py-1.5 rounded-[var(--radius-btn)] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {activating === skill.slug ? '...' : 'Activate'}
                      </button>
                    ) : (
                      <span className={`text-xs font-medium px-2 py-1 rounded-[var(--radius-card)] ${style.color} ${style.bg}`}>
                        {style.label}
                      </span>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

        {skills.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-txt-muted text-center">
              No skills available yet. Deploy your assistant first.
            </p>
          </Card>
        )}
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
