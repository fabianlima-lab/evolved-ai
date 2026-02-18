'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { apiFetch } from '@/lib/api';

// ── Local components ──

function MetricCard({ label, value }) {
  return (
    <Card className="p-5">
      <p className="text-xs text-txt-muted uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-[family-name:var(--font-display)] text-txt mt-1">
        {value?.toLocaleString() ?? '—'}
      </p>
    </Card>
  );
}

function BarChart({ data, color = 'bg-accent', label }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div>
      {label && <p className="text-xs text-txt-dim mb-2 text-right">{`Peak: ${max}/day`}</p>}
      <div className="flex items-end gap-[2px] h-32">
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
      {data.length > 0 && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-txt-dim">{data[0].date.slice(5)}</span>
          <span className="text-[10px] text-txt-dim">{data[data.length - 1].date.slice(5)}</span>
        </div>
      )}
    </div>
  );
}

function TierBadge({ tier }) {
  const colors = {
    trial: 'bg-txt-muted/20 text-txt-muted',
    active: 'bg-accent/20 text-accent',
    cancelled: 'bg-danger/10 text-danger',
    // Legacy tiers (backwards compat)
    pro: 'bg-accent/20 text-accent',
    pro_tribe: 'bg-mint/60 text-accent',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${colors[tier] || colors.trial}`}>
      {tier.replace('_', ' ')}
    </span>
  );
}

// ── Main Page ──

export default function AdminPage() {
  const t = useTranslations('Admin');
  const router = useRouter();

  const [overview, setOverview] = useState(null);
  const [signups, setSignups] = useState(null);
  const [tiers, setTiers] = useState(null);
  const [users, setUsers] = useState(null);
  const [userTotal, setUserTotal] = useState(0);
  const [msgVolume, setMsgVolume] = useState(null);
  const [popularAgents, setPopularAgents] = useState(null);
  const [channels, setChannels] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  // Sort state for users table
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [userOffset, setUserOffset] = useState(0);

  // Check access + fetch all data
  useEffect(() => {
    apiFetch('/admin/overview')
      .then(data => {
        setOverview(data);
        setLoading(false);
        // Fetch rest in parallel
        apiFetch('/admin/signups?days=30').then(setSignups).catch(() => {});
        apiFetch('/admin/tiers').then(setTiers).catch(() => {});
        apiFetch('/admin/users?limit=50&offset=0').then(d => {
          setUsers(d.users);
          setUserTotal(d.total);
        }).catch(() => {});
        apiFetch('/admin/messages?days=30').then(setMsgVolume).catch(() => {});
        apiFetch('/admin/popular-agents').then(setPopularAgents).catch(() => {});
        apiFetch('/admin/channels').then(setChannels).catch(() => {});
      })
      .catch(err => {
        if (err.status === 403) {
          setDenied(true);
          setLoading(false);
        } else {
          router.push('/dashboard');
        }
      });
  }, [router]);

  // Fetch users with sort/pagination
  const fetchUsers = useCallback(async (sort, order, offset) => {
    try {
      const data = await apiFetch(`/admin/users?sort=${sort}&order=${order}&limit=50&offset=${offset}`);
      if (offset === 0) {
        setUsers(data.users);
      } else {
        setUsers(prev => [...(prev || []), ...data.users]);
      }
      setUserTotal(data.total);
    } catch {
      // silent
    }
  }, []);

  const handleSort = (field) => {
    const newOrder = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortOrder(newOrder);
    setUserOffset(0);
    fetchUsers(field, newOrder, 0);
  };

  const handleLoadMore = () => {
    const newOffset = userOffset + 50;
    setUserOffset(newOffset);
    fetchUsers(sortField, sortOrder, newOffset);
  };

  // Loading
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 animate-pulse space-y-6">
        <div className="h-8 w-64 bg-elevated rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-card border border-border rounded-[var(--radius-card)]" />
          ))}
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

  const tierTotal = tiers?.tiers?.reduce((sum, t) => sum + t.count, 0) || 1;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">{t('title')}</h1>

      {/* 1. Overview Metrics */}
      <section>
        <SectionLabel>{t('overview')}</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <MetricCard label={t('totalUsers')} value={overview?.total_users} />
          <MetricCard label={t('totalMessages')} value={overview?.total_messages} />
          <MetricCard label={t('totalAgents')} value={overview?.total_agents} />
          <MetricCard label={t('activeUsers7d')} value={overview?.active_users_7d} />
        </div>
      </section>

      {/* 2. Signups (30d) + 3. Tier Breakdown — side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('signups')}</h3>
          {signups?.data?.length > 0 ? (
            <BarChart data={signups.data} color="bg-accent" label />
          ) : (
            <p className="text-sm text-txt-dim">{t('noData')}</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('tiers')}</h3>
          {tiers?.tiers?.length > 0 ? (
            <div className="space-y-3">
              {tiers.tiers.map(ti => {
                const pct = (ti.count / tierTotal) * 100;
                const colors = { trial: 'bg-txt-muted', active: 'bg-accent', cancelled: 'bg-danger', pro: 'bg-accent', pro_tribe: 'bg-mint' };
                return (
                  <div key={ti.tier} className="flex items-center gap-3">
                    <span className="text-xs text-txt-muted w-24 capitalize">{ti.tier.replace('_', ' ')}</span>
                    <div className="flex-1 h-3 bg-elevated rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[ti.tier] || 'bg-accent'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-txt-dim w-12 text-right">{ti.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-txt-dim">{t('noData')}</p>
          )}
        </Card>
      </div>

      {/* 4. User Table */}
      <section>
        <SectionLabel>{t('users')} ({userTotal})</SectionLabel>
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-txt-muted uppercase tracking-wider border-b border-border">
                {[
                  { key: 'email', label: t('email') },
                  { key: 'tier', label: t('tier') },
                  { key: 'created_at', label: t('signupDate') },
                  { key: null, label: t('messageCount') },
                  { key: null, label: t('agentCount') },
                  { key: null, label: t('lastActive') },
                  { key: null, label: t('authProvider') },
                  { key: null, label: t('channels') },
                ].map((col, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 ${col.key ? 'cursor-pointer hover:text-txt' : ''}`}
                    onClick={col.key ? () => handleSort(col.key) : undefined}
                  >
                    {col.label}
                    {col.key && sortField === col.key && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users?.map(u => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-elevated/50 transition-colors">
                  <td className="px-4 py-3 text-txt">{u.email}</td>
                  <td className="px-4 py-3"><TierBadge tier={u.tier} /></td>
                  <td className="px-4 py-3 text-txt-muted text-xs">
                    {new Date(u.signup_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-txt-body">{u.message_count}</td>
                  <td className="px-4 py-3 text-txt-body">{u.agent_count}</td>
                  <td className="px-4 py-3 text-txt-muted text-xs">
                    {u.last_active ? new Date(u.last_active).toLocaleDateString() : t('never')}
                  </td>
                  <td className="px-4 py-3 text-txt-muted text-xs capitalize">{u.auth_provider}</td>
                  <td className="px-4 py-3 text-txt-muted text-xs">
                    {u.channels.length > 0 ? u.channels.join(', ') : t('none')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users && users.length < userTotal && (
            <div className="p-4 text-center">
              <button
                onClick={handleLoadMore}
                className="text-sm text-accent hover:underline"
              >
                {t('loadMore')}
              </button>
            </div>
          )}
        </Card>
      </section>

      {/* 5. Message Volume */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('messageVolume')}</h3>
        {msgVolume?.data?.length > 0 ? (
          <BarChart data={msgVolume.data} color="bg-mint" label />
        ) : (
          <p className="text-sm text-txt-dim">{t('noData')}</p>
        )}
      </Card>

      {/* 6. Popular Agents + 7. Channel Usage — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Agents */}
        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('popularAgents')}</h3>
          {popularAgents?.agents?.length > 0 ? (
            <div className="divide-y divide-border/50">
              {popularAgents.agents.map((w, i) => (
                <div key={w.template_id} className="flex items-center gap-4 py-3">
                  <span className="text-lg font-bold text-txt-dim w-6 text-right">{i + 1}</span>
                  <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold shrink-0">
                    {(w.name || 'A').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-txt">{w.name}</span>
                  </div>
                  <span className="text-sm text-accent font-medium">{w.deploy_count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-txt-dim">{t('noData')}</p>
          )}
        </Card>

        {/* Channel Usage */}
        <Card className="p-6">
          <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('channelUsage')}</h3>
          {channels ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs text-txt-muted uppercase tracking-wider mb-3">{t('connectedChannels')}</p>
                {channels.connected_channels?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {channels.connected_channels.map(c => (
                      <div key={c.channel} className="bg-elevated rounded-[var(--radius-card)] p-3 text-center">
                        <p className="text-2xl font-[family-name:var(--font-display)] text-txt">{c.count}</p>
                        <p className="text-xs text-txt-muted capitalize mt-1">{c.channel}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-txt-dim">{t('noData')}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-txt-muted uppercase tracking-wider mb-3">{t('messagesByChannel')}</p>
                {channels.message_channels?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {channels.message_channels.map(c => (
                      <div key={c.channel} className="bg-elevated rounded-[var(--radius-card)] p-3 text-center">
                        <p className="text-2xl font-[family-name:var(--font-display)] text-txt">{c.count.toLocaleString()}</p>
                        <p className="text-xs text-txt-muted capitalize mt-1">{c.channel}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-txt-dim">{t('noData')}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-txt-dim">{t('noData')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
