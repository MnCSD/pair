import { randomBytes, randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { ALLOWED_MIME, CHUNK_BYTES, MAX_IMAGE_BYTES, MAX_TEXT, normalizeName, validateName } from '../lib/shared';

const GRACE_MS = Number(process.env.GRACE_MS ?? 10_000);
const CLOSE_GRACE_MS = Number(process.env.CLOSE_GRACE_MS ?? 3_000);
const WAITING_TTL_MS = Number(process.env.WAITING_TTL_MS ?? 30 * 60_000);
const UPLOAD_TTL_MS = 60_000;
const MAX_CONCURRENT_UPLOADS = 3;

type Role = 'creator' | 'guest';
type Status = 'waiting' | 'active' | 'terminated';
type EndReason = 'left' | 'disconnected' | 'expired';

interface Participant {
  name: string;
  token: string;
  socketId: string | null;
  grace: NodeJS.Timeout | null;
  graceEndsAt: number;
  closing: boolean;
}
interface Upload {
  from: Role; mime: string; name: string; size: number;
  chunks: Buffer[]; received: number; timer: NodeJS.Timeout;
}
interface Room {
  id: string;
  status: Status;
  expectedGuest: string;
  creator: Participant;
  guest: Participant | null;
  expiry: NodeJS.Timeout | null;
  uploads: Map<string, Upload>;
}
interface SocketData { roomId?: string; role?: Role }

// All state lives here, in memory. A restart discards every session.
const rooms = new Map<string, Room>();

const newId = (bytes: number) => randomBytes(bytes).toString('base64url');
const reply = (ack: unknown, res: Record<string, unknown>) => {
  if (typeof ack === 'function') ack(res);
};
const newParticipant = (name: string, socketId: string): Participant => ({
  name, token: newId(24), socketId, grace: null, graceEndsAt: 0, closing: false,
});

function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) {
      const fresh = v.filter((t) => now - t < windowMs);
      if (fresh.length) hits.set(k, fresh); else hits.delete(k);
    }
  }, windowMs).unref();
  return (key: string) => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= limit) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr);
    return true;
  };
}
const limits = {
  create: rateLimiter(10, 60_000),
  join: rateLimiter(30, 60_000),
  message: rateLimiter(40, 10_000),
  image: rateLimiter(12, 60_000),
};

function sniff(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  const head6 = buf.subarray(0, 6).toString('ascii');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export function attachRooms(io: Server) {
  const participant = (room: Room, role: Role) => (role === 'creator' ? room.creator : room.guest);
  const other = (role: Role): Role => (role === 'creator' ? 'guest' : 'creator');

  function dropUpload(room: Room, id: string) {
    const u = room.uploads.get(id);
    if (!u) return;
    clearTimeout(u.timer);
    u.chunks = [];
    room.uploads.delete(id);
  }

  // Irreversible: the room is deleted and its id can never resolve again.
  function terminate(room: Room, reason: EndReason, by?: Role) {
    if (room.status === 'terminated') return;
    room.status = 'terminated';
    if (room.expiry) clearTimeout(room.expiry);
    for (const id of [...room.uploads.keys()]) dropUpload(room, id);
    for (const p of [room.creator, room.guest]) {
      if (!p) continue;
      if (p.grace) clearTimeout(p.grace);
      const s = p.socketId ? io.sockets.sockets.get(p.socketId) : undefined;
      if (s) {
        s.emit('room:ended', { reason, by });
        s.leave(room.id);
        s.data = {};
      }
      p.socketId = null;
      p.token = '';
    }
    rooms.delete(room.id);
  }

  function context(socket: Socket) {
    const { roomId, role } = socket.data as SocketData;
    if (!roomId || !role) return null;
    const room = rooms.get(roomId);
    if (!room || room.status === 'terminated') return null;
    const me = participant(room, role);
    if (!me || me.socketId !== socket.id) return null;
    return { room, role, me };
  }

  io.on('connection', (socket) => {
    const forwarded = process.env.TRUST_PROXY === '1'
      ? String(socket.handshake.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
      : '';
    const ip = forwarded || socket.handshake.address;

    socket.on('room:create', (payload, ack) => {
      if (!limits.create(ip)) return reply(ack, { ok: false, error: 'rate' });
      if (context(socket)) return reply(ack, { ok: false, error: 'busy' });
      const name = String(payload?.name ?? '');
      const invitee = String(payload?.invitee ?? '');
      if (validateName(name) || validateName(invitee)) return reply(ack, { ok: false, error: 'invalid-name' });
      if (normalizeName(name) === normalizeName(invitee)) return reply(ack, { ok: false, error: 'same-name' });

      const room: Room = {
        id: newId(16),
        status: 'waiting',
        expectedGuest: invitee.trim(),
        creator: newParticipant(name.trim(), socket.id),
        guest: null,
        expiry: null,
        uploads: new Map(),
      };
      room.expiry = setTimeout(() => terminate(room, 'expired'), WAITING_TTL_MS);
      rooms.set(room.id, room);
      socket.join(room.id);
      socket.data = { roomId: room.id, role: 'creator' } satisfies SocketData;
      reply(ack, { ok: true, roomId: room.id, token: room.creator.token, me: room.creator.name, peer: room.expectedGuest });
    });

    socket.on('room:info', (payload, ack) => {
      if (!limits.join(ip)) return reply(ack, { ok: false, error: 'rate' });
      const room = rooms.get(String(payload?.roomId ?? ''));
      if (!room || room.status === 'terminated') return reply(ack, { ok: false, error: 'ended' });
      if (room.status !== 'waiting') return reply(ack, { ok: false, error: 'full' });
      reply(ack, { ok: true, invitee: room.expectedGuest });
    });

    socket.on('room:join', (payload, ack) => {
      if (!limits.join(ip)) return reply(ack, { ok: false, error: 'rate' });
      if (context(socket)) return reply(ack, { ok: false, error: 'busy' });
      const room = rooms.get(String(payload?.roomId ?? ''));
      if (!room || room.status === 'terminated') return reply(ack, { ok: false, error: 'ended' });
      if (room.status !== 'waiting' || room.guest) return reply(ack, { ok: false, error: 'full' });
      const name = String(payload?.name ?? '');
      if (validateName(name)) return reply(ack, { ok: false, error: 'invalid-name' });
      if (normalizeName(name) !== normalizeName(room.expectedGuest)) return reply(ack, { ok: false, error: 'mismatch' });

      room.guest = newParticipant(name.trim(), socket.id);
      room.status = 'active';
      if (room.expiry) { clearTimeout(room.expiry); room.expiry = null; }
      socket.join(room.id);
      socket.data = { roomId: room.id, role: 'guest' } satisfies SocketData;
      reply(ack, { ok: true, token: room.guest.token, me: room.guest.name, peer: room.creator.name });
      socket.to(room.id).emit('room:active', { peer: room.guest.name });
      if (!room.creator.socketId) {
        socket.emit('peer:status', { online: false, graceMs: Math.max(0, room.creator.graceEndsAt - Date.now()) });
      }
    });

    // Only a still-live room plus the in-memory token issued at create/join can resume.
    socket.on('room:resume', (payload, ack) => {
      const room = rooms.get(String(payload?.roomId ?? ''));
      const token = String(payload?.token ?? '');
      if (!room || room.status === 'terminated' || !token) return reply(ack, { ok: false, error: 'ended' });
      const role: Role | null = room.creator.token === token ? 'creator' : room.guest?.token === token ? 'guest' : null;
      if (!role) return reply(ack, { ok: false, error: 'ended' });
      const me = participant(room, role)!;
      if (me.grace) { clearTimeout(me.grace); me.grace = null; }
      const previous = me.socketId;
      me.socketId = socket.id;
      me.closing = false;
      if (previous && previous !== socket.id) io.sockets.sockets.get(previous)?.disconnect(true);
      socket.join(room.id);
      socket.data = { roomId: room.id, role } satisfies SocketData;
      socket.to(room.id).emit('peer:status', { online: true });
      const peer = participant(room, other(role));
      reply(ack, {
        ok: true,
        status: room.status,
        peer: role === 'creator' ? room.guest?.name ?? room.expectedGuest : room.creator.name,
        peerOnline: room.status === 'waiting' || !!peer?.socketId,
      });
    });

    socket.on('msg:text', (payload, ack) => {
      const ctx = context(socket);
      if (!ctx || ctx.room.status !== 'active') return reply(ack, { ok: false, error: 'inactive' });
      if (!limits.message(socket.id)) return reply(ack, { ok: false, error: 'rate' });
      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      if (!text || text.length > MAX_TEXT) return reply(ack, { ok: false, error: 'invalid-text' });
      const msg = { id: randomUUID(), from: ctx.role, text, at: Date.now() };
      io.to(ctx.room.id).emit('msg:text', msg); // relayed, never stored
      reply(ack, { ok: true, id: msg.id });
    });

    socket.on('typing', (on) => {
      const ctx = context(socket);
      if (ctx?.room.status === 'active') socket.to(ctx.room.id).emit('typing', on === true);
    });

    socket.on('img:start', (payload, ack) => {
      const ctx = context(socket);
      if (!ctx || ctx.room.status !== 'active') return reply(ack, { ok: false, error: 'inactive' });
      if (!limits.image(socket.id)) return reply(ack, { ok: false, error: 'rate' });
      const mime = String(payload?.mime ?? '');
      const size = Number(payload?.size);
      if (!ALLOWED_MIME.includes(mime)) return reply(ack, { ok: false, error: 'image-type' });
      if (!Number.isInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) return reply(ack, { ok: false, error: 'image-size' });
      const mine = [...ctx.room.uploads.values()].filter((u) => u.from === ctx.role).length;
      if (mine >= MAX_CONCURRENT_UPLOADS) return reply(ack, { ok: false, error: 'rate' });
      const id = randomUUID();
      const room = ctx.room;
      const timer = setTimeout(() => dropUpload(room, id), UPLOAD_TTL_MS);
      room.uploads.set(id, {
        from: ctx.role, mime, size, chunks: [], received: 0, timer,
        name: String(payload?.name ?? 'image').slice(0, 120),
      });
      reply(ack, { ok: true, id });
    });

    socket.on('img:chunk', (payload, ack) => {
      const ctx = context(socket);
      const id = String(payload?.id ?? '');
      const u = ctx?.room.uploads.get(id);
      if (!ctx || !u || u.from !== ctx.role) return reply(ack, { ok: false, error: 'upload' });
      const data = payload?.data;
      if (!Buffer.isBuffer(data) || data.length === 0 || data.length > CHUNK_BYTES || u.received + data.length > u.size) {
        dropUpload(ctx.room, id);
        return reply(ack, { ok: false, error: 'upload' });
      }
      u.chunks.push(data);
      u.received += data.length;
      reply(ack, { ok: true });
    });

    socket.on('img:end', (payload, ack) => {
      const ctx = context(socket);
      const id = String(payload?.id ?? '');
      const u = ctx?.room.uploads.get(id);
      if (!ctx || !u || u.from !== ctx.role) return reply(ack, { ok: false, error: 'upload' });
      const chunks = u.chunks;
      const complete = u.received === u.size;
      dropUpload(ctx.room, id);
      if (!complete || ctx.room.status !== 'active') return reply(ack, { ok: false, error: 'upload' });
      const data = Buffer.concat(chunks);
      if (sniff(data) !== u.mime) return reply(ack, { ok: false, error: 'image-type' });
      const at = Date.now();
      socket.to(ctx.room.id).emit('msg:image', { id, from: ctx.role, mime: u.mime, name: u.name, at, data });
      reply(ack, { ok: true, id, at });
      // `data` goes out of scope here; nothing keeps a reference to the buffer.
    });

    socket.on('img:cancel', (payload) => {
      const ctx = context(socket);
      const id = String(payload?.id ?? '');
      if (ctx && ctx.room.uploads.get(id)?.from === ctx.role) dropUpload(ctx.room, id);
    });

    socket.on('room:leave', () => {
      const ctx = context(socket);
      if (ctx) terminate(ctx.room, 'left', ctx.role);
    });

    // Best-effort hint from `pagehide`: shorten the grace period.
    socket.on('room:closing', () => {
      const ctx = context(socket);
      if (ctx) ctx.me.closing = true;
    });

    socket.on('disconnect', () => {
      const ctx = context(socket);
      if (!ctx) return;
      const { room, role, me } = ctx;
      me.socketId = null;
      const wait = me.closing ? CLOSE_GRACE_MS : GRACE_MS;
      me.graceEndsAt = Date.now() + wait;
      for (const [id, u] of room.uploads) if (u.from === role) dropUpload(room, id);
      io.to(room.id).emit('peer:status', { online: false, graceMs: wait });
      me.grace = setTimeout(() => terminate(room, 'disconnected', role), wait);
    });
  });
}
