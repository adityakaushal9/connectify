// Register / Login / Me / Logout — JWT in httpOnly cookie (XSS-safe), Bearer kept as fallback.
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Secure cookie flags: httpOnly (no JS access), Secure in prod (HTTPS), SameSite None only when cross-site prod
const cookieOpts = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const crossSite = isProd && process.env.CLIENT_URL?.startsWith('https://');
  return { httpOnly: true, secure: isProd, sameSite: crossSite ? 'none' : 'lax', maxAge: 7 * 24 * 3600 * 1000, path: '/' };
};
const sendAuth = (res, user, status = 200) =>
  res.status(status).cookie('token', signToken(user._id), cookieOpts()).json({
    token: signToken(user._id), // kept for backward compat; client should rely on cookie
    user: { id: user._id, name: user.name, email: user.email },
  });

// POST /api/auth/register { name, email, password }
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password min 6 chars' });
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already in use' });
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password }); // pre-save hook hashes password
    sendAuth(res, user, 201);
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

// POST /api/auth/login { email, password }
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email + password required' });
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    sendAuth(res, user);
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// GET /api/auth/me (requires auth middleware)
exports.me = (req, res) => res.json({ user: req.user });

// POST /api/auth/logout — clear cookie (client also drops cached user)
exports.logout = (req, res) => res.clearCookie('token', { path: '/' }).json({ ok: true });
