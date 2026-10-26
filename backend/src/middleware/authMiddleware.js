const jwt = require('jsonwebtoken');

const { AUTH_COOKIE_NAME, getJwtSecret } = require('../config/auth');
const User = require('../models/User');

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;

  const cookie = cookieHeader.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const token = getCookieValue(req.headers.cookie, AUTH_COOKIE_NAME);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const jwtSecret = getJwtSecret();
  if (!jwtSecret) return res.status(500).json({ error: 'Authentication is unavailable.' });

  try {
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    if (!payload || typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'CastError') {
      return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }
    return next(error);
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden.' });
    return next();
  };
}

module.exports = { requireAuth, authorizeRoles };
