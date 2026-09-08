# Connectify — MERN video calling (mesh P2P + LiveKit SFU)

Two call paths, one app: **mesh** (`/room/:id`, raw WebRTC, ≤6 peers) and **SFU** (`/live/:id`, LiveKit relay, works on strict mobile NATs).

## Run locally
```powershell
# server (:5000)
cd server; npm install; Copy-Item .env.example .env; npm run dev
# client (:5173)
cd client; npm install; Copy-Item .env.example .env; npm run dev
```
`server/.env` needs `MONGO_URI` (local `mongodb://127.0.0.1:27017/connectify` works) + `JWT_SECRET`.

## Enable the SFU path (free tier)
1. Create a project at LiveKit Cloud → copy its WS URL + API key/secret.
2. `server/.env`: set `LIVEKIT_URL` (wss://…), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. No client env needed — the SFU URL comes from the token response.
3. Dashboard → "Try SFU call". If `/api/livekit/token` 500s, the `LIVEKIT_*` vars are missing.

## Deploy (Render free tier)
- Server = Web Service (root `server`, `npm start`) + `NODE_ENV=production`, `CLIENT_URL`=client origin, Atlas `MONGO_URI`, `LIVEKIT_*`.
- Client = Static Site (root `client`, build `npm install; npm run build`, publish `dist`) + `VITE_SERVER_URL`, rewrite `/* → /index.html`.
- Mesh TURN (optional): `VITE_TURN_URL/USER/PASS`. Never set `VITE_ICE_SERVERS` alongside them (early-return skips TURN).

## How it works (learn the lifecycle)
- Mesh: `join-room` → `user-connected` → `offer`/`answer` → `ice-candidate` → P2P media (`server/socket/signaling.js`, `client/src/context/WebRTCContext.jsx`).
- SFU: `POST /api/livekit/token` (auth-guarded, identity = DB user) → `room.connect` → publish camera/mic → `TrackSubscribed` → attach (`client/src/pages/LiveRoom.jsx`, `server/controllers/livekitController.js`).
