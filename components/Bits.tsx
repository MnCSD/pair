import type { CSSProperties, ReactNode } from 'react';

export function Header() {
  return (
    <header className="flex items-center gap-4 border-b-2 border-divider px-4 py-3">
      <span className="mr-auto flex items-center gap-2.5 text-lg font-extrabold">
        <span className="flex gap-[3px]" aria-hidden>
          <span className="h-[18px] w-2.5 bg-accent" />
          <span className="h-[18px] w-2.5 bg-ink" />
        </span>
        Pair
      </span>
      <span className="min-w-0 truncate text-xs text-neutral-700">Temporary chat for two</span>
    </header>
  );
}

/** Two equal cells split by a 2px rule; stacks on narrow screens. */
export function Split({ left, right, footer, leftClass = '' }: { left: ReactNode; right: ReactNode; footer?: ReactNode; leftClass?: string }) {
  return (
    <main className="flex flex-1 flex-wrap">
      <section className={`flex min-w-0 flex-[1_1_420px] flex-col gap-6 border-b-2 border-divider p-6 sm:p-10 md:border-b-0 md:border-r-2 lg:p-16 ${leftClass}`}>
        {left}
      </section>
      <section className="flex min-w-0 flex-[1_1_420px] flex-col justify-center p-6 sm:p-10 lg:p-16">
        <div className="flex w-full max-w-[560px] flex-col gap-6">{right}</div>
      </section>
      {footer}
    </main>
  );
}

export function Dots({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex h-4 items-end gap-[5px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 animate-hop rounded-full ${light ? 'bg-bg' : i === 1 ? 'bg-ink' : 'bg-accent'}`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export function Avatar({ name, tone = 'ink', size = 24 }: { name: string; tone?: 'ink' | 'accent'; size?: number }) {
  return (
    <span
      aria-hidden
      className={`inline-grid flex-none place-items-center rounded-full font-extrabold text-bg ${tone === 'ink' ? 'bg-ink' : 'bg-accent'}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export const tilt = (deg: number, delay = 0, duration = 6): CSSProperties =>
  ({ '--r': `${deg}deg`, animationDelay: `${delay}s`, animationDuration: `${duration}s` }) as CSSProperties;

export function FloatingStack() {
  return (
    <div aria-hidden className="relative mt-auto h-[220px] w-full max-w-[440px]">
      <div className="absolute left-0 top-2 animate-float bg-ink px-5 py-3.5 text-[22px] font-extrabold text-bg shadow-[5px_5px_0_theme(colors.accent.DEFAULT)]" style={tilt(-4, 0, 5)}>Hey you!</div>
      <div className="absolute right-[8%] top-[70px] animate-float bg-accent px-5 py-3.5 text-[22px] font-extrabold text-bg shadow-[-5px_5px_0_theme(colors.ink)]" style={tilt(3, 0.8, 6)}>hey you</div>
      <div className="absolute left-[14%] top-[146px] animate-float border-2 border-dashed border-neutral-600 px-[18px] py-3 text-xl font-extrabold text-neutral-600" style={tilt(-2, 1.6, 7)}>…poof</div>
      <div className="absolute right-0 top-0 h-7 w-7 animate-float bg-accent" style={tilt(18, 0.3, 4)} />
      <div className="absolute bottom-0 right-[30%] h-4 w-4 animate-float border-[3px] border-ink" style={tilt(-12, 1, 4.5)} />
    </div>
  );
}
