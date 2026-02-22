'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
        {typeof value === 'number' ? value.toLocaleString() : value ?? '\u2014'}
      </p>
    </Card>
  );
}

function BarChart({ data, color = 'bg-accent', label }) {
  if (!data?.length) return <p className="text-xs text-txt-dim">No data</p>;
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
      {data.length > 1 && (
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
    past_due: 'bg-[#D4816B]/20 text-[#D4816B]',
    pro: 'bg-accent/20 text-accent',
    pro_tribe: 'bg-mint/60 text-accent',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-[var(--radius-card)] whitespace-nowrap ${colors[tier] || colors.trial}`}>
      {tier.replace('_', ' ')}
    </span>
  );
}

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

function ToneBadge({ tone }) {
  const colors = {
    positive: 'bg-[#2D8B6F]/20 text-[#2D8B6F]',
    neutral: 'bg-txt-muted/20 text-txt-muted',
    negative: 'bg-danger/10 text-danger',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-[var(--radius-card)] whitespace-nowrap capitalize ${colors[tone] || colors.neutral}`}>
      {tone}
    </span>
  );
}

function formatTokens(n) {
  if (!n || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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

function SubscriberDetailPanel({ detail, loading, t }) {
  if (loading) {
    return (
      <tr>
        <td colSpan={8} className="px-6 py-8">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-48 bg-elevated rounded" />
            <div className="h-24 bg-elevated rounded" />
          </div>
        </td>
      </tr>
    );
  }
  if (!detail) return null;

  const { subscriber, agent, tokens, message_volume_7d, recent_messages, conversation_tone, response_rate, ai_healthy } = detail;

  return (
    <tr>
      <td colSpan={8} className="px-6 py-6 bg-elevated/30 border-b border-border/50">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Subscriber Info + Agent */}
          <div className="space-y-4">
            <div>
              <p className="text-xs text-txt-muted uppercase tracking-wider mb-2">{t('subscriber')}</p>
              <p className="text-sm text-txt font-medium">{subscriber.name || subscriber.email}</p>
              {subscriber.assistant_name && (
                <p className="text-xs text-txt-dim">Assistant: {subscriber.assistant_name}</p>
              )}
              <p className="text-xs text-txt-dim">Tier: {subscriber.tier} &middot; Onboarding: {subscriber.onboarding_step}</p>
              {subscriber.whatsapp_connected && (
                <p className="text-xs text-accent">WhatsApp connected</p>
              )}
            </div>
            {agent && (
              <div>
                <p className="text-xs text-txt-muted uppercase tracking-wider mb-2">{t('agent')}</p>
                <p className="text-sm text-txt">{agent.name} (L{agent.level})</p>
                <div className="mt-2 space-y-1">
                  {[
                    ['Warmth', agent.traits.warmth],
                    ['Knows you', agent.traits.knows_you],
                    ['Reliability', agent.traits.reliability],
                    ['Growth', agent.traits.growth],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[10px] text-txt-dim w-16">{label}</span>
                      <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${Math.min((val / 5) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-txt-dim w-4 text-right">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5">
                <StatusDot ok={ai_healthy} />
                <span className="text-xs text-txt-muted">
                  {ai_healthy ? t('aiResponding') : t('aiSilent')}
                </span>
              </div>
              <span className="text-xs text-txt-dim">{t('responseRate')}: {response_rate}%</span>
            </div>
          </div>

          {/* Column 2: Token Breakdown + Volume Chart */}
          <div className="space-y-4">
            <div>
              <p className="text-xs text-txt-muted uppercase tracking-wider mb-2">{t('tokenSpend')}</p>
              <div className="space-y-1">
                {[
                  [t('inputTotal'), formatTokens(tokens.total_input)],
                  [t('outputTotal'), formatTokens(tokens.total_output)],
                  [t('total7d'), formatTokens(tokens.input_7d + tokens.output_7d)],
                  [t('total30d'), formatTokens(tokens.input_30d + tokens.output_30d)],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-xs text-txt-dim">{label}</span>
                    <span className="text-xs text-txt font-medium">{val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-txt-muted uppercase tracking-wider mb-2">{t('messages7d')}</p>
              <BarChart data={message_volume_7d} color="bg-accent" />
            </div>
          </div>

          {/* Column 3: Tone + Recent Messages */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-xs text-txt-muted uppercase tracking-wider">{t('conversationTone')}:</p>
              <ToneBadge tone={conversation_tone} />
            </div>
            <div>
              <p className="text-xs text-txt-muted uppercase tracking-wider mb-2">{t('recentMessages')}</p>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {recent_messages?.length > 0 ? recent_messages.map((m, i) => (
                  <div
                    key={i}
                    className={`text-xs p-2.5 rounded-[var(--radius-card)] ${
                      m.role === 'user' ? 'bg-elevated' : 'bg-accent/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-txt-muted capitalize">{m.role}</span>
                      <span className="text-txt-dim">{m.channel}</span>
                      {m.tokens > 0 && <span className="text-txt-dim">{formatTokens(m.tokens)} tok</span>}
                    </div>
                    <p className="text-txt-body line-clamp-2">{m.content}</p>
                  </div>
                )) : (
                  <p className="text-xs text-txt-dim">No messages yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
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
  const [summary, setSummary] = useState(null);
  const [msgVolume, setMsgVolume] = useState(null);
  const [popularAgents, setPopularAgents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  // Sort state for users table
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [userOffset, setUserOffset] = useState(0);

  // Expandable detail panel
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Check access + fetch all data
  useEffect(() => {
    apiFetch('/admin/overview')
      .then(data => {
        setOverview(data);
        setLoading(false);
        // Fetch rest in parallel
        apiFetch('/admin/signups?days=30').then(setSignups).catch(() => {});
        apiFetch('/admin/tiers').then(setTiers).catch(() => {});
        apiFetch('/admin/subscribers/enhanced?limit=50&offset=0').then(d => {
          setUsers(d.subscribers);
          setUserTotal(d.total);
          setSummary(d.summary);
        }).catch(() => {});
        apiFetch('/admin/messages?days=30').then(setMsgVolume).catch(() => {});
        apiFetch('/admin/popular-agents').then(setPopularAgents).catch(() => {});
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
      const data = await apiFetch(`/admin/subscribers/enhanced?sort=${sort}&order=${order}&limit=50&offset=${offset}`);
      if (offset === 0) {
        setUsers(data.subscribers);
      } else {
        setUsers(prev => [...(prev || []), ...data.subscribers]);
      }
      setUserTotal(data.total);
      setSummary(data.summary);
    } catch {
      // silent
    }
  }, []);

  const handleSort = (field) => {
    const newOrder = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortOrder(newOrder);
    setUserOffset(0);
    setExpandedUserId(null);
    setUserDetail(null);
    fetchUsers(field, newOrder, 0);
  };

  const handleLoadMore = () => {
    const newOffset = userOffset + 50;
    setUserOffset(newOffset);
    fetchUsers(sortField, sortOrder, newOffset);
  };

  const handleRowClick = async (userId) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setUserDetail(null);
      return;
    }
    setExpandedUserId(userId);
    setDetailLoading(true);
    setUserDetail(null);
    try {
      const detail = await apiFetch(`/admin/subscribers/${userId}/detail`);
      setUserDetail(detail);
    } catch {
      setUserDetail(null);
    }
    setDetailLoading(false);
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

  const tierTotal = tiers?.tiers?.reduce((sum, ti) => sum + ti.count, 0) || 1;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">{t('title')}</h1>

      {/* 1. Overview Metrics */}
      <section>
        <SectionLabel>{t('overview')}</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <MetricCard label={t('totalSubscribers')} value={overview?.total_subscribers} />
          <MetricCard label={t('totalMessages')} value={overview?.total_messages} />
          <MetricCard label={t('totalAgents')} value={overview?.total_agents} />
          <MetricCard label={t('activeSubscribers7d')} value={overview?.active_subscribers_7d} />
        </div>
      </section>

      {/* 2. Signups (30d) + 3. Tier Breakdown — side by side */}
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
                const colors = { trial: 'bg-txt-muted', active: 'bg-accent', cancelled: 'bg-danger', past_due: 'bg-[#D4816B]', pro: 'bg-accent', pro_tribe: 'bg-mint' };
                return (
                  <div key={ti.tier} className="flex items-center gap-3">
                    <span className="text-xs text-txt-muted w-24 capitalize">{ti.tier.replace('_', ' ')}</span>
                    <div className="flex-1 h-3 bg-elevated rounded-[var(--radius-card)] overflow-hidden">
                      <div className={`h-full rounded-[var(--radius-card)] ${colors[ti.tier] || 'bg-accent'}`} style={{ width: `${pct}%` }} />
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

      {/* 4. User Table — Enhanced */}
      <section>
        <SectionLabel>{t('subscribers')} ({userTotal})</SectionLabel>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 mt-4 mb-4">
            <MetricCard label={t('totalTokenSpend')} value={formatTokens(summary.total_token_spend)} />
            <MetricCard label={t('avgTokensPerDay')} value={formatTokens(summary.avg_tokens_per_day)} />
            <MetricCard label={t('activeAiRate')} value={`${summary.active_ai_rate}%`} />
          </div>
        )}

        <Card className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-txt-muted uppercase tracking-wider border-b border-border">
                {[
                  { key: 'email', label: t('email') },
                  { key: 'tier', label: t('tier') },
                  { key: 'created_at', label: t('signupDate') },
                  { key: null, label: t('lastText') },
                  { key: null, label: t('aiStatus') },
                  { key: null, label: t('tokens7d') },
                  { key: null, label: t('responseRate') },
                  { key: null, label: t('messageCount') },
                ].map((col, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 ${col.key ? 'cursor-pointer hover:text-txt' : ''}`}
                    onClick={col.key ? () => handleSort(col.key) : undefined}
                  >
                    {col.label}
                    {col.key && sortField === col.key && (
                      <span className="ml-1">{sortOrder === 'asc' ? '\u2191' : '\u2193'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users?.map(u => (
                <React.Fragment key={u.id}>
                  <tr
                    className={`border-b border-border/50 hover:bg-elevated/50 transition-colors cursor-pointer ${
                      expandedUserId === u.id ? 'bg-elevated/40' : ''
                    }`}
                    onClick={() => handleRowClick(u.id)}
                  >
                    <td className="px-4 py-3 text-txt">{u.email}</td>
                    <td className="px-4 py-3"><TierBadge tier={u.tier} /></td>
                    <td className="px-4 py-3 text-txt-muted text-xs">
                      {new Date(u.signup_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-txt-muted text-xs">
                      {u.last_message_at ? timeAgo(u.last_message_at) : t('never')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusDot ok={u.ai_healthy} />
                    </td>
                    <td className="px-4 py-3 text-txt-body text-xs">
                      {formatTokens(u.tokens_7d)}
                    </td>
                    <td className="px-4 py-3 text-txt-body text-xs">
                      {u.total_msg_count > 0 ? `${u.response_rate}%` : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-txt-body">{u.total_msg_count}</td>
                  </tr>
                  {expandedUserId === u.id && (
                    <SubscriberDetailPanel detail={userDetail} loading={detailLoading} t={t} />
                  )}
                </React.Fragment>
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

      {/* 6. Popular Agents */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('popularAgents')}</h3>
        {popularAgents?.agents?.length > 0 ? (
          <div className="divide-y divide-border/50">
            {popularAgents.agents.map((w, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
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
    </div>
  );
}
