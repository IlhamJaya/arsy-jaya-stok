import React from 'react';

/**
 * Header halaman konsisten (produk SaaS): eyebrow opsional, judul + ikon, deskripsi, slot aksi kanan.
 * Hanya presentational — tidak memuat data.
 */
export default function PageHeader({
  eyebrow,
  title,
  icon: Icon,
  iconClassName = 'text-brand-amber',
  iconWrapperClassName,
  children,
  actions,
  className = '',
}) {
  const wrapCls = iconWrapperClassName ?? 'bg-brand-amber/10 border border-brand-amber/25 shadow-sm';

  return (
    <header className={`mb-6 sm:mb-8 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 ${className}`}>
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-base/85 mb-2">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight t-primary flex flex-wrap items-center gap-3">
          {Icon ? (
            <span className={`inline-flex p-2 rounded-2xl ${wrapCls}`} aria-hidden>
              <Icon className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 ${iconClassName}`} />
            </span>
          ) : null}
          <span>{title}</span>
        </h1>
        {children ? (
          <div className="t-secondary text-sm mt-3 max-w-3xl leading-relaxed [&_strong]:t-primary [&_strong]:font-semibold [&_code]:text-xs">
            {children}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 shrink-0 lg:pt-1 min-h-[42px] items-center">{actions}</div>
      ) : null}
    </header>
  );
}
