// LiveKit access tokens — mints short-lived JWTs so the browser can join the SFU room.
// Requires LIVEKIT_API_KEY + LIVEKIT_API_SECRET (LiveKit Cloud dashboard, free tier).
// Route is auth-guarded: identity comes from the logged-in user, never from client input.
const { AccessToken } = require('livekit-server-sdk');

// POST /api/livekit/token { roomName } -> { token, url }
exports.createToken = async (req, res) => {
  try {
    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL)
      return res.status(500).json({ message: 'LiveKit not configured (LIVEKIT_URL/KEY/SECRET)' });

    const roomName = String(req.body.roomName || '').trim();
    if (!roomName || roomName.length < 3) return res.status(400).json({ message: 'Valid roomName required' });

    // Identity = DB user id (stable, unique); name = display name shown on tiles
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: req.user._id.toString(),
      name: req.user.name,
      ttl: '2h',
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });
    res.json({ token: await at.toJwt(), url: LIVEKIT_URL });
  } catch (err) {
    res.status(500).json({ message: 'Token minting failed', error: err.message });
  }
};
