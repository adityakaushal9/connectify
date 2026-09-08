const router = require('express').Router();
const auth = require('../middleware/auth');
const { createToken } = require('../controllers/livekitController');

router.post('/token', auth, createToken);

module.exports = router;
