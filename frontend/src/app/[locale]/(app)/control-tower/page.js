'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { apiFetch } from '@/lib/api';

const REFRESH_INTERVAL_MS = 60_000;

// ── Local Components ──

function StatusDot({ ok, size = 8 }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: ok ? 'var(--color-success)' : 'var(--color-danger)',
      }}
    />
  );
}

function PulseCard({ label, value, status }) {
  return (
    <Card className="p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        {status !== undefined && <StatusDot ok={status} />}
        <p className="text-3xl font-[family-name:var(--font-display)] text-txt">
          {value !== null && value !== undefined ? value.toLocaleString() : '\u2014'}
        </p>
      </div>
      <p className="text-xs text-txt-muted uppercase tracking-wider">{label}</p>
    </Card>
  );
}

function FunnelBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-txt-muted w-20 capitalize">{label}</span>
      <div className="flex-1 h-3 bg-elevated rounded-[var(--radius-card)] overflow-hidden">
        <div
          className={`h-full rounded-[var(--radius-card)] ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-txt-dim w-8 text-right font-medium">{count}</span>
    </div>
  );
}

function BarChart({ data, color = 'bg-accent' }) {
  if (!data?.length) return <p className="text-xs text-txt-dim">No data</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div>
      <p className="text-xs text-txt-dim mb-2 text-right">{`Peak: ${max}/day`}</p>
      <div className="flex items-end gap-[2px] h-24">
        {data.map(d => (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center justify-end"
            title={`${d.date}: ${d.count}`}
          >
            <div
              className={`w-full ${color} rounded-t-sm transition-all cursor-default hover:opacity-80`}
              style={{
                height: `${(d.count / max) * 100}%`,
                minHeight: d.count > 0 ? '2px' : '0',
              }}
            />
          </div>
        ))}
      </div>
      {data.length > 1 && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-txt-dim">{data[0].date.slice(5)}</span>
          <span className="text-[10px] text-txt-dim">{data[data.length - 1].date.slice(5)}</span>
        </div>
      )}
    </div>
  );
}

function PersonRow({ email, detail, badge, badgeColor = 'bg-txt-muted/20 text-txt-muted' }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">
        {(email || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-txt truncate">{email}</p>
        {detail && <p className="text-xs text-txt-muted">{detail}</p>}
      </div>
      {badge && (
        <span className={`text-[10px] px-2 py-0.5 rounded-[var(--radius-card)] whitespace-nowrap ${badgeColor}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds) return '0s';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Main Page ──

export default function ControlTowerPage() {
  const t = useTranslations('ControlTower');
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await apiFetch('/admin/control-tower');
      setData(result);
      setLastRefreshed(new Date());
      setLoading(false);
    } catch (err) {
      if (err.status === 403) {
        setDenied(true);
        setLoading(false);
      } else if (err.status === 401) {
        router.push('/login');
      }
    }
  }, [router]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 animate-pulse space-y-6">
        <div className="h-8 w-64 bg-elevated rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-20 bg-card border border-border rounded-[var(--radius-card)]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48 bg-card border border-border rounded-[var(--radius-card)]" />
          <div className="h-48 bg-card border border-border rounded-[var(--radius-card)]" />
        </div>
      </div>
    );
  }

  // Access denied
  if (denied) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 text-center">
        <p className="text-2xl font-[family-name:var(--font-display)] text-txt">{t('accessDenied')}</p>
      </div>
    );
  }

  const { pulse, funnel, engagement, system, growth, recent_signups, top_engaged, at_risk } = data || {};
  const funnelTotal = (funnel?.trial || 0) + (funnel?.active || 0) + (funnel?.past_due || 0) + (funnel?.cancelled || 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">{t('title')}</h1>
          {lastRefreshed && (
            <p className="text-xs text-txt-muted mt-1">
              {t('lastRefreshed')}: {lastRefreshed.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <StatusDot ok={system?.openclaw_status === 'ok'} />
            <span className="text-xs text-txt-muted">{t('live')}</span>
          </div>
          <button
            onClick={fetchData}
            className="text-xs text-accent hover:underline"
          >
            {t('refresh')}
          </button>
        </div>
      </div>

      {/* Section 1: Pulse — 6 metric cards */}
      <section>
        <SectionLabel>{t('pulse')}</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-3">
          <PulseCard label={t('totalUsers')} value={pulse?.total_subscribers} />
          <PulseCard label={t('active7d')} value={pulse?.active_7d} />
          <PulseCard label={t('active24h')} value={pulse?.active_24h} />
          <PulseCard label={t('whatsappConnected')} value={pulse?.whatsapp_connected} />
          <PulseCard label={t('agentsDeployed')} value={pulse?.agents_deployed} />
          <PulseCard
            label={t('openclawStatus')}
            value={pulse?.openclaw_status === 'ok' ? t('ok') : t('down')}
            status={pulse?.openclaw_status === 'ok'}
          />
        </div>
      </section>

      {/* Section 2: Funnel + Engagement — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('funnel')}</h3>
          <div className="space-y-3">
            <FunnelBar label={t('trial')} count={funnel?.trial || 0} total={funnelTotal} color="bg-txt-muted" />
            <FunnelBar label={t('active')} count={funnel?.active || 0} total={funnelTotal} color="bg-accent" />
            <FunnelBar label={t('pastDue')} count={funnel?.past_due || 0} total={funnelTotal} color="bg-[#D4816B]" />
            <FunnelBar label={t('cancelled')} count={funnel?.cancelled || 0} total={funnelTotal} color="bg-danger" />
          </div>
          {funnel?.trial_converting_soon > 0 && (
            <p className="text-xs text-accent mt-4 flex items-center gap-1">
              <span>&#9889;</span> {funnel.trial_converting_soon} {t('convertingSoon')}
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('engagement')}</h3>
          <div className="space-y-2">
            {[
              [t('messagesToday'), engagement?.messages_today],
              [t('messages7d'), engagement?.messages_7d],
              [t('messages30d'), engagement?.messages_30d],
              [t('avgPerUser'), engagement?.avg_messages_per_active_user_7d],
              [t('skillsActive'), engagement?.skills_activated_total],
              [t('integrationsConnected'), engagement?.integrations_connected_total],
              [t('googleConnected'), engagement?.google_connected],
              [t('intentionsToday'), engagement?.daily_intentions_today],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-1">
                <span className="text-xs text-txt-muted">{label}</span>
                <span className="text-sm text-txt font-medium">{value?.toLocaleString() ?? '\u2014'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Section 3: Sparklines — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('signups7d')}</h3>
          <BarChart data={growth?.signups_7d} color="bg-accent" />
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('messageVolume7d')}</h3>
          <BarChart data={growth?.messages_7d} color="bg-mint" />
        </Card>
      </div>

      {/* Section 4: People — 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent Signups */}
        <Card className="p-5">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-3">{t('recentSignups')}</h3>
          {recent_signups?.length > 0 ? (
            <div className="divide-y divide-border/50">
              {recent_signups.map((s, i) => (
                <PersonRow
                  key={i}
                  email={s.email}
                  detail={timeAgo(s.created_at)}
                  badge={s.tier}
                  badgeColor={s.tier === 'active' ? 'bg-accent/20 text-accent' : 'bg-txt-muted/20 text-txt-muted'}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-txt-dim">{t('noData')}</p>
          )}
        </Card>

        {/* Top Engaged */}
        <Card className="p-5">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-3">{t('topEngaged')}</h3>
          {top_engaged?.length > 0 ? (
            <div className="divide-y divide-border/50">
              {top_engaged.map((u, i) => (
                <PersonRow
                  key={i}
                  email={u.email}
                  detail={`${u.agent_name || 'Agent'} \u00B7 L${u.agent_level}`}
                  badge={`${u.message_count_7d} ${t('messages')}`}
                  badgeColor="bg-accent/20 text-accent"
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-txt-dim">{t('noData')}</p>
          )}
        </Card>

        {/* At Risk */}
        <Card className="p-5">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="text-danger">&#9888;</span> {t('atRisk')}
          </h3>
          {at_risk?.length > 0 ? (
            <div className="divide-y divide-border/50">
              {at_risk.map((s, i) => (
                <PersonRow
                  key={i}
                  email={s.email}
                  detail={s.reason === 'trial_expiring'
                    ? `${t('trialExpiring')} \u00B7 ${timeAgo(s.trial_ends_at).replace(' ago', '')}`
                    : t('paymentFailed')
                  }
                  badge={s.tier}
                  badgeColor="bg-danger/10 text-danger"
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-txt-dim">{t('noData')}</p>
          )}
        </Card>
      </div>

      {/* Section 5: System Health */}
      <Card className="p-5">
        <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('systemHealth')}</h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <StatusDot ok={true} />
            <span className="text-xs text-txt-muted">{t('serverUptime')}:</span>
            <span className="text-xs text-txt font-medium">{formatUptime(system?.server_uptime_seconds)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-txt-muted">{t('memory')}:</span>
            <span className="text-xs text-txt font-medium">{system?.memory_mb || 0}MB</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={system?.whatsapp_status === 'connected'} />
            <span className="text-xs text-txt-muted">{t('whatsapp')}:</span>
            <span className="text-xs text-txt font-medium">
              {system?.whatsapp_status === 'connected' ? t('connected') : t('disconnected')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={system?.openclaw_status === 'ok'} />
            <span className="text-xs text-txt-muted">{t('openclaw')}:</span>
            <span className="text-xs text-txt font-medium">
              {system?.openclaw_status === 'ok' ? t('ok') : t('down')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-txt-muted">{t('lastMessage')}:</span>
            <span className="text-xs text-txt font-medium">{timeAgo(system?.last_message_at)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
