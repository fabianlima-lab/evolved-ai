import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const messages = await getMessages({ locale });
  const meta = messages.Metadata || {};
  return {
    title: meta.siteTitle || 'Evolved AI — Your Personal Chief of Staff',
    description: meta.siteDescription || 'AI-powered personal assistant on WhatsApp. Manages your inbox, calendar, tasks, and more.',
    manifest: '/manifest.json',
    icons: {
      icon: [{ url: '/icon.png?v=3', type: 'image/png', sizes: '64x64' }],
      apple: '/apple-icon.png?v=3',
    },
  };
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
