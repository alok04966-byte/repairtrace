const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const Device = require('../src/models/Device');
const RepairCounter = require('../src/models/RepairCounter');
const RepairOrder = require('../src/models/RepairOrder');
const User = require('../src/models/User');

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-only-jwt-secret';
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Device.deleteMany({}), RepairOrder.deleteMany({}), RepairCounter.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

async function createUser(role, email) {
  return User.create({
    name: role === 'staff' ? 'Staff Member' : 'Customer Member',
    email,
    phone: role === 'staff' ? '+919876543211' : '+919876543210',
    passwordHash: await bcrypt.hash('Strong-password-123', 12),
    role
  });
}

function authCookie(user) {
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return `auth_token=${token}`;
}

function repairPayload(customerId, overrides = {}) {
  return {
    customerId: customerId.toString(),
    device: { type: 'laptop', brand: 'Lenovo', model: 'ThinkPad T14', manufacturerSerialNumber: 'SERIAL-001' },
    reportedIssue: 'Device does not power on.',
    intakeCondition: 'Minor scratches on lid.',
    intakeNotes: 'Customer supplied charger.',
    accessories: ['charger'],
    ...overrides
  };
}

test('staff creates a received repair with a server-generated number', async () => {
  const staff = await createUser('staff', 'staff@example.com');
  const customer = await createUser('customer', 'customer@example.com');

  const response = await request(app).post('/api/repairs').set('Cookie', authCookie(staff)).send(repairPayload(customer._id));

  expect(response.status).toBe(201);
  expect(response.body.repair).toMatchObject({
    repairNumber: 1, repairReference: 'RT-000001', customerId: customer._id.toString(), status: 'received',
    device: { type: 'laptop', brand: 'Lenovo', model: 'ThinkPad T14' }
  });
  const storedRepair = await RepairOrder.findById(response.body.repair.id);
  expect(storedRepair.createdBy.toString()).toBe(staff._id.toString());
});

test('repair numbers are sequential and unique during concurrent creation', async () => {
  const staff = await createUser('staff', 'staff@example.com');
  const customer = await createUser('customer', 'customer@example.com');
  const responses = await Promise.all(Array.from({ length: 5 }, (_, index) => request(app)
    .post('/api/repairs')
    .set('Cookie', authCookie(staff))
    .send(repairPayload(customer._id, { device: { type: 'phone', brand: 'Google', model: `Pixel ${index}`, manufacturerSerialNumber: `SERIAL-${index}` } }))));

  expect(responses.every((response) => response.status === 201)).toBe(true);
  expect(responses.map((response) => response.body.repair.repairNumber).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
});

test('rejects invalid intake input and invalid customer references', async () => {
  const staff = await createUser('staff', 'staff@example.com');
  const malformed = await request(app).post('/api/repairs').set('Cookie', authCookie(staff)).send({
    ...repairPayload(new mongoose.Types.ObjectId()), accessories: 'charger', status: 'in_repair', createdBy: staff._id.toString()
  });
  const unknownCustomer = await request(app).post('/api/repairs').set('Cookie', authCookie(staff)).send(repairPayload(new mongoose.Types.ObjectId()));

  expect(malformed.status).toBe(400);
  expect(malformed.body.details).toHaveProperty('accessories');
  expect(malformed.body.details).toHaveProperty('status');
  expect(malformed.body.details).toHaveProperty('createdBy');
  expect(unknownCustomer.status).toBe(404);
  expect(unknownCustomer.body).toEqual({ error: 'Customer not found.' });
});

test('rejects unauthenticated and customer repair creation', async () => {
  const customer = await createUser('customer', 'customer@example.com');
  const unauthenticated = await request(app).post('/api/repairs').send(repairPayload(customer._id));
  const customerAttempt = await request(app).post('/api/repairs').set('Cookie', authCookie(customer)).send(repairPayload(customer._id));

  expect(unauthenticated.status).toBe(401);
  expect(customerAttempt.status).toBe(403);
});

test('scopes repair lists and detail views to the authenticated customer', async () => {
  const staff = await createUser('staff', 'staff@example.com');
  const customerOne = await createUser('customer', 'one@example.com');
  const customerTwo = await createUser('customer', 'two@example.com');
  const first = await request(app).post('/api/repairs').set('Cookie', authCookie(staff)).send(repairPayload(customerOne._id)).expect(201);
  const second = await request(app).post('/api/repairs').set('Cookie', authCookie(staff)).send(repairPayload(customerTwo._id, { device: { type: 'phone', brand: 'Apple', model: 'iPhone 15' } })).expect(201);

  const staffList = await request(app).get('/api/repairs').set('Cookie', authCookie(staff));
  const customerList = await request(app).get('/api/repairs').set('Cookie', authCookie(customerOne));
  const ownDetail = await request(app).get(`/api/repairs/${first.body.repair.id}`).set('Cookie', authCookie(customerOne));
  const otherDetail = await request(app).get(`/api/repairs/${second.body.repair.id}`).set('Cookie', authCookie(customerOne));

  expect(staffList.body.repairs).toHaveLength(2);
  expect(customerList.body.repairs).toHaveLength(1);
  expect(customerList.body.repairs[0].customerId).toBe(customerOne._id.toString());
  expect(ownDetail.status).toBe(200);
  expect(otherDetail.status).toBe(404);
});

test('handles invalid and nonexistent repair records safely', async () => {
  const customer = await createUser('customer', 'customer@example.com');
  const invalid = await request(app).get('/api/repairs/not-an-id').set('Cookie', authCookie(customer));
  const missing = await request(app).get(`/api/repairs/${new mongoose.Types.ObjectId()}`).set('Cookie', authCookie(customer));

  expect(invalid.status).toBe(400);
  expect(missing.status).toBe(404);
});
