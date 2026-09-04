# AGENTS.md — Connectify

## Run
- Server: `cd server; npm install; cp .env.example .env; npm run dev` (`:5000`, needs `MONGO_URI`, `JWT_SECRET`)
- Client: `cd client; npm install; cp .env.example .env; npm run dev` (`:5173`, needs `VITE_SERVER_URL`)
- Windows PowerShell has no `cp` — use `Copy-Item .env.example .env`.
- No root scripts, no tests/lint/typecheck — verify by running both dev servers + 2-tab call.

## Deploy (Render free tier)
- Server = Web Service, root `server`, start `npm start`; set `NODE_ENV=production` (enables `Secure` cookies), `CLIENT_URL` = exact client origin (no trailing slash).
- Client = Static Site, root `client`, build `npm install; npm run build`, publish `dist`; `VITE_SERVER_URL` is baked at build time, so set it before building.
- SPA rewrite `/* → /index.html` required, else direct `/room/:id` links 404 on refresh.

## Architecture
- `server/server.js` — Express + Socket.IO share one HTTP server (CORS pinned to `CLIENT_URL` + `credentials:true`; `helmet`, `cookie-parser`, auth rate-limit 50/15min).
- `server/socket/signaling.js` — source of truth for rooms (ephemeral, no DB, capped at `MAX_PEERS`=6 with `room-full` reject); mesh relay: `join-room` → `user-connected` → `offer`/`answer` → `ice-candidate`; chat via `send-message` → `receive-message`; cleanup on `leave-room`/`disconnect` → `user-disconnected`.
- `server/routes|controllers|models|middleware` — JWT in httpOnly cookie (`token`, `SameSite=lax`, `Secure` in prod) + Bearer fallback; `POST /api/auth/logout` clears it. Sockets are intentionally unauthenticated (shareable links).
- `client/src/context/WebRTCContext.jsx` — owns socket + all `RTCPeerConnection`s; ICE `stun:stun.l.google.com:19302`, TURN via `VITE_TURN_URL`/`VITE_ICE_SERVERS`; handles `room-full` with redirect.
- `client/src/pages/Room.jsx` composes `VideoCall` + `Controls` + `ChatSidebar`; `App.jsx` guards routes via `/api/auth/me` cookie session (`credentials:include`), profile cached in localStorage.

## Gotchas
- Screen share uses `replaceTrack()` with `track.onended` auto-revert — don't renegotiate on share toggle.
- `getUserMedia` falls back to audio-only on camera failure; `toggleVideo` no-ops without a video track.
- `restartIce()` on `iceConnectionState === 'failed'`; socket `reconnect` re-emits `join-room` to rebuild mesh.
- StrictMode double-mounts `Room` effect — `joinRoom`/`leaveRoom` must stay idempotent.
- Mesh scales to ~2–6 peers; larger rooms need an SFU.
