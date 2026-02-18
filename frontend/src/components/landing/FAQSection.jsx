'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

function FAQItem({ question, answer, isOpen, onToggle }) {
  return (
    <div className="border-b border-black/[0.06] py-6">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center cursor-pointer bg-transparent border-none p-0 text-left"
      >
        <span className="font-[family-name:var(--font-display)] text-[1.2rem] font-medium text-brand-charcoal pr-4">
          {question}
        </span>
        <span className="text-brand-teal text-[1.2rem] font-light shrink-0 ml-4 transition-transform duration-300">
          {isOpen ? '\u2212' : '+'}
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: isOpen ? '400px' : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <p className="text-[0.88rem] leading-[1.8] text-brand-brown font-light mt-4 pr-8">
          {answer}
        </p>
      </div>
    </div>
  );
}

export default function FAQSection() {
  const t = useTranslations('Landing');
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    { q: t('faq1Q'), a: t('faq1A') },
    { q: t('faq2Q'), a: t('faq2A') },
    { q: t('faq3Q'), a: t('faq3A') },
    { q: t('faq4Q'), a: t('faq4A') },
    { q: t('faq5Q'), a: t('faq5A') },
    { q: t('faq6Q'), a: t('faq6A') },
    { q: t('faq7Q'), a: t('faq7A') },
  ];

  return (
    <section id="faq" className="py-24 px-6 lg:px-12" style={{ background: 'var(--color-brand-cream)' }}>
      <div className="max-w-[700px] mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-brand-teal font-semibold mb-6">
            {t('faqEyebrow')}
          </p>
          <h2
            className="font-[family-name:var(--font-display)] font-light leading-[1.25] text-brand-charcoal"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            {t('faqTitle')} <em className="italic text-brand-teal">{t('faqTitleEm')}</em>
          </h2>
        </div>

        {/* FAQ Items */}
        <div>
          {faqs.map((faq, i) => (
            <FAQItem
              key={i}
              question={faq.q}
              answer={faq.a}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
