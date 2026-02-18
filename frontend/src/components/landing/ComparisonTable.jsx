'use client';

import { useTranslations } from 'next-intl';
import { KAJABI_CHECKOUT_URL } from '@/lib/constants';

function Check() {
  return <span className="text-brand-teal text-[1.1rem] font-semibold">✓</span>;
}

function Cross() {
  return <span className="text-[#ccc] text-base">✗</span>;
}

function Partial({ text }) {
  return <span className="text-brand-text-light text-[0.78rem] italic">{text}</span>;
}

function BestText({ text }) {
  return <span className="text-brand-deep-green font-medium text-[0.82rem]">{text}</span>;
}

export default function ComparisonTable() {
  const t = useTranslations('Landing');

  const rows = [
    { label: t('compareFeature1'), chatgpt: 'x', ai: 'check', coaching: 'check' },
    { label: t('compareFeature2'), chatgpt: 'x', ai: 'check', coaching: 'check' },
    { label: t('compareFeature3'), chatgpt: 'x', ai: 'check', coaching: 'check' },
    { label: t('compareFeature4'), chatgpt: 'x', ai: 'check', coaching: 'check' },
    { label: t('compareFeature5'), chatgpt: 'x', ai: 'check', coaching: 'check' },
    { label: t('compareFeature6'), chatgpt: 'sortOf', ai: 'check', coaching: 'check' },
    { label: t('compareFeature7'), chatgpt: 'generic', ai: 'check', coaching: 'check' },
    { label: t('compareFeature8'), chatgpt: 'copyPaste', ai: 'check', coaching: 'check' },
    { label: t('compareFeature9'), chatgpt: 'x', ai: 'check', coaching: 'check' },
    { label: t('compareFeature10'), chatgpt: 'x', ai: 'guided', coaching: 'deepCustom' },
    { label: t('compareFeature11'), chatgpt: 'x', ai: 'x', coaching: 'drBethany' },
    { label: t('compareFeature12'), chatgpt: 'x', ai: 'x', coaching: 'tevConnect' },
    { label: t('compareFeature13'), chatgpt: 'x', ai: 'x', coaching: '30hrs' },
    { label: t('compareFeature14'), chatgpt: 'x', ai: 'supportive', coaching: 'transformative' },
  ];

  function renderCell(value) {
    switch (value) {
      case 'check': return <Check />;
      case 'x': return <Cross />;
      case 'sortOf': return <Partial text={t('compareSortOf')} />;
      case 'generic': return <Partial text={t('compareGeneric')} />;
      case 'copyPaste': return <Partial text={t('compareYouCopyPaste')} />;
      case 'guided': return <Partial text={t('compareGuided')} />;
      case 'supportive': return <Partial text={t('compareSupportive')} />;
      case 'deepCustom': return <BestText text={t('compareDeepCustom')} />;
      case 'drBethany': return <BestText text={t('compareDrBethany')} />;
      case 'tevConnect': return <BestText text={t('compareTEVConnect')} />;
      case '30hrs': return <BestText text={t('compare30Hrs')} />;
      case 'transformative': return <BestText text={t('compareTransformative')} />;
      default: return null;
    }
  }

  return (
    <section id="compare" className="py-24 px-6 lg:px-12 bg-white">
      <div className="max-w-[960px] mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-brand-teal font-semibold mb-6">
            {t('compareEyebrow')}
          </p>
          <h2
            className="font-[family-name:var(--font-display)] font-light leading-[1.25] text-brand-charcoal mb-8"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            {t('compareTitle')} <em className="italic text-brand-teal">{t('compareTitleEm')}</em>
          </h2>
          <p className="text-[0.92rem] leading-[1.8] text-brand-brown font-light max-w-[600px] mx-auto">
            {t('compareDesc')}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr>
                <th className="text-left p-4 pb-5 border-b-2 border-black/[0.06] w-[34%]" />
                <th className="text-center p-4 pb-5 border-b-2 border-black/[0.06] align-bottom">
                  <span className="font-[family-name:var(--font-display)] text-[1.25rem] font-medium text-brand-charcoal block mb-1">
                    {t('compareChatGPT')}
                  </span>
                  <span className="text-[0.65rem] uppercase tracking-[0.12em] text-brand-text-light font-medium">
                    {t('compareChatGPTSub')}
                  </span>
                </th>
                <th className="text-center p-4 pb-5 border-b-2 border-black/[0.06] align-bottom bg-brand-teal/[0.06] relative">
                  <span className="inline-block bg-brand-teal text-brand-deep-green text-[0.55rem] uppercase tracking-[0.15em] font-bold px-3 py-1 mb-2">
                    {t('compareBadgeGreat')}
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-[1.25rem] font-medium text-brand-deep-green block mb-1">
                    {t('compareEvolvedAI')}
                  </span>
                  <span className="text-[0.65rem] uppercase tracking-[0.12em] text-brand-text-light font-medium">
                    {t('compareEvolvedAISub')}
                  </span>
                </th>
                <th className="text-center p-4 pb-5 border-b-2 border-black/[0.06] align-bottom bg-brand-mint/[0.18] relative">
                  <span className="inline-block bg-brand-deep-green text-brand-cream text-[0.55rem] uppercase tracking-[0.15em] font-bold px-3 py-1 mb-2">
                    {t('compareBadgeFull')}
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-[1.25rem] font-medium text-brand-teal-dark block mb-1">
                    {t('compareCoaching')}
                  </span>
                  <span className="text-[0.65rem] uppercase tracking-[0.12em] text-brand-text-light font-medium">
                    {t('compareCoachingSub')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="text-left p-4 border-b border-black/[0.04] text-[0.84rem] font-medium text-brand-charcoal">
                    {row.label}
                  </td>
                  <td className="text-center p-4 border-b border-black/[0.04] text-[0.82rem] text-brand-brown font-light align-middle">
                    {renderCell(row.chatgpt)}
                  </td>
                  <td className="text-center p-4 border-b border-black/[0.04] text-[0.82rem] text-brand-brown font-light align-middle bg-brand-teal/[0.06]">
                    {renderCell(row.ai)}
                  </td>
                  <td className="text-center p-4 border-b border-black/[0.04] text-[0.82rem] text-brand-brown font-light align-middle bg-brand-mint/[0.18]">
                    {renderCell(row.coaching)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="p-5 border-t-2 border-black/[0.06]" />
                <td className="text-center p-5 border-t-2 border-black/[0.06]">
                  <span className="text-[0.75rem] text-brand-text-light italic">{t('compareChatGPTNote')}</span>
                </td>
                <td className="text-center p-5 border-t-2 border-black/[0.06] bg-brand-teal/[0.06]">
                  <a
                    href={KAJABI_CHECKOUT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-2.5 text-[0.65rem] uppercase tracking-[0.18em] font-semibold bg-brand-teal text-brand-deep-green hover:bg-brand-deep-green hover:text-brand-cream transition-all duration-300 no-underline"
                  >
                    {t('compareAICtaText')}
                  </a>
                </td>
                <td className="text-center p-5 border-t-2 border-black/[0.06] bg-brand-mint/[0.18]">
                  <a
                    href="https://evolvedvets.com/coaching"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-2.5 text-[0.65rem] uppercase tracking-[0.18em] font-semibold bg-brand-deep-green text-brand-cream hover:bg-brand-teal hover:text-brand-deep-green transition-all duration-300 no-underline"
                  >
                    {t('compareCoachingCtaText')}
                  </a>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Note */}
        <p className="text-center mt-10 text-[0.82rem] text-brand-brown font-light italic leading-[1.7] max-w-[600px] mx-auto">
          {t('compareBottomNote')}
        </p>
      </div>
    </section>
  );
}
