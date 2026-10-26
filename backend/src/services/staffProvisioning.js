const bcrypt = require('bcryptjs');

const User = require('../models/User');

const BCRYPT_ROUNDS = 12;

async function provisionStaff(config) {
  const existingUser = await User.findOne({ email: config.email }).select('+passwordHash');

  if (config.mode === 'create') {
    if (existingUser) {
      return { outcome: existingUser.role === 'staff' ? 'already-staff' : 'account-exists' };
    }

    const passwordHash = await bcrypt.hash(config.password, BCRYPT_ROUNDS);
    await User.create({
      name: config.name,
      email: config.email,
      phone: config.phone,
      passwordHash,
      role: 'staff'
    });
    return { outcome: 'created' };
  }

  if (!existingUser) return { outcome: 'not-found' };
  if (existingUser.role === 'staff') return { outcome: 'already-staff' };

  const promotion = await User.collection.updateOne(
    { _id: existingUser._id, role: 'customer' },
    { $set: { role: 'staff' } }
  );

  return { outcome: promotion.modifiedCount === 1 ? 'promoted' : 'not-promoted' };
}

module.exports = { provisionStaff };
