'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SectionLabel from '@/components/ui/SectionLabel';
import { apiPost, apiFetch } from '@/lib/api';

export default function ChannelPage() {
  const t = useTranslations('Channel');
  const [connectionCode, setConnectionCode] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);
  const router = useRouter();

  // Request a connection code on mount
  useEffect(() => {
    const requestCode = async () => {
      try {
        const data = await apiPost('/channels/connect/request', { channel: 'whatsapp' });
        setConnectionCode(data.code || data.connection_code);
      } catch {
        // Fall back to direct bot link approach
        setConnectionCode(null);
      }
    };
    requestCode();
  }, []);

  // Poll for connection status
  useEffect(() => {
    if (connected) return;

    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch('/channels/status');
        if (data.whatsapp_connected) {
          setConnected(true);
          clearInterval(pollRef.current);
        }
      } catch {
        // Silently retry
      }
    }, 3000);

    return () => clearInterval(pollRef.current);
  }, [connected]);

  const handleFinish = () => {
    router.push('/deploy');
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <SectionLabel>{t('step')}</SectionLabel>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt mt-3">
          {t('title')}
        </h1>
        <p className="text-txt-muted mt-2">
          {t('subtitle')}
        </p>
      </div>

      <Card className="p-8">
        {connected ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
              <span className="text-success text-3xl">✓</span>
            </div>
            <h3 className="text-xl text-txt font-medium">{t('connected')}</h3>
            <p className="text-txt-muted">
              {t('connectedDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* WhatsApp connection */}
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📱</span>
                <div>
                  <h3 className="text-txt font-medium">{t('connectWhatsApp')}</h3>
                  <p className="text-txt-muted text-sm">{t('linkAccount')}</p>
                </div>
              </div>

              {/* QR code placeholder */}
              <div className="w-32 h-32 bg-elevated border border-border rounded-[var(--radius-card)] flex items-center justify-center">
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-5 h-5 rounded-sm ${
                        Math.random() > 0.4 ? 'bg-txt-dim' : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-txt-muted text-sm text-center max-w-sm">
                {t('whatsAppInstruction')}
              </p>

              {connectionCode && (
                <div className="text-center">
                  <p className="text-txt-muted text-sm mb-2">
                    {t('sendCode')}
                  </p>
                  <div className="bg-elevated border border-border rounded-[var(--radius-btn)] px-6 py-3 font-mono text-2xl text-txt tracking-widest">
                    {connectionCode}
                  </div>
                </div>
              )}

              <p className="text-txt-dim text-xs text-center">
                {t('waiting')}
                <span className="inline-block w-2 h-2 bg-accent rounded-full ml-2 animate-pulse" />
              </p>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-10 flex items-center justify-center gap-4">
        <Button variant="ghost" onClick={handleFinish}>
          {t('skip')}
        </Button>
        <Button onClick={handleFinish}>
          {t('finish')}
        </Button>
      </div>
    </div>
  );
}
