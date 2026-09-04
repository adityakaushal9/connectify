// JWT guard: prefers httpOnly cookie, falls back to Bearer (backward compat + mobile apps).
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = req.cookies?.token || (header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
