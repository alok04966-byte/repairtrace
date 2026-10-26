require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const connectDatabase = require('../src/config/db');
const User = require('../src/models/User');
const { validateRegistration } = require('../src/validators/authValidators');

const BCRYPT_ROUNDS = 12;

async function provisionStaff() {
  if (!process.env.MONGODB_URI) {
    console.error('Staff provisioning requires MONGODB_URI.');
    process.exitCode = 1;
    return;
  }

  const { errors, value } = validateRegistration({
    name: process.env.STAFF_NAME,
    email: process.env.STAFF_EMAIL,
    phone: process.env.STAFF_PHONE,
    password: process.env.STAFF_PASSWORD
  });

  if (Object.keys(errors).length > 0) {
    console.error('Staff provisioning configuration is invalid.');
    process.exitCode = 1;
    return;
  }

  try {
    await connectDatabase(process.env.MONGODB_URI);

    const existingUser = await User.findOne({ email: value.email });
    if (existingUser) {
      console.error('An account with this email already exists; it was not changed.');
      process.exitCode = 1;
      return;
    }

    const passwordHash = await bcrypt.hash(value.password, BCRYPT_ROUNDS);
    await User.create({
      name: value.name,
      email: value.email,
      phone: value.phone,
      passwordHash,
      role: 'staff'
    });

    console.log('Staff account created.');
  } catch (error) {
    if (error && error.code === 11000) {
      console.error('An account with this email already exists; it was not changed.');
    } else {
      console.error('Unable to provision staff account.');
    }
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

provisionStaff();
