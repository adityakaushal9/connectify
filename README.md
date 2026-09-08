# Connectify — Real-Time Video Chat & Collaboration

Full-stack MERN video calling app with shareable rooms, live chat, and screen sharing. Built with React, Node.js, Express, MongoDB, Socket.IO & WebRTC.

![Stack](https://img.shields.io/badge/MERN-FullStack-green) ![WebRTC](https://img.shields.io/badge/WebRTC-Mesh-blue) ![Socket.IO](https://img.shields.io/badge/Socket.IO-Signaling-black) ![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38bdf8)

Live Demo: _add your Render/Vercel URLs here_
- Client: `https://your-client.onrender.com`
- API: `https://your-api.onrender.com`

## Features

- **Auth** — JWT in httpOnly cookie (`SameSite=lax`, `Secure` in prod) + Bearer fallback, bcrypt hashing, `/api/auth/me` session guard
- **Video Rooms** — WebRTC mesh (2–6 peers), STUN + configurable TURN, shareable `/room/:id` links, no login required to join
- **Signaling** — Socket.IO: `join-room` → `user-connected` → `offer`/`answer` → `ice-candidate`, `room-full` reject at 6 peers
- **Chat** — In-room real-time `send-message` → `receive-message`
- **Controls** — Mute, camera toggle (audio-only fallback), screen share via `replaceTrack()` with auto-revert, ICE restart on failure
- **Security** — Helmet, CORS pinned to `CLIENT_URL`, auth rate-limit 50/15min, cookies `httpOnly`

## Tech Stack

**Frontend (`/client`):** React 18, Vite 5, React Router 6, Socket.IO Client, Tailwind CSS, Lucide Icons
**Backend (`/server`):** Node.js, Express 4, Socket.IO 4, Mongoose 8, jsonwebtoken, bcryptjs, cookie-parser, helmet, express-rate-limit, dotenv

## Project Structure

```
connectify/
  client/ — src/pages/Room.jsx, src/context/WebRTCContext.jsx, src/components/VideoCall, Controls, ChatSidebar
  server/ — server.js (Express + Socket.IO shared HTTP), socket/signaling.js, routes/, controllers/, models/, middleware/
```

## Quick Start

Prerequisites: Node 18+, MongoDB URI

```bash
# Backend :5000
cd server
npm install
Copy-Item .env.example .env  # Windows (cp on mac/linux)
# set MONGO_URI, JWT_SECRET, CLIENT_URL, PORT=5000
npm run dev

# Frontend :5173 (new terminal)
cd client
npm install
Copy-Item .env.example .env
# set VITE_SERVER_URL=http://localhost:5000
npm run dev
```

Open `http://localhost:5173`, register, create room, open second tab with same `/room/:id` to test call + chat.

### Env

**server/.env:**
```
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=super-secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

**client/.env:**
```
VITE_SERVER_URL=http://localhost:5000
VITE_TURN_URL=
VITE_ICE_SERVERS=
```

## Deployment (Render Free Tier)

- **API:** Web Service, root `server`, build `npm install`, start `npm start`, env `NODE_ENV=production`, `CLIENT_URL=https://your-client...` (no trailing slash)
- **Web:** Static Site, root `client`, build `npm install; npm run build`, publish `dist`, env `VITE_SERVER_URL` set **before** build (baked in)
- Add SPA rewrite `/* → /index.html` or `/room/:id` refresh 404s

## How It Works

1. REST auth sets httpOnly `token` cookie. `App.jsx` checks `/api/auth/me`.
2. `WebRTCContext.jsx` owns socket + `RTCPeerConnection`s. Join emits `join-room`.
3. Server `signaling.js` tracks ephemeral rooms, broadcasts `user-connected`.
4. Peers exchange SDP + ICE directly (mesh). Chat relays via server. Disconnect emits `user-disconnected`.

Limit: mesh = ~6 peers max. For larger rooms use SFU (LiveKit/mediasoup).

## Author

**Aditya Kaushal** — MERN Stack Developer
GitHub: https://github.com/adityakaushal9
