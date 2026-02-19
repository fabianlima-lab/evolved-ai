'use client';

import { useTranslations } from 'next-intl';

export default function ChatPreview() {
  const t = useTranslations('Landing');

  return (
    <section className="flex justify-center px-6 lg:px-12 pb-24 pt-8" style={{ background: 'var(--color-brand-cream)' }}>
      <div
        className="max-w-[440px] w-full bg-white rounded-[20px] overflow-hidden"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)', opacity: 0, animation: 'fadeUp 1s ease 1.2s forwards' }}
      >
        {/* Chat Header */}
        <div className="bg-brand-deep-green text-brand-cream px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-teal rounded-full flex items-center justify-center font-[family-name:var(--font-display)] text-base font-bold text-white">
            EA
          </div>
          <div>
            <div className="text-[0.85rem] font-semibold">{t('chatName')}</div>
            <div className="text-[0.65rem] text-brand-mint font-normal flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 bg-brand-mint rounded-full" /> {t('chatStatus')}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="p-6 flex flex-col gap-3">
          {/* User message */}
          <div className="self-end max-w-[85%] px-4 py-3 rounded-2xl rounded-br-[4px] bg-brand-deep-green text-brand-cream text-[0.82rem] leading-[1.55]">
            {t('chatUser1')}
          </div>

          {/* Bot message */}
          <div className="self-start max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-[4px] bg-brand-mint text-brand-charcoal text-[0.82rem] leading-[1.55]">
            {t('chatBot1p1')}
            <span className="text-brand-deep-green font-semibold">{t('chatBot1Highlight')}</span>
            {t('chatBot1p2')}
          </div>

          {/* User message */}
          <div className="self-end max-w-[85%] px-4 py-3 rounded-2xl rounded-br-[4px] bg-brand-deep-green text-brand-cream text-[0.82rem] leading-[1.55]">
            {t('chatUser2')}
          </div>

          {/* Bot message */}
          <div className="self-start max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-[4px] bg-brand-mint text-brand-charcoal text-[0.82rem] leading-[1.55]">
            {t('chatBot2p1')}
            <span className="text-brand-deep-green font-semibold">{t('chatBot2Highlight')}</span>
            {t('chatBot2p2')}
          </div>
        </div>

        {/* Chat Input */}
        <div className="px-6 py-3 border-t border-black/5 flex items-center gap-3">
          <span className="flex-1 text-[0.8rem] text-brand-text-light">Type a message...</span>
          <button className="w-8 h-8 bg-brand-teal border-none rounded-full text-brand-deep-green cursor-pointer flex items-center justify-center text-[0.8rem]" /* brand exception: chat send button is circular per guidelines */>
            →
          </button>
        </div>
      </div>
    </section>
  );
}
