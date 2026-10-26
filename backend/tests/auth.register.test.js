const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const User = require('../src/models/User');

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-only-jwt-secret';
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const validRegistration = {
  name: 'Asha Sharma',
  email: 'ASHA@EXAMPLE.COM',
  phone: '+919876543210',
  password: 'Strong-password-123'
};

test('registers a customer without returning password data', async () => {
  const response = await request(app).post('/api/auth/register').send(validRegistration);

  expect(response.status).toBe(201);
  expect(response.body.user).toMatchObject({
    name: 'Asha Sharma', email: 'asha@example.com', phone: '+919876543210', role: 'customer'
  });
  expect(response.body.user).not.toHaveProperty('password');
  expect(response.body.user).not.toHaveProperty('passwordHash');

  const storedUser = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash');
  expect(storedUser.passwordHash).not.toBe(validRegistration.password);
});

test('rejects an invalid email address', async () => {
  const response = await request(app).post('/api/auth/register').send({ ...validRegistration, email: 'not-an-email' });
  expect(response.status).toBe(400);
  expect(response.body.details).toHaveProperty('email');
});

test('rejects an invalid international phone number', async () => {
  const response = await request(app).post('/api/auth/register').send({ ...validRegistration, phone: '9876543210' });
  expect(response.status).toBe(400);
  expect(response.body.details).toHaveProperty('phone');
});

test('rejects a missing or weak password', async () => {
  const response = await request(app).post('/api/auth/register').send({ ...validRegistration, password: 'short' });
  expect(response.status).toBe(400);
  expect(response.body.details).toHaveProperty('password');
});

test('rejects a password that exceeds bcrypt byte capacity', async () => {
  const response = await request(app).post('/api/auth/register').send({ ...validRegistration, password: 'a'.repeat(73) });
  expect(response.status).toBe(400);
  expect(response.body.details).toHaveProperty('password');
});

test('rejects a duplicate normalized email address', async () => {
  await request(app).post('/api/auth/register').send(validRegistration).expect(201);
  const response = await request(app).post('/api/auth/register').send({ ...validRegistration, email: 'asha@example.com' });
  expect(response.status).toBe(409);
});

test('rejects a client-supplied staff role', async () => {
  const response = await request(app).post('/api/auth/register').send({ ...validRegistration, role: 'staff' });
  expect(response.status).toBe(400);
  expect(response.body.details).toHaveProperty('role');
  expect(await User.countDocuments()).toBe(0);
});

test('logs in with normalized email and sets an HttpOnly authentication cookie', async () => {
  await request(app).post('/api/auth/register').send(validRegistration).expect(201);

  const response = await request(app).post('/api/auth/login').send({
    email: '  ASHA@EXAMPLE.COM ',
    password: validRegistration.password
  });

  expect(response.status).toBe(200);
  expect(response.body.user).toMatchObject({ email: 'asha@example.com', role: 'customer' });
  expect(response.body.user).not.toHaveProperty('password');
  expect(response.body.user).not.toHaveProperty('passwordHash');
  expect(response.body).not.toHaveProperty('token');

  const cookie = response.headers['set-cookie'].find((value) => value.startsWith('auth_token='));
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/SameSite=Lax/);
  const token = cookie.match(/^auth_token=([^;]+)/)[1];
  expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({ role: 'customer' });
});

test('returns the same generic error for an incorrect password and an unknown email', async () => {
  await request(app).post('/api/auth/register').send(validRegistration).expect(201);

  const incorrectPassword = await request(app).post('/api/auth/login').send({
    email: validRegistration.email,
    password: 'Wrong-password-123'
  });
  const unknownEmail = await request(app).post('/api/auth/login').send({
    email: 'unknown@example.com',
    password: validRegistration.password
  });

  expect(incorrectPassword.status).toBe(401);
  expect(unknownEmail.status).toBe(401);
  expect(incorrectPassword.body).toEqual({ error: 'Invalid email or password.' });
  expect(unknownEmail.body).toEqual(incorrectPassword.body);
});

test('rejects missing or malformed login fields', async () => {
  const response = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });

  expect(response.status).toBe(400);
  expect(response.body.details).toHaveProperty('email');
  expect(response.body.details).toHaveProperty('password');
});

test('fails safely when JWT configuration is missing', async () => {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  try {
    await request(app).post('/api/auth/register').send(validRegistration).expect(201);
    const response = await request(app).post('/api/auth/login').send({
      email: validRegistration.email,
      password: validRegistration.password
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Authentication is unavailable.' });
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});
