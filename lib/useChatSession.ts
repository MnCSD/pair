'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emitAck, getSocket } from './socket';
import { CHUNK_BYTES, MAX_TEXT, errorText, validateImage } from './shared';

export type Role = 'creator' | 'guest';
export type Phase = 'waiting' | 'active' | 'ended';

export interface ChatMessage {
  id: string;
  mine: boolean;
  kind: 'text' | 'image';
  text?: string;
  url?: string;
  name?: string;
  at: number;
  progress?: number;
  failed?: boolean;
}

export interface Session { roomId: string; token: string; role: Role; me: string; peer: string }
export type Result = { ok: boolean; error?: string };

/**
 * Holds one ephemeral session. Everything is React state / refs only:
 * nothing is written to localStorage, sessionStorage, IndexedDB or cookies,
 * so a refresh can never restore a conversation.
 */
export function useChatSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerOnline, setPeerOnline] = useState(true);
  const [graceEndsAt, setGraceEndsAt] = useState<number | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [connected, setConnected] = useState(true);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endReason, setEndReason] = useState('');
  const ref = useRef<Session | null>(null);
  const urls = useRef(new Set<string>());

  const wipe = useCallback(() => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
    setMessages([]);
    setPeerTyping(false);
    setGraceEndsAt(null);
    setStartedAt(null);
  }, []);

  const end = useCallback((reason: string) => {
    ref.current = null;
    wipe();
    setSession(null);
    setPhase('ended');
    setEndReason(reason);
  }, [wipe]);

  const start = useCallback((s: Session, p: Exclude<Phase, 'ended'>) => {
    ref.current = s;
    setSession(s);
    setPhase(p);
    setPeerOnline(true);
    setEndReason('');
    setMessages([]);
    setStartedAt(p === 'active' ? Date.now() : null);
  }, []);

  const reset = useCallback(() => { wipe(); setPhase(null); setEndReason(''); }, [wipe]);

  useEffect(() => {
    const sock = getSocket();
    setConnected(sock.connected);

    const onActive = ({ peer }: { peer: string }) => {
      if (!ref.current) return;
      ref.current = { ...ref.current, peer };
      setSession(ref.current);
      setPhase('active');
      setStartedAt(Date.now());
    };
    const onText = (m: { id: string; from: Role; text: string; at: number }) => {
      const s = ref.current;
      if (!s) return;
      setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, { id: m.id, mine: m.from === s.role, kind: 'text', text: m.text, at: m.at }]));
    };
    const onImage = (m: { id: string; mime: string; name: string; at: number; data: ArrayBuffer }) => {
      if (!ref.current) return;
      const url = URL.createObjectURL(new Blob([m.data], { type: m.mime }));
      urls.current.add(url);
      setMessages((ms) => [...ms, { id: m.id, mine: false, kind: 'image', url, name: m.name, at: m.at }]);
    };
    const onTyping = (on: boolean) => setPeerTyping(!!on);
    const onPeer = ({ online, graceMs }: { online: boolean; graceMs?: number }) => {
      setPeerOnline(online);
      setGraceEndsAt(online ? null : Date.now() + (graceMs ?? 0));
      if (!online) setPeerTyping(false);
    };
    const onEnded = ({ reason, by }: { reason: string; by?: Role }) => {
      const s = ref.current;
      if (!s) return;
      const peer = s.peer;
      if (reason === 'expired') return end('Nobody joined before the invitation expired.');
      if (by === s.role) return end(reason === 'left' ? 'You left the chat.' : 'You were disconnected for too long.');
      end(reason === 'left' ? `${peer} left the chat.` : `${peer} disconnected.`);
    };
    const onDisconnect = () => setConnected(false);
    const onConnect = async () => {
      setConnected(true);
      const s = ref.current;
      if (!s) return;
      const r = await emitAck<{ ok: boolean; status?: Phase; peer?: string; peerOnline?: boolean }>('room:resume', { roomId: s.roomId, token: s.token });
      if (!r.ok) return end('You were disconnected for too long.');
      if (r.status === 'active' && ref.current && r.peer) {
        ref.current = { ...ref.current, peer: r.peer };
        setSession(ref.current);
        setPhase((p) => { if (p === 'waiting') setStartedAt(Date.now()); return 'active'; });
      }
      setPeerOnline(r.peerOnline !== false);
    };
    const onPageHide = () => { if (ref.current) sock.emit('room:closing'); };

    sock.on('room:active', onActive);
    sock.on('msg:text', onText);
    sock.on('msg:image', onImage);
    sock.on('typing', onTyping);
    sock.on('peer:status', onPeer);
    sock.on('room:ended', onEnded);
    sock.on('disconnect', onDisconnect);
    sock.on('connect', onConnect);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      sock.off('room:active', onActive);
      sock.off('msg:text', onText);
      sock.off('msg:image', onImage);
      sock.off('typing', onTyping);
      sock.off('peer:status', onPeer);
      sock.off('room:ended', onEnded);
      sock.off('disconnect', onDisconnect);
      sock.off('connect', onConnect);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [end]);

  // Navigating away inside the app counts as leaving.
  useEffect(() => () => {
    if (ref.current) getSocket().emit('room:leave');
    ref.current = null;
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
  }, []);

  const sendText = useCallback(async (text: string): Promise<Result> => {
    const t = text.trim();
    if (!t) return { ok: false };
    if (t.length > MAX_TEXT) return { ok: false, error: errorText('invalid-text') };
    const r = await emitAck('msg:text', { text: t });
    return r.ok ? { ok: true } : { ok: false, error: errorText(r.error) };
  }, []);

  const sendImage = useCallback(async (file: File): Promise<Result> => {
    if (!ref.current) return { ok: false };
    const invalid = validateImage(file);
    if (invalid) return { ok: false, error: invalid };
    const localId = 'local-' + crypto.randomUUID();
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    setMessages((ms) => [...ms, { id: localId, mine: true, kind: 'image', url, name: file.name, at: Date.now(), progress: 0 }]);
    const patch = (p: Partial<ChatMessage>) => setMessages((ms) => ms.map((m) => (m.id === localId ? { ...m, ...p } : m)));
    const fail = (code?: string): Result => { patch({ failed: true }); return { ok: false, error: errorText(code) }; };

    const started = await emitAck<{ ok: boolean; id?: string; error?: string }>('img:start', { mime: file.type, size: file.size, name: file.name.slice(0, 120) });
    if (!started.ok || !started.id) return fail(started.error);
    for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
      if (!ref.current) return { ok: false };
      const data = await file.slice(offset, offset + CHUNK_BYTES).arrayBuffer();
      const r = await emitAck('img:chunk', { id: started.id, data });
      if (!r.ok) { getSocket().emit('img:cancel', { id: started.id }); return fail(r.error); }
      patch({ progress: Math.round(Math.min(1, (offset + CHUNK_BYTES) / file.size) * 99) });
    }
    const done = await emitAck<{ ok: boolean; at?: number; error?: string }>('img:end', { id: started.id });
    if (!done.ok) return fail(done.error);
    patch({ progress: 100, at: done.at ?? Date.now() });
    return { ok: true };
  }, []);

  const setTyping = useCallback((on: boolean) => { if (ref.current) getSocket().emit('typing', on); }, []);

  const leave = useCallback(() => {
    if (ref.current) getSocket().emit('room:leave');
    end('You left the chat.');
  }, [end]);

  return {
    session, phase, messages, peerOnline, graceEndsAt, peerTyping, connected, startedAt, endReason,
    start, reset, sendText, sendImage, setTyping, leave,
  };
}

export type ChatSession = ReturnType<typeof useChatSession>;
