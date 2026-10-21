'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useChatSession } from '@/lib/useChatSession';
import { emitAck } from '@/lib/socket';
import { errorText, normalizeName, validateName, MAX_NAME } from '@/lib/shared';
import { btnGhost, btnPrimary, btnPrimaryInner, displayTitle, fieldError, hint, input, kicker, label, pageTitle } from '@/lib/ui';
import { FloatingStack, Split } from '@/components/Bits';
import { ChatView } from '@/components/ChatView';
import { WaitingView } from '@/components/WaitingView';
import { EndedView } from '@/components/EndedView';

export default function HomePage() {
  const chat = useChatSession();
  const [step, setStep] = useState<'home' | 'create'>('home');
  const [me, setMe] = useState('');
  const [invitee, setInvitee] = useState('');
  const [meError, setMeError] = useState<string | null>(null);
  const [invError, setInvError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (chat.phase === 'active') return <ChatView chat={chat} />;
  if (chat.phase === 'waiting') return <WaitingView chat={chat} />;
  if (chat.phase === 'ended') {
    return <EndedView reason={chat.endReason} onAction={() => { chat.reset(); setStep('home'); setInvitee(''); }} />;
  }

  const toCreate = (e: FormEvent) => {
    e.preventDefault();
    const err = validateName(me);
    setMeError(err);
    if (!err) setStep('create');
  };

  const createRoom = async (e: FormEvent) => {
    e.preventDefault();
    let err = validateName(invitee);
    if (!err && normalizeName(invitee) === normalizeName(me)) err = errorText('same-name');
    setInvError(err);
    if (err) return;
    setBusy(true);
    const r = await emitAck<{ ok: boolean; error?: string; roomId: string; token: string; me: string; peer: string }>('room:create', { name: me, invitee });
    setBusy(false);
    if (!r.ok) return setInvError(errorText(r.error));
    chat.start({ roomId: r.roomId, token: r.token, role: 'creator', me: r.me, peer: r.peer }, 'waiting');
  };

  if (step === 'create') {
    return (
      <Split
        left={<>
          <p className={kicker}>02 — Invite</p>
          <h2 className={pageTitle}>Who are you talking to?</h2>
          <p className="m-0 max-w-[44ch] text-neutral-800">
            They&apos;ll need to type this exact name to get in. It isn&apos;t a password — anyone with the link and the name could join — so share the link directly with them.
          </p>
        </>}
        right={
          <form onSubmit={createRoom} className="flex flex-col gap-6" noValidate>
            <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 border-b-2 border-divider pb-4">
              <span className="text-xs text-neutral-700">You</span>
              <span className="flex justify-between gap-2"><strong className="text-xl">{me.trim()}</strong>
                <button type="button" className={btnGhost} onClick={() => setStep('home')}>Change</button></span>
            </div>
            <div>
              <label className={label} htmlFor="invitee">Their name</label>
              <input id="invitee" className={input} placeholder="e.g. Alex" maxLength={MAX_NAME} autoComplete="off" autoFocus
                value={invitee} aria-invalid={!!invError} onChange={(e) => { setInvitee(e.target.value); setInvError(null); }} />
              {invError && <div role="alert" className={fieldError}>{invError}</div>}
              <div className={hint}>Not case-sensitive. Must differ from your name.</div>
            </div>
            <button type="submit" className={btnPrimary} disabled={busy}>
              <span className={btnPrimaryInner}>
                {busy ? 'Creating…' : 'Create room and get link'}
                <ArrowRight size={18} aria-hidden className="transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </form>
        }
      />
    );
  }

  return (
    <Split
      left={<>
        <p className={kicker}>01 — Start</p>
        <h1 className={displayTitle}>
          A conversation for two. <span className="inline-block -rotate-3 text-accent">Gone</span> when either of you leaves.
        </h1>
        <p className="m-0 max-w-[46ch] text-[17px] text-neutral-800 [text-wrap:pretty]">
          Pick a name, choose who you&apos;re inviting, and share the link. No account, no password, no email. Nothing is saved — close the tab and the chat ends for both of you.
        </p>
        <FloatingStack />
      </>}
      right={
        <form onSubmit={toCreate} className="flex flex-col gap-6" noValidate>
          <div>
            <label className={label} htmlFor="me">Your name in this chat</label>
            <input id="me" className={input} placeholder="Your name" maxLength={MAX_NAME} autoComplete="off"
              value={me} aria-invalid={!!meError} onChange={(e) => { setMe(e.target.value); setMeError(null); }} />
            {meError && <div role="alert" className={fieldError}>{meError}</div>}
            <div className={hint}>Only used for this session. Up to {MAX_NAME} characters.</div>
          </div>
          <button type="submit" className={btnPrimary}>
            <span className={btnPrimaryInner}>
              Create a temporary chat
              <ArrowRight size={18} aria-hidden className="transition-transform group-hover:translate-x-1" />
            </span>
          </button>
          <div className="grid grid-cols-3 border-t-2 border-divider">
            {[['No account', 'Just a name'], ['Not stored', 'Memory only'], ['Two people', 'Never a third']].map(([t, s], i) => (
              <div key={t} className={`pt-3 ${i < 2 ? 'border-r border-divider pr-3' : ''} ${i > 0 ? 'pl-3' : ''}`}>
                <div className="text-sm font-extrabold">{t}</div>
                <div className="text-xs text-neutral-700">{s}</div>
              </div>
            ))}
          </div>
        </form>
      }
      footer={
        <footer className="basis-full border-t-2 border-divider px-6 py-4 text-xs text-neutral-700 sm:px-10 lg:px-16">
          Pair keeps messages out of storage, but it can&apos;t stop the other person from taking screenshots or saving images. Messages are not end-to-end encrypted.
        </footer>
      }
    />
  );
}
