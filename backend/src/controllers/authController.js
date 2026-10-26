const bcrypt = require('bcryptjs');

const User = require('../models/User');
const { validateRegistration } = require('../validators/authValidators');

const BCRYPT_ROUNDS = 12;

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

module.exports = { register };
