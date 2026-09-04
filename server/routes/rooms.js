// Minimal room API — rooms are ephemeral (Socket.IO is source of truth).
// Provides REST touchpoint for future persistence + link validation.
const router = require('express').Router();
const auth = require('../middleware/auth');

// GET /api/rooms/:roomId — just validates format so Dashboard "join" can pre-check
router.get('/:roomId', auth, (req, res) => {
  const { roomId } = req.params;
  if (!roomId || roomId.length < 3) return res.status(400).json({ message: 'Invalid room id' });
  res.json({ roomId, joinUrl: `/room/${roomId}` });
});

module.exports = router;
