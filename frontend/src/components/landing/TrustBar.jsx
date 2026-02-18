'use client';

import { useTranslations } from 'next-intl';

export default function TrustBar() {
  const t = useTranslations('Landing');

  const items = [
    { icon: '🔒', text: t('trustEncrypted') },
    { icon: '🛡️', text: t('trustDataYours') },
    { icon: '💬', text: t('trustWhatsApp') },
    { icon: '✦', text: t('trustNoApps') },
  ];

  return (
    <section className="py-8 px-6 lg:px-12 bg-white border-t border-black/[0.04] border-b border-black/[0.04]">
      <div className="max-w-[800px] mx-auto flex justify-center items-center gap-8 flex-wrap">
        {items.map((item, i) => (
          <div key={i} className="contents">
            <div className="flex items-center gap-2.5">
              <span className="text-[0.9rem]">{item.icon}</span>
              <span className="text-[0.75rem] uppercase tracking-[0.12em] text-brand-brown font-medium">
                {item.text}
              </span>
            </div>
            {i < items.length - 1 && (
              <div className="w-px h-4 bg-brand-sand hidden sm:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
