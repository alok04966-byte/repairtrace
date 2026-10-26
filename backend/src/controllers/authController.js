const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { AUTH_COOKIE_NAME, getJwtSecret } = require('../config/auth');
const User = require('../models/User');
const { validateRegistration, validateLogin } = require('../validators/authValidators');

const BCRYPT_ROUNDS = 12;
const AUTH_TOKEN_LIFETIME = '7d';
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function register(req, res, next) {
  const { errors, value } = validateRegistration(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  try {
    const passwordHash = await bcrypt.hash(value.password, BCRYPT_ROUNDS);
    const user = await User.create({
      name: value.name,
      email: value.email,
      phone: value.phone,
      passwordHash,
      role: 'customer'
    });
    return res.status(201).json({ user: serializeUser(user) });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return next(error);
  }
}

async function login(req, res, next) {
  const { errors, value } = validateLogin(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return res.status(500).json({ error: 'Authentication is unavailable.' });
  }

  try {
    const user = await User.findOne({ email: value.email }).select('+passwordHash');
    const passwordMatches = user ? await bcrypt.compare(value.password, user.passwordHash) : false;

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ sub: user._id.toString(), role: user.role }, jwtSecret, {
      expiresIn: AUTH_TOKEN_LIFETIME
    });

    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: AUTH_COOKIE_MAX_AGE
    });

    return res.status(200).json({ user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
}

function getCurrentUser(req, res) {
  return res.status(200).json({ user: serializeUser(req.user) });
}

module.exports = { register, login, getCurrentUser };
