'use client';
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type DragEvent } from 'react';
import { ArrowRight, ImagePlus, LogOut, X, AlertCircle, Upload } from 'lucide-react';
import type { ChatSession } from '@/lib/useChatSession';
import { validateImage, ALLOWED_MIME } from '@/lib/shared';
import { btnGhost } from '@/lib/ui';
import { Avatar, Dots } from './Bits';

const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function ChatView({ chat }: { chat: ChatSession }) {
  const { session, messages, peerOnline, graceEndsAt, peerTyping, connected, startedAt } = chat;
  const me = session?.me ?? '';
  const peer = session?.peer ?? '';
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [dragging, setDragging] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const dragCounter = useRef(0);
  const blocked = !peerOnline || !connected;
  const sending = messages.some((m) => m.mine && m.kind === 'image' && !m.failed && (m.progress ?? 100) < 100);

  useEffect(() => {
    if (!graceEndsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [graceEndsAt]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom || messages[messages.length - 1]?.mine) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, peerTyping]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setLightbox(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const autosize = () => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  const onDraft = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    autosize();
    chat.setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => chat.setTyping(false), 1500);
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const invalid = validateImage(file);
    if (invalid) return setError(invalid);
    setError(null);
    setPending({ file, url: URL.createObjectURL(file) });
  };

  const handleFile = (file: File) => {
    if (blocked) return;
    const invalid = validateImage(file);
    if (invalid) return setError(invalid);
    setError(null);
    setPending({ file, url: URL.createObjectURL(file) });
  };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer?.types.includes('Files')) setDragging(true);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer?.files?.[0];
    if (file && ALLOWED_MIME.includes(file.type)) handleFile(file);
    else if (file) setError(`"${file.name}" can't be sent. Use JPEG, PNG, WebP or GIF.`);
  };

  const send = async () => {
    if (blocked || sending) return;
    setError(null);
    const p = pending;
    const text = draft;
    if (p) {
      setPending(null);
      chat.sendImage(p.file).then((r) => { if (!r.ok && r.error) setError(r.error); });
    }
    if (text.trim()) {
      setDraft('');
      requestAnimationFrame(autosize);
      clearTimeout(typingTimer.current);
      chat.setTyping(false);
      const r = await chat.sendText(text);
      if (!r.ok) { setError(r.error ?? 'Message not sent.'); setDraft(text); }
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };

  const graceLeft = graceEndsAt ? Math.max(0, Math.ceil((graceEndsAt - now) / 1000)) : 0;

  return (
    <main
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dragging && !blocked && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-accent/95 text-bg">
          <Upload size={48} strokeWidth={2.5} />
          <span className="text-xl font-extrabold">Drop image to send</span>
          <span className="text-sm opacity-80">JPEG, PNG, WebP, or GIF up to 5 MB</span>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] border-b-2 border-divider">
        <div className="min-w-0 border-r border-divider px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.08em] text-neutral-700">{connected ? 'You' : 'Reconnecting…'}</div>
          <div className="flex items-center gap-2 truncate text-base font-extrabold"><Avatar name={me} size={28} />{me}</div>
        </div>
        <div className="min-w-0 border-r border-divider px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.08em] text-neutral-700">{peerOnline ? 'Online' : 'Reconnecting…'}</div>
          <div className="flex items-center gap-2 truncate text-base font-extrabold"><Avatar name={peer} tone={peerOnline ? 'ink' : 'accent'} size={28} />{peer}</div>
        </div>
        <button
          onClick={chat.leave}
          className="mx-4 my-2.5 inline-flex items-center gap-2 rounded-xl border-2 border-accent/30 px-4 py-2 text-sm font-extrabold text-accent transition-all duration-200 hover:border-accent hover:bg-accent hover:text-bg active:scale-[0.98]"
        >
          <LogOut size={16} aria-hidden className="transition-transform group-hover:-translate-x-0.5" />
          <span className="hidden sm:inline">Leave chat</span>
          <span className="sm:hidden">Leave</span>
        </button>
      </div>

      {!peerOnline && (
        <div role="status" className="flex items-center gap-3 bg-accent px-4 py-2 text-[13px] font-semibold text-bg">
          <Dots light /> {peer} disconnected. Ending the chat in {graceLeft}s unless they reconnect.
        </div>
      )}
      {!connected && peerOnline && (
        <div role="status" className="flex items-center gap-3 bg-ink px-4 py-2 text-[13px] font-semibold text-bg">
          <Dots light /> Connection lost. Reconnecting…
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-6">
          <div className="max-w-[480px] self-center rounded-2xl bg-surface px-4 py-2.5 text-xs text-neutral-800">
            Session started {startedAt ? time(startedAt) : ''}. Nothing here is saved. If either of you leaves, this conversation is deleted.
          </div>

          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col gap-1 ${m.mine ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-700">
                {m.mine ? (<>{time(m.at)} · {me}<Avatar name={me} /></>) : (<><Avatar name={peer} tone="accent" />{peer} · {time(m.at)}</>)}
              </div>

              {m.kind === 'text' && (
                <div className={`max-w-[min(80%,520px)] whitespace-pre-wrap break-words px-[18px] py-3 text-[15px] ${m.mine
                  ? 'rounded-[22px_22px_6px_22px] bg-ink text-bg shadow-[4px_4px_0_theme(colors.accent.DEFAULT)]'
                  : 'rounded-[22px_22px_22px_6px] bg-accent-100 text-accent-900 shadow-[-4px_4px_0_theme(colors.ink)]'}`}>
                  {m.text}
                </div>
              )}

              {m.kind === 'image' && m.url && (
                <div className={`relative max-w-[min(80%,360px)] overflow-hidden border-[3px] ${m.mine
                  ? 'rounded-[20px_20px_6px_20px] border-ink bg-ink shadow-[4px_4px_0_theme(colors.accent.DEFAULT)]'
                  : 'rounded-[20px_20px_20px_6px] border-accent-100 bg-surface shadow-[-4px_4px_0_theme(colors.ink)]'}`}>
                  <button onClick={() => setLightbox(m.url!)} className="block cursor-zoom-in" aria-label={`Open image ${m.name ?? ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.name ?? 'Image'} className={`block max-h-80 max-w-full ${m.mine && (m.progress ?? 100) < 100 ? 'opacity-50' : ''}`} />
                  </button>
                  {m.mine && !m.failed && (m.progress ?? 100) < 100 && (
                    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-ink px-2 py-1.5 text-[11px] text-bg">
                      <span>Sending… {m.progress}%</span>
                      <div className="h-[3px] rounded-full bg-neutral-700"><div className="h-[3px] rounded-full bg-accent transition-[width]" style={{ width: `${m.progress}%` }} /></div>
                    </div>
                  )}
                  {m.failed && (
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-accent px-2 py-1.5 text-[11px] font-semibold text-bg">
                      <AlertCircle size={13} aria-hidden /> Not sent
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {peerTyping && (
            <div className="flex items-center gap-2.5 self-start rounded-[22px_22px_22px_6px] bg-accent-100 px-4 py-2.5 text-xs text-accent-900">
              <Dots /> {peer} is typing
            </div>
          )}
        </div>
      </div>

      <div className="border-t-2 border-divider bg-bg">
        <div className="mx-auto flex max-w-[760px] flex-col gap-2 px-4 py-3">
          {error && (
            <div role="alert" className="flex items-center justify-between gap-2 rounded-full bg-accent-100 py-2 pl-4 pr-2 text-[13px] text-accent-800">
              {error}
              <button className={btnGhost + ' text-xs'} onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}
          {pending && (
            <div className="flex items-center gap-3 rounded-[18px] border border-divider bg-surface p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pending.url} alt="Selected image" className="h-14 w-14 flex-none rounded-xl object-cover" />
              <div className="min-w-0 flex-1 text-[13px]">
                <div className="truncate font-semibold">{pending.file.name}</div>
                <div className="text-xs text-neutral-700">
                  {pending.file.size < 1048576 ? `${Math.round(pending.file.size / 1024)} KB` : `${(pending.file.size / 1048576).toFixed(1)} MB`} · ready to send
                </div>
              </div>
              <button aria-label="Remove image" onClick={() => setPending(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-neutral-200">
                <X size={16} aria-hidden />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onFile} />
            <button
              aria-label="Attach image"
              disabled={blocked}
              onClick={() => fileRef.current?.click()}
              className="grid h-12 w-12 flex-none place-items-center rounded-xl border-2 border-ink/20 transition-all duration-200 hover:border-ink hover:bg-ink hover:text-bg active:scale-[0.95] disabled:opacity-50"
            >
              <ImagePlus size={18} aria-hidden />
            </button>
            <textarea
              ref={textRef}
              rows={1}
              value={draft}
              onChange={onDraft}
              onKeyDown={onKeyDown}
              disabled={blocked}
              aria-label="Message"
              placeholder={!peerOnline ? `Waiting for ${peer} to reconnect…` : `Message ${peer}`}
              className="max-h-[140px] min-h-12 w-full resize-none rounded-3xl border border-divider bg-surface px-[18px] py-3 text-[15px] caret-accent placeholder:text-neutral-600 hover:border-ink/45 focus-visible:border-accent focus-visible:outline-none disabled:opacity-[.45]"
            />
            <button
              onClick={send}
              disabled={blocked || sending || (!draft.trim() && !pending)}
              className="group relative inline-flex h-12 min-w-[104px] flex-none items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-ink text-sm font-extrabold text-bg transition-all duration-200 before:absolute before:inset-0 before:bg-accent before:transition-transform before:duration-300 hover:shadow-lg hover:shadow-accent/25 hover:before:translate-x-full active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:before:translate-x-0"
            >
              <span className="relative z-10 flex items-center gap-2.5 px-5">
                Send
                <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>
          <div className="text-[11px] text-neutral-700">Enter to send · Shift+Enter for new line · Drag and drop or click to attach images (5 MB max)</div>
        </div>
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-label="Image preview"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-neutral-900/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Full-size image" className="max-h-[80vh] max-w-[min(92vw,1200px)] rounded-[20px] object-contain" />
          <button className="rounded-xl border-2 border-bg/30 px-6 py-2.5 text-sm font-extrabold text-bg transition-all duration-200 hover:border-bg hover:bg-bg hover:text-ink active:scale-[0.98]">Close</button>
        </div>
      )}
    </main>
  );
}
