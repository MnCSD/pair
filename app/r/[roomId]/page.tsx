'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { useChatSession } from '@/lib/useChatSession';
import { emitAck } from '@/lib/socket';
import { errorText, validateName, MAX_NAME } from '@/lib/shared';
import { btnPrimary, btnPrimaryInner, fieldError, input, kicker, label, pageTitle } from '@/lib/ui';
import { Dots, Split } from '@/components/Bits';
import { ChatView } from '@/components/ChatView';
import { EndedView } from '@/components/EndedView';

type Info = { state: 'loading' } | { state: 'ready'; invitee: string } | { state: 'invalid'; error?: string };

export default function JoinPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const chat = useChatSession();
  const [info, setInfo] = useState<Info>({ state: 'loading' });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let live = true;
    emitAck<{ ok: boolean; error?: string; invitee?: string }>('room:info', { roomId }).then((r) => {
      if (!live) return;
      setInfo(r.ok && r.invitee ? { state: 'ready', invitee: r.invitee } : { state: 'invalid', error: r.error });
    });
    return () => { live = false; };
  }, [roomId]);

  const goHome = () => router.push('/');

  if (chat.phase === 'active') return <ChatView chat={chat} />;
  if (chat.phase === 'ended') return <EndedView reason={chat.endReason} onAction={goHome} />;

  if (info.state === 'loading') {
    return <main className="flex flex-1 items-center gap-3 p-6 text-sm text-neutral-800 sm:p-10 lg:p-16"><Dots /> Checking invitation…</main>;
  }
  if (info.state === 'invalid') {
    return (
      <EndedView
        kickerText="Invitation unavailable"
        title={info.error === 'full' ? 'This chat already has two people.' : 'This invitation no longer works.'}
        reason={info.error === 'full' ? 'Someone has already joined.' : 'The chat has ended, expired, or the link is incorrect.'}
        detail="Previous conversations can’t be recovered."
        onAction={goHome}
      />
    );
  }

  const join = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateName(name);
    if (err) return setError(err);
    setJoining(true);
    setError(null);
    const r = await emitAck<{ ok: boolean; error?: string; token: string; me: string; peer: string }>('room:join', { roomId, name });
    setJoining(false);
    if (r.ok) return chat.start({ roomId, token: r.token, role: 'guest', me: r.me, peer: r.peer }, 'active');
    if (r.error === 'ended' || r.error === 'full') return setInfo({ state: 'invalid', error: r.error });
    setError(errorText(r.error));
  };

  return (
    <Split
      left={<>
        <p className={kicker}>Invitation</p>
        <h2 className={pageTitle}>You&apos;ve been invited to a temporary chat.</h2>
        <p className="m-0 max-w-[44ch] text-neutral-800">
          This chat exists only while both of you are here. When either person leaves, it&apos;s deleted and this link stops working.
        </p>
      </>}
      right={
        <form onSubmit={join} className="flex flex-col gap-6" noValidate>
          <div className="border-b-2 border-divider pb-4">
            <div className="text-xs text-neutral-700">This invitation is for</div>
            <div className="text-[28px] font-extrabold leading-tight">{info.invitee}</div>
          </div>
          <div>
            <label className={label} htmlFor="join-name">Enter your name to join</label>
            <input id="join-name" className={input} placeholder="Your name" maxLength={MAX_NAME} autoComplete="off" autoFocus
              value={name} aria-invalid={!!error} onChange={(e) => { setName(e.target.value); setError(null); }} />
            {error && <div role="alert" className={fieldError}><AlertCircle size={16} className="mt-0.5 flex-none" aria-hidden />{error}</div>}
          </div>
          <button type="submit" className={btnPrimary} disabled={joining}>
            <span className={btnPrimaryInner}>
              {joining ? 'Checking…' : 'Join chat'}
              <ArrowRight size={18} aria-hidden className="transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </form>
      }
    />
  );
}
