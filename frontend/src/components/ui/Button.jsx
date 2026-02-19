'use client';

import { useTranslations } from 'next-intl';

const variants = {
  primary: 'bg-accent text-brand-cream hover:opacity-90',
  ghost: 'bg-transparent border border-border text-txt-body hover:bg-elevated',
  danger: 'bg-danger text-brand-cream hover:brightness-110',
};

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  ...props
}) {
  const t = useTranslations('Common');

  return (
    <button
      className={`px-6 py-3 rounded-[var(--radius-btn)] font-semibold text-sm uppercase tracking-[0.2em] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant] || variants.primary} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {t('loading')}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
