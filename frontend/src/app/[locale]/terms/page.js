'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import PageShell from '@/components/ui/PageShell';

export default function TermsPage() {
  const t = useTranslations('Terms');
  const tc = useTranslations('Common');

  const sections = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <PageShell>
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-bg/90 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-[family-name:var(--font-display)] text-txt font-bold text-lg">
            {tc('brandName')}
          </Link>
          <Link href="/login" className="text-sm text-txt-muted hover:text-txt transition-colors">
            {tc('signIn')}
          </Link>
        </div>
      </nav>
      <main className="pt-16 max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-txt mb-8">
          {t('title')}
        </h1>

        <div className="prose max-w-none space-y-8 text-txt-body text-sm leading-relaxed">
          {sections.map((num) => (
            <section key={num}>
              <h2 className="text-lg text-txt font-medium mb-3">
                {t(`section${num}_title`)}
              </h2>
              {num === 10 ? (
                <p>
                  {t(`section${num}_body`)}{' '}
                  <a href={`mailto:${t(`section${num}_email`)}`} className="text-accent hover:underline">
                    {t(`section${num}_email`)}
                  </a>
                </p>
              ) : (
                <p>{t(`section${num}_body`)}</p>
              )}
            </section>
          ))}

          <section>
            <p className="text-txt-dim text-xs mt-8">
              {t('lastUpdated')}
            </p>
          </section>
        </div>

        <div className="mt-12">
          <Link href="/" className="text-sm text-accent hover:underline">
            {t('backHome')}
          </Link>
        </div>
      </main>
    </PageShell>
  );
}
