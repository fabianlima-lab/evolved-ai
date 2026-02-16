'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function ChatDemo() {
  const [step, setStep] = useState(0);
  const t = useTranslations('ChatDemo');

  const MESSAGES = [
    { from: 'user', text: t('userMsg1') },
    { from: 'bot', name: 'Evolved AI', text: t('botMsg1') },
    { from: 'user', text: t('userMsg2') },
    { from: 'bot', name: 'Evolved AI', text: t('botMsg2') },
  ];

  useEffect(() => {
    if (step >= MESSAGES.length) return;
    const delay = step === 0 ? 1200 : 2000;
    const timer = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(timer);
  }, [step, MESSAGES.length]);

  return (
    <section className="px-6 pb-20 flex justify-center">
      <div className="w-full max-w-[420px] bg-card rounded-[20px] border border-border overflow-hidden"
        style={{ boxShadow: '0 8px 48px rgba(0,0,0,0.4)' }}>
        {/* Phone header */}
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-base bg-accent/20 text-accent font-bold">
            E
          </div>
          <div>
            <div className="font-semibold text-base text-txt">{t('botName')}</div>
            <div className="text-[13px] text-success">{t('onlineStatus')}</div>
          </div>
        </div>

        {/* Messages — all in DOM for stable layout, visibility toggled */}
        <div className="px-4 py-5 flex flex-col gap-3">
          {MESSAGES.map((msg, i) => {
            const isVisible = i < step;
            return (
              <div
                key={i}
                className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{
                  visibility: isVisible ? 'visible' : 'hidden',
                  animation: isVisible ? 'fadeSlideUp 0.4s ease forwards' : 'none',
                }}
              >
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-[14px] text-[15px] leading-relaxed text-txt ${
                    msg.from === 'user'
                      ? 'bg-accent/15 border border-accent/25'
                      : 'bg-white/5 border border-border'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
