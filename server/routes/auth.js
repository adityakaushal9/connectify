const router = require('express').Router();
const { register, login, me, logout } = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', auth, me);

module.exports = router;
