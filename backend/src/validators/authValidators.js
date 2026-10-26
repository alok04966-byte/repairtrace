const { isValidPhoneNumber, parsePhoneNumberFromString } = require('libphonenumber-js');
const validator = require('validator');

const MAX_BCRYPT_PASSWORD_BYTES = 72;

function validateRegistration(body) {
  const errors = {};
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  if (Object.prototype.hasOwnProperty.call(source, 'role')) {
    errors.role = 'Role cannot be supplied during public registration.';
  }

  const name = typeof source.name === 'string' ? source.name.trim() : '';
  if (name.length < 2 || name.length > 100) errors.name = 'Name must be between 2 and 100 characters.';

  const email = typeof source.email === 'string' ? source.email.trim().toLowerCase() : '';
  if (!validator.isEmail(email)) errors.email = 'Enter a valid email address.';

  const phone = typeof source.phone === 'string' ? source.phone.trim() : '';
  const parsedPhone = parsePhoneNumberFromString(phone);
  if (!phone.startsWith('+') || !parsedPhone || parsedPhone.number !== phone || !isValidPhoneNumber(phone)) {
    errors.phone = 'Enter a valid international phone number in E.164 format.';
  }

  const password = typeof source.password === 'string' ? source.password : '';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (Buffer.byteLength(password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES) errors.password = 'Password is too long.';

  return { errors, value: { name, email, phone, password } };
}

function validateLogin(body) {
  const errors = {};
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  const email = typeof source.email === 'string' ? source.email.trim().toLowerCase() : '';
  if (!validator.isEmail(email)) errors.email = 'Enter a valid email address.';

  const password = typeof source.password === 'string' ? source.password : '';
  if (!password) errors.password = 'Password is required.';
  else if (Buffer.byteLength(password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES) errors.password = 'Password is too long.';

  return { errors, value: { email, password } };
}

module.exports = { validateRegistration, validateLogin };
