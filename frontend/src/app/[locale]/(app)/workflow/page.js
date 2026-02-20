'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';

/* ── Styles ── */
const CARD_STYLE = {
  background: 'var(--color-brand-white)',
  border: '1px solid rgba(0,0,0,0.03)',
  borderRadius: '2px',
};

const EYEBROW = {
  fontSize: '0.6rem',
  textTransform: 'uppercase',
  letterSpacing: '0.3em',
  fontWeight: 500,
  color: 'var(--color-brand-teal)',
  marginBottom: '12px',
};

const PRIORITY_COLORS = {
  high: { bg: 'rgba(212,129,107,0.1)', color: 'var(--color-brand-alert)' },
  medium: { bg: 'rgba(139,196,198,0.1)', color: 'var(--color-brand-teal-dark)' },
  low: { bg: 'rgba(0,0,0,0.03)', color: 'var(--color-brand-text-light)' },
};

/* ── Task Card ── */
function TaskCard({ task }) {
  const priority = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const date = task.movedAt
    ? new Date(task.movedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';

  return (
    <div style={{
      ...CARD_STYLE,
      padding: '14px 16px',
      marginBottom: '8px',
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-txt)', marginBottom: '6px' }}>
        {task.title}
      </div>
      {task.description && (
        <div style={{ fontSize: '0.68rem', fontWeight: 300, color: 'var(--color-brand-text-light)', marginBottom: '8px', lineHeight: 1.5 }}>
          {task.description.length > 80 ? task.description.slice(0, 80) + '...' : task.description}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {task.priority && (
          <span style={{
            fontSize: '0.5rem',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '2px 8px',
            borderRadius: '2px',
            background: priority.bg,
            color: priority.color,
          }}>
            {task.priority}
          </span>
        )}
        {date && (
          <span style={{ fontSize: '0.6rem', fontWeight: 300, color: 'var(--color-brand-text-light)' }}>
            {date}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Kanban Column ── */
function KanbanColumn({ title, tasks, t }) {
  return (
    <div style={{
      flex: 1,
      minWidth: '180px',
      background: 'rgba(0,0,0,0.01)',
      borderRadius: '2px',
      padding: '16px 12px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <span style={EYEBROW}>{title}</span>
        <span style={{
          fontSize: '0.55rem',
          fontWeight: 500,
          color: 'var(--color-brand-text-light)',
          background: 'rgba(0,0,0,0.03)',
          padding: '2px 6px',
          borderRadius: '2px',
        }}>
          {tasks.length}
        </span>
      </div>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
      {tasks.length === 0 && (
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 300,
          color: 'var(--color-brand-text-light)',
          textAlign: 'center',
          padding: '24px 0',
          opacity: 0.6,
        }}>
          {t('emptyColumn')}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function WorkflowPage() {
  const t = useTranslations('Workflow');
  const [columns, setColumns] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/tasks')
      .then(setColumns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{
          width: 32,
          height: 32,
          border: '2px solid var(--color-accent)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const cols = columns || { backlog: [], todo: [], in_progress: [], review: [], done: [] };
  const totalTasks = Object.values(cols).flat().length;

  return (
    <div style={{ maxWidth: '100%', padding: '48px 24px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt" style={{ fontWeight: 300 }}>
          {t('title')}
        </h1>
        <p style={{ fontSize: '0.82rem', fontWeight: 300, color: 'var(--color-brand-brown)', marginTop: '8px', lineHeight: 1.6 }}>
          {t('subtitle')}
        </p>
      </div>

      {totalTasks === 0 ? (
        <div style={{ maxWidth: '960px', margin: '32px auto 0' }}>
          <div style={{ ...CARD_STYLE, padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 300, color: 'var(--color-brand-text-light)' }}>
              {t('noTasks')}
            </p>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '24px',
          overflowX: 'auto',
          paddingBottom: '16px',
        }}>
          <KanbanColumn title={t('backlog')} tasks={cols.backlog} t={t} />
          <KanbanColumn title={t('todo')} tasks={cols.todo} t={t} />
          <KanbanColumn title={t('inProgress')} tasks={cols.in_progress} t={t} />
          <KanbanColumn title={t('review')} tasks={cols.review} t={t} />
          <KanbanColumn title={t('done')} tasks={cols.done} t={t} />
        </div>
      )}
    </div>
  );
}
