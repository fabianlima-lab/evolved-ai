'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import TrialBanner from '@/components/TrialBanner';
import ChatPanel from '@/components/ChatPanel';
import { apiFetch } from '@/lib/api';

export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const tCommon = useTranslations('Common');
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const router = useRouter();

  useEffect(() => {
    apiFetch('/dashboard/stats').then(setStats).catch(() => {});
    apiFetch('/agents/mine')
      .then((data) => {
        const list = Array.isArray(data) ? data : data.agents || [];
        setAgents(list);
      })
      .catch(() => {});
    apiFetch('/dashboard/messages?limit=4')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setMessages(list);
      })
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 animate-pulse space-y-6">
        <div className="h-8 w-48 bg-elevated rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-card border border-border rounded-[var(--radius-card)]" />
          ))}
        </div>
      </div>
    );
  }

  const maxAgents = stats.max_agents || 1;
  const hasMultiple = agents.length > 1;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
      {stats.tier === 'trial' && (
        <TrialBanner trialEndsAt={stats.trial_ends_at} />
      )}

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-txt mb-6">
          {hasMultiple ? t('yourAssistants') : t('yourAssistant')}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {agents.map((agent) => (
              <Card key={agent.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent text-2xl font-bold shrink-0">
                    {(agent.name || 'A').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-[family-name:var(--font-display)] text-lg text-txt">
                      {agent.name || 'Assistant'}
                    </h3>
                    <span className="text-xs text-accent uppercase tracking-wider font-medium">
                      Active
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-txt-muted">
                  <span>{t('msgsToday', { count: stats.messages_today || 0 })}</span>
                  <span>{t('msgsMonth', { count: stats.messages_this_month || 0 })}</span>
                </div>
              </Card>
            ))}

            {agents.length < maxAgents && (
              <Card
                className="p-6 border-dashed cursor-pointer hover:border-accent transition-colors"
                onClick={() => router.push('/agents')}
              >
                <div className="flex flex-col items-center justify-center h-full gap-3 text-txt-muted">
                  <span className="text-4xl">+</span>
                  <span className="text-sm">
                    {maxAgents - agents.length !== 1
                      ? t('addAssistantPlural', { count: maxAgents - agents.length })
                      : t('addAssistant', { count: maxAgents - agents.length })}
                  </span>
                </div>
              </Card>
            )}
          </div>

          <div className="lg:col-span-3">
            {agents.length > 0 && (
              <ChatPanel agent={{ name: agents[0].name || 'Assistant' }} />
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('recentActivity')}</h3>
          {messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    msg.role === 'user' ? 'bg-accent' : 'bg-success'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm text-txt-body truncate">{msg.content}</p>
                    <p className="text-xs text-txt-dim">
                      {new Date(msg.createdAt || msg.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-txt-dim">{t('noMessages')}</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('activeSkills')}</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm text-txt-body">{t('whatsapp')}</span>
              <span className="text-xs text-success ml-auto">{t('active')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm text-txt-body">{t('webSearch')}</span>
              <span className="text-xs text-accent ml-auto">{t('builtIn')}</span>
            </div>
          </div>
          <Link href="/dashboard/skills" className="text-sm text-accent hover:underline mt-4 inline-block">
            {t('manage')}
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('quickActions')}</h3>
          <div className="space-y-3">
            <Button variant="ghost" className="w-full text-left text-sm" onClick={() => router.push('/agents')}>
              {t('manageAssistant')}
            </Button>
            {stats.tier === 'trial' && (
              <Button variant="ghost" className="w-full text-left text-sm" onClick={() => router.push('/upgrade')}>
                {t('upgradePlan')}
              </Button>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-success animate-pulse" />
            <div>
              <span className="text-sm text-txt font-medium">{t('gatewayOnline')}</span>
              <span className="text-xs text-txt-dim ml-3">
                {t('lastHeartbeat')} {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-xs border-danger/30 text-danger hover:bg-danger/10"
            onClick={() => setShowResetDialog(true)}
          >
            {t('resetGateway')}
          </Button>
        </div>
      </Card>

      {showResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <Card className="p-8 max-w-md mx-4">
            <h3 className="font-[family-name:var(--font-display)] text-xl text-txt">{t('resetTitle')}</h3>
            <p className="text-sm text-txt-muted mt-3">{t('resetDesc')}</p>
            <div className="flex gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowResetDialog(false)} className="flex-1">
                {tCommon('cancel')}
              </Button>
              <Button variant="danger" onClick={() => { apiFetch('/gateway/reset', { method: 'POST' }).catch(() => {}); setShowResetDialog(false); }} className="flex-1">
                {t('confirmReset')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
