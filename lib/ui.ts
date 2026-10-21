// Shared Tailwind class strings for the Modernist look.
export const btnPrimary =
  'group relative inline-flex min-h-14 w-full items-center justify-between gap-3 overflow-hidden rounded-2xl bg-ink px-6 py-4 text-left text-[17px] font-extrabold text-bg transition-all duration-200 ' +
  'before:absolute before:inset-0 before:bg-accent before:transition-transform before:duration-300 before:ease-out ' +
  'hover:before:translate-x-full hover:shadow-lg hover:shadow-accent/25 ' +
  'active:scale-[0.98] active:before:translate-x-full ' +
  'disabled:pointer-events-none disabled:opacity-50 disabled:before:translate-x-0';

export const btnPrimaryInner = 'relative z-10 flex w-full items-center justify-between gap-3';

export const btnSecondary =
  'inline-flex items-center gap-2 rounded-xl border-2 border-ink/20 bg-transparent px-5 py-2.5 text-sm font-extrabold text-ink transition-all duration-200 ' +
  'hover:border-ink hover:bg-ink hover:text-bg ' +
  'active:scale-[0.98] disabled:opacity-50';

export const btnGhost =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-extrabold text-accent transition-all duration-200 ' +
  'hover:bg-accent hover:text-bg ' +
  'active:scale-[0.98]';

export const input =
  'w-full min-h-12 rounded-[14px] border border-divider bg-surface px-3 text-[17px] text-ink caret-accent placeholder:text-neutral-600 transition hover:border-ink/45 focus-visible:border-accent focus-visible:outline-none aria-[invalid=true]:border-accent';

export const label = 'mb-1.5 block text-xs text-ink/70';
export const hint = 'mt-1.5 text-xs text-neutral-700';
export const fieldError = 'mt-2 flex items-start gap-2 text-[13px] text-accent-700';
export const kicker = 'm-0 self-start -rotate-2 bg-accent px-2.5 py-1 text-[13px] font-extrabold uppercase tracking-[0.08em] text-bg';
export const displayTitle = 'm-0 text-[clamp(40px,6vw,76px)] font-extrabold leading-[.98] tracking-[-0.03em] [text-wrap:balance]';
export const pageTitle = 'm-0 text-[clamp(32px,4vw,52px)] font-extrabold leading-none';
