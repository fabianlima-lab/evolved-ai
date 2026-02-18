'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { KAJABI_CHECKOUT_URL } from '@/lib/constants';

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo(0, top);
  window.history.replaceState(null, '', '#' + id);
}

export default function LandingNav() {
  const t = useTranslations('Landing');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
    return () => document.body.classList.remove('menu-open');
  }, [mobileOpen]);

  const navLinks = [
    { label: t('navFeatures'), id: 'features' },
    { label: t('navHowItWorks'), id: 'how' },
    { label: t('navCompare'), id: 'compare' },
    { label: t('navPricing'), id: 'pricing' },
    { label: t('navFaq'), id: 'faq' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 flex justify-between items-center transition-all duration-400 border-b border-black/[0.04] ${
        scrolled
          ? 'py-3 px-6 lg:px-12 shadow-[0_2px_20px_rgba(0,0,0,0.04)]'
          : 'py-5 px-6 lg:px-12'
      }`}
      style={{ background: 'rgba(247, 244, 238, 0.92)', backdropFilter: 'blur(12px)' }}
    >
      {/* Logo */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
        className="font-[family-name:var(--font-display)] text-[1.4rem] font-semibold tracking-[0.02em] text-brand-charcoal bg-transparent border-none cursor-pointer p-0"
      >
        The Evolved Vets <span className="font-light italic text-brand-teal">AI</span>
      </button>

      {/* Hamburger (mobile) */}
      <button
        className="md:hidden flex flex-col gap-[5px] p-1 z-[120] relative bg-transparent border-none cursor-pointer"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
        aria-expanded={mobileOpen}
      >
        <span className={`block w-[22px] h-[1.5px] bg-brand-charcoal transition-all duration-300 origin-center ${mobileOpen ? 'rotate-45 translate-x-[4.5px] translate-y-[4.5px]' : ''}`} />
        <span className={`block w-[22px] h-[1.5px] bg-brand-charcoal transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-[22px] h-[1.5px] bg-brand-charcoal transition-all duration-300 origin-center ${mobileOpen ? '-rotate-45 translate-x-[4.5px] -translate-y-[4.5px]' : ''}`} />
      </button>

      {/* Desktop Links — using buttons to bypass Next.js router interception */}
      <ul className="hidden md:flex gap-8 items-center list-none">
        {navLinks.map((link) => (
          <li key={link.id}>
            <button
              onClick={() => scrollToId(link.id)}
              className="text-[0.75rem] uppercase tracking-[0.15em] text-brand-brown font-medium hover:text-brand-teal transition-colors bg-transparent border-none cursor-pointer p-0"
            >
              {link.label}
            </button>
          </li>
        ))}
        <li>
          <a
            href={KAJABI_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand-deep-green text-brand-cream px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] font-semibold hover:bg-brand-teal hover:text-white transition-all duration-300 no-underline inline-block"
          >
            {t('navCta')}
          </a>
        </li>
      </ul>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <ul className="md:hidden fixed top-0 left-0 right-0 bottom-0 bg-brand-cream flex flex-col justify-center items-center gap-10 list-none z-[115]">
          {navLinks.map((link) => (
            <li key={link.id}>
              <button
                onClick={() => { scrollToId(link.id); setMobileOpen(false); }}
                className="text-[0.9rem] uppercase tracking-[0.15em] text-brand-charcoal font-medium bg-transparent border-none cursor-pointer p-0"
              >
                {link.label}
              </button>
            </li>
          ))}
          <li>
            <a
              href={KAJABI_CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="bg-brand-deep-green text-brand-cream px-8 py-3 text-[0.75rem] uppercase tracking-[0.18em] font-semibold hover:bg-brand-teal hover:text-white transition-all duration-300 no-underline inline-block"
            >
              {t('navCta')}
            </a>
          </li>
        </ul>
      )}
    </nav>
  );
}
