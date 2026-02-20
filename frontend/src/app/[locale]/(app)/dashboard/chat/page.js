'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch, apiPost } from '@/lib/api';

/* ── Icons ── */
const SendIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);

const WhatsAppIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

/* ── Helpers ── */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ChatPage() {
  const t = useTranslations('Chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [agentName, setAgentName] = useState('Your Assistant');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  /* ── Load history ── */
  useEffect(() => {
    apiFetch('/chat/history?limit=50')
      .then((data) => {
        setMessages(data.messages || []);
        if (data.agent?.name) setAgentName(data.agent.name);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /* ── Send message ── */
  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || sending) return;

    setInput('');
    setError('');
    setSending(true);

    // Optimistic add
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: msg, createdAt: new Date().toISOString() }]);

    try {
      const data = await apiPost('/chat/send', { message: msg });
      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          id: `resp-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(t('sendError'));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, t]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        background: 'var(--color-bg)',
      }}>
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 64px)',
      maxWidth: 720,
      margin: '0 auto',
      padding: '0 16px',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 0 12px',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--color-brand-deep-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-brand-cream)',
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          flexShrink: 0,
        }}>
          {agentName.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.1rem',
            fontWeight: 500,
            color: 'var(--color-txt)',
          }}>
            {agentName}
          </div>
          <div style={{
            fontSize: '0.65rem',
            color: 'var(--color-brand-text-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <WhatsAppIcon style={{ width: 12, height: 12, color: '#25D366' }} />
            <span>{t('synced')}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: 0.5,
            padding: '40px 0',
          }}>
            <p style={{
              fontSize: '0.85rem',
              fontWeight: 300,
              color: 'var(--color-brand-brown)',
              textAlign: 'center',
            }}>
              {t('emptyState', { name: agentName })}
            </p>
            <p style={{
              fontSize: '0.75rem',
              fontWeight: 300,
              color: 'var(--color-brand-text-light)',
              textAlign: 'center',
            }}>
              {t('emptyHint')}
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isUser ? 'var(--color-brand-deep-green)' : 'var(--color-brand-white)',
                color: isUser ? 'var(--color-brand-cream)' : 'var(--color-txt)',
                border: isUser ? 'none' : '1px solid rgba(0,0,0,0.04)',
                fontSize: '0.85rem',
                fontWeight: 300,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {msg.content}
                <div style={{
                  fontSize: '0.6rem',
                  opacity: 0.6,
                  marginTop: '6px',
                  textAlign: isUser ? 'right' : 'left',
                }}>
                  {msg.createdAt ? timeAgo(msg.createdAt) : ''}
                </div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '16px 16px 16px 4px',
              background: 'var(--color-brand-white)',
              border: '1px solid rgba(0,0,0,0.04)',
              fontSize: '0.85rem',
              color: 'var(--color-brand-text-light)',
            }}>
              <span style={{ animation: 'pulse 1.5s infinite' }}>Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px 12px',
          fontSize: '0.75rem',
          color: 'var(--color-brand-alert)',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 0 20px',
        borderTop: '1px solid rgba(0,0,0,0.04)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          background: 'var(--color-brand-white)',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: '20px',
          padding: '8px 8px 8px 16px',
          transition: 'border-color 0.2s ease',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder', { name: agentName })}
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              resize: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              fontWeight: 300,
              color: 'var(--color-txt)',
              lineHeight: 1.5,
              maxHeight: '120px',
              fontFamily: 'inherit',
            }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: input.trim() ? 'var(--color-brand-deep-green)' : 'rgba(0,0,0,0.04)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            <SendIcon style={{
              width: 16,
              height: 16,
              color: input.trim() ? 'var(--color-brand-cream)' : 'var(--color-brand-text-light)',
            }} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
