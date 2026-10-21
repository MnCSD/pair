'use client';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) socket = io({ transports: ['websocket'], reconnectionDelay: 500, reconnectionDelayMax: 2000 });
  return socket;
}

export type AckResult = { ok: boolean; error?: string; [key: string]: unknown };

export function emitAck<T extends AckResult = AckResult>(event: string, payload?: unknown, timeoutMs = 15_000): Promise<T> {
  return new Promise((resolve) => {
    getSocket()
      .timeout(timeoutMs)
      .emit(event, payload, (err: unknown, res: T) => resolve(err ? ({ ok: false, error: 'timeout' } as T) : res));
  });
}
