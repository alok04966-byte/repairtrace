const AUTH_COOKIE_NAME = 'auth_token';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  return typeof secret === 'string' && secret.trim() ? secret : null;
}

module.exports = { AUTH_COOKIE_NAME, getJwtSecret };
