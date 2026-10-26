const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const User = require('../src/models/User');

let mongoServer;

beforeAll(async () => {
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
