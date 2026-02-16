'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { PublicNav } from '@/components/Nav';
import PageShell from '@/components/ui/PageShell';
import ChatWidget from '@/components/ChatWidget';
import { apiPost } from '@/lib/api';

export default function DemoPage() {
  const t = useTranslations('Demo');

  const handleSend = async (message) => {
    try {
      const data = await apiPost('/demo/chat', { message });
      return data.reply || data.response || data.message;
    } catch {
      return t('errorMessage');
    }
  };

  return (
    <PageShell>
      <PublicNav />
      <main className="pt-16 max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-widest text-accent font-medium">{t('label')}</span>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt mt-3">
            {t('title')}
          </h1>
          <p className="text-txt-muted mt-2">
            {t('description')}
          </p>
        </div>

        <div className="h-[500px]">
          <ChatWidget
            agentName="Evolved AI"
            onSend={handleSend}
            messages={[
              { role: 'assistant', content: t('initialMessage') },
            ]}
          />
        </div>

        <div className="text-center mt-8">
          <Link
            href="/signup"
            className="bg-accent text-white px-8 py-4 rounded-[var(--radius-btn)] font-bold hover:opacity-90 transition-all inline-block"
          >
            {t('cta')}
          </Link>
        </div>
      </main>
    </PageShell>
  );
}
