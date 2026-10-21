import { ArrowRight } from 'lucide-react';
import { btnPrimary, btnPrimaryInner, displayTitle } from '@/lib/ui';
import { tilt } from './Bits';

export function EndedView({
  title = 'This chat session has ended.',
  kickerText = 'Session terminated',
  reason,
  detail = 'The conversation and any images have been cleared, and the invitation link no longer works.',
  action = 'Start a new chat',
  onAction,
}: {
  title?: string; kickerText?: string; reason?: string; detail?: string; action?: string; onAction: () => void;
}) {
  return (
    <main className="flex flex-1 flex-wrap">
      <section className="flex min-h-[320px] min-w-0 flex-[1_1_420px] flex-col justify-end gap-6 bg-accent p-6 text-bg sm:p-10 lg:p-16">
        <div aria-hidden className="relative min-h-[120px] flex-1">
          <span className="absolute left-[4%] top-[10%] h-14 w-14 animate-float rounded-2xl border-4 border-bg" style={tilt(12, 0, 5)} />
          <span className="absolute left-[40%] top-[40%] h-7 w-7 animate-float rounded-full bg-ink" style={tilt(-20, 0.6, 4)} />
          <span className="absolute right-[10%] top-[4%] animate-float rounded-full border-2 border-dashed border-bg px-4 py-2.5 text-xl font-extrabold" style={tilt(6, 1.2, 6)}>poof</span>
        </div>
        <p className="m-0 text-[13px] font-extrabold uppercase tracking-[0.08em] opacity-[.85]">{kickerText}</p>
        <h1 className={displayTitle}>{title}</h1>
      </section>
      <section className="flex min-w-0 flex-[1_1_420px] flex-col justify-end p-6 sm:p-10 lg:p-16">
        <div className="flex w-full max-w-[560px] flex-col gap-6">
          <p className="m-0 text-[17px] text-neutral-800">{reason} {detail}</p>
          <button className={btnPrimary} onClick={onAction}>
            <span className={btnPrimaryInner}>
              {action}
              <ArrowRight size={18} aria-hidden className="transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}
