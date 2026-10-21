'use client';
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { ChatSession } from '@/lib/useChatSession';
import { btnGhost, kicker, label, pageTitle } from '@/lib/ui';
import { Avatar, Dots, Split, tilt } from './Bits';

export function WaitingView({ chat }: { chat: ChatSession }) {
  const { session } = chat;
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (session) setLink(`${window.location.origin}/r/${session.roomId}`); }, [session]);
  if (!session) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch { /* clipboard blocked; the field is selectable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Split
      left={<>
        <p className={kicker}>03 — Share</p>
        <h2 className={pageTitle}>Waiting for {session.peer}</h2>
        <div className="flex items-center gap-3 text-sm text-neutral-800"><Dots /> Room is open. Keep this tab open.</div>
        <p className="m-0 max-w-[44ch] text-[13px] text-neutral-700">
          The link works once, for one person. It expires if nobody joins within 30 minutes, or as soon as you leave.
        </p>
      </>}
      right={<>
        <div>
          <label className={label} htmlFor="invite-link">Invitation link</label>
          <div className="flex">
            <input
              id="invite-link"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="min-h-14 w-full min-w-0 rounded-l-2xl border-2 border-r-0 border-ink/20 bg-surface pl-5 pr-3 font-mono text-sm focus-visible:border-accent focus-visible:outline-none"
            />
            <button
              onClick={copy}
              className="group relative inline-flex min-h-14 min-w-[120px] flex-none items-center justify-center gap-2 overflow-hidden rounded-r-2xl bg-ink text-sm font-extrabold text-bg transition-all duration-200 before:absolute before:inset-0 before:bg-accent before:transition-transform before:duration-300 hover:before:translate-x-full active:scale-x-[0.98]"
            >
              <span className="relative z-10 flex items-center gap-2">
                {copied ? <Check size={16} aria-hidden className="text-green-400" /> : <Copy size={16} aria-hidden className="transition-transform group-hover:scale-110" />}
                {copied ? 'Copied!' : 'Copy link'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-y-2 border-divider">
          <div className="border-r border-divider py-4 pr-4">
            <div className="text-xs text-neutral-700">You</div>
            <div className="my-1.5 flex items-center gap-3 text-lg font-extrabold">
              <span className="-rotate-3"><Avatar name={session.me} size={44} /></span>{session.me}
            </div>
            <div className="text-xs text-neutral-700">Connected</div>
          </div>
          <div className="p-4">
            <div className="text-xs text-neutral-700">Invited</div>
            <div className="my-1.5 flex items-center gap-3 text-lg font-extrabold">
              <span className="grid h-11 w-11 flex-none animate-float place-items-center rounded-full border-2 border-dashed border-accent text-xl text-accent" style={tilt(3, 0, 3)}>?</span>
              {session.peer}
            </div>
            <div className="text-xs text-neutral-700">Not joined yet</div>
          </div>
        </div>

        <div><button className={btnGhost} onClick={chat.leave}>Cancel room</button></div>
      </>}
    />
  );
}
