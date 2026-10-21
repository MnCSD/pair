import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { attachRooms } from './server/rooms';
import { CHUNK_BYTES } from './lib/shared';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || '0.0.0.0';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer, {
    // Images arrive in CHUNK_BYTES pieces, so frames stay small.
    maxHttpBufferSize: CHUNK_BYTES + 64 * 1024,
    pingInterval: 5000,
    pingTimeout: 5000,
    cors: process.env.ALLOWED_ORIGIN ? { origin: process.env.ALLOWED_ORIGIN } : undefined,
  });
  attachRooms(io);
  httpServer.listen(port, hostname, () => {
    // Never log message content or image data.
    console.log(`Pair ready on http://localhost:${port} (${dev ? 'dev' : 'production'})`);
  });
});
