// Entry point: Express REST API + Socket.IO signaling on one HTTP server.
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const setupSignaling = require('./socket/signaling');

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
app.set('trust proxy', 1); // correct rate-limit + secure cookies behind Render proxy
app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true })); // credentials needed for httpOnly cookie auth
app.use(express.json({ limit: '10kb' })); // block oversized JSON payloads
app.use(cookieParser());

// Brute-force guard on login/register (free, in-memory; per-instance on Render free tier)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });

// REST routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/rooms', require('./routes/rooms'));
app.get('/health', (_, res) => res.json({ ok: true }));

// Attach Socket.IO to same server (required for WebRTC signaling + chat)
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_URL, methods: ['GET', 'POST'], credentials: true } });
setupSignaling(io);

connectDB()
  .then(() => server.listen(PORT, () => console.log(`Server on :${PORT}, client: ${CLIENT_URL}`)))
  .catch((err) => {
    console.error('DB failed:', err.message);
    process.exit(1);
  });
