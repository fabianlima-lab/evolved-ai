'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import PageShell from '@/components/ui/PageShell';

export default function PrivacyPage() {
  const t = useTranslations('Privacy');
  const tc = useTranslations('Common');

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
          <section>
            <h2 className="text-lg text-txt font-medium mb-3">{t('section1_title')}</h2>
            <p>
              {t('section1_body1')}
            </p>
            <p className="mt-2">
              {t('section1_body2')}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-txt font-medium mb-3">{t('section2_title')}</h2>
            <p>{t('section2_intro')}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>{t('section2_item1')}</li>
              <li>{t('section2_item2')}</li>
              <li>{t('section2_item3')}</li>
              <li>{t('section2_item4')}</li>
              <li>{t('section2_item5')}</li>
              <li>{t('section2_item6')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-txt font-medium mb-3">{t('section3_title')}</h2>
            <p>{t('section3_intro')}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>{t('section3_item1')}</li>
              <li>{t('section3_item2')}</li>
              <li>{t('section3_item3')}</li>
              <li>{t('section3_item4')}</li>
            </ul>
            <p className="mt-2">
              {t('section3_body')}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-txt font-medium mb-3">{t('section4_title')}</h2>
            <p>
              {t('section4_body')}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-txt font-medium mb-3">{t('section5_title')}</h2>
            <p>
              {t('section5_body')}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-txt font-medium mb-3">{t('section6_title')}</h2>
            <p>{t('section6_intro')}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>{t('section6_item1')}</li>
              <li>{t('section6_item2')}</li>
              <li>{t('section6_item3')}</li>
              <li>{t('section6_item4')}</li>
              <li>{t('section6_item5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-txt font-medium mb-3">{t('section7_title')}</h2>
            <p>
              {t('section7_body')}{' '}
              <a href={`mailto:${t('section7_email')}`} className="text-accent hover:underline">
                {t('section7_email')}
              </a>
            </p>
          </section>

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
