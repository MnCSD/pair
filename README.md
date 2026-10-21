# Pair — temporary chat for two

A two-person, real-time chat with no accounts and no storage. Text and images live only in memory and disappear for both people when either one leaves.

Next.js 14 (App Router) · React · TypeScript · Tailwind CSS · Socket.IO on a custom Node server. No database.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

To test, open two separate browser profiles (or one normal window and one private window). Create a room in the first, then open the invitation link in the second.

## Production

```bash
npm install
npm run build
npm start            # NODE_ENV=production, serves Next + WebSockets on $PORT
```

Pair needs a **long-running Node process** with WebSocket support, such as Fly.io, Railway, Render, a VPS or Docker. It won't run on serverless hosts like Vercel Functions.

- Put it behind HTTPS so the browser uses `wss://`. Example for nginx: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`
- Run **one instance**. Rooms are held in that process's memory, so both participants must reach the same process. Scaling out would need sticky sessions plus a shared store, which this project deliberately avoids.
- Set `TRUST_PROXY=1` when behind a proxy so rate limits use `X-Forwarded-For`.
- Keep request and access logs free of WebSocket payloads. The app itself logs only one startup line.

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP/WebSocket port |
| `GRACE_MS` | `10000` | How long a disconnected participant has to reconnect |
| `CLOSE_GRACE_MS` | `3000` | Shorter grace period after a `pagehide` signal |
| `WAITING_TTL_MS` | `1800000` | Abandoned waiting rooms expire after this long |
| `TRUST_PROXY` | unset | `1` = read client IP from `X-Forwarded-For` |
| `ALLOWED_ORIGIN` | unset | Optional CORS origin for Socket.IO |

## Architecture

```
server.ts            Next request handler + Socket.IO on one http server
server/rooms.ts      In-memory rooms (Map), lifecycle, validation, rate limits, image relay
lib/shared.ts        Limits and validation shared by client and server
lib/socket.ts        Socket.IO client singleton + promise-based acks
lib/useChatSession   Client session state (React state/refs only)
app/page.tsx         Home → invite → waiting → chat → ended (creator)
app/r/[roomId]       Join → chat → ended (invited person)
components/          ChatView, WaitingView, EndedView, shared bits
```

**Room lifecycle** (enforced on the server): `waiting → active → terminated`. When a room terminates, it is deleted from the Map. Its ID then resolves to nothing, so links can't be reused and history can't be restored.

**Identity.** A room ID is 128 random bits. On create or join, the server assigns a role and a 192-bit resume token, which is kept in client memory only. The server binds each socket to `{roomId, role}`, and every message's sender is taken from that binding, never from the client. Usernames are compared trimmed and case-insensitively. They identify people but don't authenticate them.

**Messages** are relayed through the server and never stored. **Images** are sent in 128 KB chunks with acks (this drives the progress bar). They are reassembled in memory, checked against the declared type by magic bytes, sent to the peer, and then dropped. The receiver shows them through `blob:` URLs, which are revoked when the session ends.

**Disconnects.** When a socket drops, the server starts the grace timer and tells the other person, whose UI shows a countdown and disables input. Reconnecting within the grace period (Socket.IO auto-reconnects and the client sends `room:resume` with its in-memory token) continues the same session. Once the timer fires, the room terminates and the remaining person's history is wiped. **Leave chat** terminates immediately.

## Limitations, stated honestly

- **Tab-close detection is best effort.** Browsers don't reliably report closing. Pair combines WebSocket disconnects (detected within ~10 s via ping/pong), a `pagehide` hint that shortens the grace period, and the grace timer. A crashed browser or a dropped network looks the same as a closed tab.
- **Refreshing ends your participation.** The resume token lives only in memory, so a refresh can't rejoin, and the session ends once the grace period passes. This is intentional: nothing is ever restored.
- Messages sent while the other person is disconnected aren't queued. Input is disabled during that window.
- Not end-to-end encrypted. The server sees messages in memory while relaying them. Memory is not a guarantee against every form of capture, such as a compromised host.
- The other person can always screenshot or save images.
- A server restart drops all sessions. This is expected.

## Manual test checklist

1. Create a room as `Marios` inviting `Bella`. Join in a second profile as ` bella ` → it works, and Marios sees "Bella".
2. Join as `Belle` → error, and you can retry.
3. Open the link in a third profile after Bella joins → "already has two people".
4. Send text both ways and check the typing indicator. Send a JPEG, PNG, WebP and GIF. Try a 6 MB file and a `.pdf` → errors.
5. Toggle Wi-Fi briefly → the other side shows the countdown and recovers.
6. Close Bella's tab → within the grace period, Marios's chat is wiped and the ended screen shows.
7. Re-open the old link → "no longer works".
8. Click **Leave chat** → ends instantly for both.
