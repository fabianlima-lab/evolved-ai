'use client';

import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

function HamburgerIcon({ open }) {
  return (
    <div className="w-5 h-4 flex flex-col justify-between relative">
      <span
        className="block h-[2px] bg-txt rounded-full transition-all duration-300 origin-center"
        style={{
          transform: open ? 'translateY(7px) rotate(45deg)' : 'none',
        }}
      />
      <span
        className="block h-[2px] bg-txt rounded-full transition-all duration-300"
        style={{ opacity: open ? 0 : 1 }}
      />
      <span
        className="block h-[2px] bg-txt rounded-full transition-all duration-300 origin-center"
        style={{
          transform: open ? 'translateY(-7px) rotate(-45deg)' : 'none',
        }}
      />
    </div>
  );
}

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useTranslations('Nav');
  const tc = useTranslations('Common');

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const h = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled || menuOpen ? 'rgba(10,10,15,0.92)' : 'transparent',
        backdropFilter: scrolled || menuOpen ? 'blur(16px)' : 'none',
        borderBottom: scrolled || menuOpen ? '1px solid var(--color-border)' : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-[family-name:var(--font-display)] text-txt font-bold text-lg">
          {tc('brandName')}
        </Link>

        <div className="hidden md:flex items-center gap-7">
          <a href="#how" className="text-sm text-txt-muted hover:text-txt transition-colors">{t('howItWorks')}</a>
          <a href="#apps" className="text-sm text-txt-muted hover:text-txt transition-colors">{t('apps')}</a>
          <a href="#pricing" className="text-sm text-txt-muted hover:text-txt transition-colors">{t('pricing')}</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-txt-muted hover:text-txt transition-colors">{t('signIn')}</Link>
          <Link
            href="/signup"
            className="bg-accent text-white px-5 py-2 rounded-[var(--radius-btn)] text-sm font-semibold hover:opacity-90 transition-all"
          >
            {t('startFreeTrial')}
          </Link>
        </div>

        <button
          className="md:hidden flex items-center justify-center w-10 h-10 -mr-2"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      </div>

      <div
        className="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: menuOpen ? '320px' : '0px',
          opacity: menuOpen ? 1 : 0,
        }}
      >
        <div className="px-6 pb-6 pt-2 flex flex-col gap-4 border-t border-border">
          <a href="#how" onClick={() => setMenuOpen(false)} className="text-sm text-txt-muted hover:text-txt transition-colors py-1">{t('howItWorks')}</a>
          <a href="#apps" onClick={() => setMenuOpen(false)} className="text-sm text-txt-muted hover:text-txt transition-colors py-1">{t('apps')}</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)} className="text-sm text-txt-muted hover:text-txt transition-colors py-1">{t('pricing')}</a>
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <Link href="/login" onClick={() => setMenuOpen(false)} className="text-sm text-txt-muted hover:text-txt transition-colors">{t('signIn')}</Link>
            <Link
              href="/signup"
              onClick={() => setMenuOpen(false)}
              className="bg-accent text-white px-5 py-2.5 rounded-[var(--radius-btn)] text-sm font-semibold hover:opacity-90 transition-all text-center"
            >
              {t('startFreeTrial')}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function AppNav({ userEmail }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useTranslations('Nav');
  const tc = useTranslations('Common');
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : '??';

  const APP_LINKS = [
    { href: '/dashboard', labelKey: 'dashboard' },
    { href: '/dashboard/skills', labelKey: 'skillsApps' },
    { href: '/settings', labelKey: 'settings' },
  ];

  useEffect(() => {
    const h = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-bg/90 border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-[family-name:var(--font-display)] text-txt font-bold text-lg">
          {tc('brandName')}
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {APP_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? 'text-txt font-bold'
                  : 'text-txt-muted hover:text-txt'
              }`}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-elevated border border-border flex items-center justify-center text-xs text-txt-muted font-medium">
            {initials}
          </div>
        </div>

        <button
          className="md:hidden flex items-center justify-center w-10 h-10 -mr-2"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      </div>

      <div
        className="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: menuOpen ? '280px' : '0px',
          opacity: menuOpen ? 1 : 0,
        }}
      >
        <div className="px-6 pb-6 pt-2 flex flex-col gap-1 border-t border-border">
          {APP_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`text-sm transition-colors py-2.5 ${
                pathname === link.href
                  ? 'text-txt font-bold'
                  : 'text-txt-muted hover:text-txt'
              }`}
            >
              {t(link.labelKey)}
            </Link>
          ))}
          <div className="border-t border-border pt-3 mt-1 flex items-center justify-between">
            <div className="w-9 h-9 rounded-full bg-elevated border border-border flex items-center justify-center text-xs text-txt-muted font-medium">
              {initials}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
