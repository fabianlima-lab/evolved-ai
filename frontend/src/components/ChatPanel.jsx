'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch, apiPost } from '@/lib/api';

/**
 * Two-way chat panel for the dashboard.
 * Loads conversation history, supports sending messages via the web,
 * and polls for new messages (from WhatsApp or other channels).
 */
export default function ChatPanel({ agent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const pollRef = useRef(null);
  const t = useTranslations('Chat');
  const tCommon = useTranslations('Common');

  const agentName = agent?.name || 'Assistant';

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await apiFetch('/chat/history?limit=30');
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const pollMessages = useCallback(async () => {
    try {
      const data = await apiFetch('/chat/history?limit=30');
      if (data.messages) {
        setMessages((prev) => {
          if (data.messages.length !== prev.length ||
              data.messages[data.messages.length - 1]?.id !== prev[prev.length - 1]?.id) {
            return data.messages;
          }
          return prev;
        });
      }
    } catch {
      // Silent fail on poll
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    pollRef.current = setInterval(pollMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [pollMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId,
      role: 'user',
      content: text,
      channel: 'web',
      createdAt: new Date().toISOString(),
    }]);
    setInput('');
    setSending(true);

    try {
      const data = await apiPost('/chat/send', { message: text });

      if (data.response) {
        setMessages((prev) => [...prev, {
          id: `resp-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          channel: 'web',
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: t('sendError'),
        channel: 'web',
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col bg-card border border-border rounded-[var(--radius-card)] overflow-hidden"
      style={{ height: 'min(520px, 60vh)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold">
          {agentName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-txt">{agentName}</span>
          <span className="text-xs text-success ml-2">● {tCommon('online')}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-txt-dim animate-pulse">{tCommon('loading')}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xl font-bold opacity-60">
              {agentName.charAt(0)}
            </div>
            <p className="text-sm text-txt-muted">{t('emptyState', { name: agentName })}</p>
            <p className="text-xs text-txt-dim">{t('emptyHint')}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const channelTag = msg.channel && msg.channel !== 'web' ? msg.channel : null;

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] group relative`}>
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-accent/15 text-txt border border-accent/25 rounded-br-sm'
                        : 'bg-elevated text-txt-body border border-border rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {channelTag && (
                      <span className="text-[10px] text-txt-dim uppercase">{channelTag}</span>
                    )}
                    <span className="text-[10px] text-txt-dim">
                      {new Date(msg.createdAt || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-elevated text-txt-dim px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-sm border border-border">
              <span className="animate-pulse">{tCommon('typing')}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder', { name: agentName })}
          disabled={sending}
          className="flex-1 bg-elevated border border-border rounded-[var(--radius-btn)] px-4 py-2.5 text-sm text-txt placeholder:text-txt-dim focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="bg-accent text-white px-4 py-2.5 rounded-[var(--radius-btn)] text-sm font-medium hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {tCommon('send')}
        </button>
      </div>
    </div>
  );
}
