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

afterEach(async () => Promise.all([User.deleteMany({}), Device.deleteMany({}), RepairOrder.deleteMany({}), RepairCounter.deleteMany({})]));
afterAll(async () => { await mongoose.disconnect(); await mongoServer.stop(); });

async function user(role, email) {
  return User.create({ name: `${role} user`, email, phone: role === 'staff' ? '+919876543211' : '+919876543210', passwordHash: await bcrypt.hash('Strong-password-123', 10), role });
}
function cookie(account) { return `auth_token=${jwt.sign({ sub: account._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' })}`; }
async function createRepair(staff, customer) {
  return request(app).post('/api/repairs').set('Cookie', cookie(staff)).send({
    customerId: customer._id.toString(), device: { type: 'phone', brand: 'Google', model: 'Pixel' },
    reportedIssue: 'Screen remains completely black.', intakeCondition: 'Small mark on rear case.'
  }).expect(201);
}
const quote = { items: [{ description: 'Replacement screen', quantity: 1, unitPrice: '1250.50' }, { description: 'Labour', quantity: 2, unitPrice: 100 }] };

test('staff records diagnosis, creates server-calculated versioned quotes, and customer decides only the current version', async () => {
  const staff = await user('staff', 'staff@example.com');
  const customer = await user('customer', 'customer@example.com');
  const other = await user('customer', 'other@example.com');
  const repair = await createRepair(staff, customer);
  const id = repair.body.repair.id;

  await request(app).post(`/api/repairs/${id}/quotes`).set('Cookie', cookie(staff)).send(quote).expect(409);
  await request(app).patch(`/api/repairs/${id}/diagnosis`).set('Cookie', cookie(customer)).send({ diagnosis: 'Failed display.' }).expect(403);
  await request(app).patch(`/api/repairs/${id}/diagnosis`).set('Cookie', cookie(staff)).send({ diagnosis: 'Failed display.', diagnosisNotes: 'Internal bench test.' }).expect(200);
  const first = await request(app).post(`/api/repairs/${id}/quotes`).set('Cookie', cookie(staff)).send(quote).expect(201);
  expect(first.body.quote).toMatchObject({ version: 1, total: 1450.5, status: 'pending' });
  await request(app).post(`/api/repairs/${id}/quotes/1/decision`).set('Cookie', cookie(other)).send({ decision: 'approved' }).expect(404);
  await request(app).post(`/api/repairs/${id}/quotes/1/decision`).set('Cookie', cookie(staff)).send({ decision: 'approved' }).expect(403);
  await request(app).post(`/api/repairs/${id}/quotes/1/decision`).set('Cookie', cookie(customer)).send({ decision: 'approved' }).expect(200);
  const second = await request(app).post(`/api/repairs/${id}/quotes`).set('Cookie', cookie(staff)).send(quote).expect(201);
  expect(second.body.quote.version).toBe(2);
  await request(app).post(`/api/repairs/${id}/quotes/1/decision`).set('Cookie', cookie(customer)).send({ decision: 'approved' }).expect(409);
  await request(app).post(`/api/repairs/${id}/quotes/2/decision`).set('Cookie', cookie(customer)).send({ decision: 'declined' }).expect(200);
  await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'in_progress', resolutionNote: 'No blocker.' }).expect(409);
});

test('owner can list, view, read quotes, and decide their repair while another customer receives 404', async () => {
  const staff = await user('staff', 'staff@example.com');
  const owner = await user('customer', 'owner@example.com');
  const other = await user('customer', 'other@example.com');
  const repair = await createRepair(staff, owner);
  const id = repair.body.repair.id;
  await request(app).patch(`/api/repairs/${id}/diagnosis`).set('Cookie', cookie(staff)).send({ diagnosis: 'Charging circuit fault.' }).expect(200);
  await request(app).post(`/api/repairs/${id}/quotes`).set('Cookie', cookie(staff)).send(quote).expect(201);

  const list = await request(app).get('/api/repairs').set('Cookie', cookie(owner)).expect(200);
  expect(list.body.repairs.map((entry) => entry.id)).toEqual([id]);
  await request(app).get(`/api/repairs/${id}`).set('Cookie', cookie(owner)).expect(200);
  const quotes = await request(app).get(`/api/repairs/${id}/quotes`).set('Cookie', cookie(owner)).expect(200);
  expect(quotes.body.quotes).toHaveLength(1);
  await request(app).get(`/api/repairs/${id}`).set('Cookie', cookie(other)).expect(404);
  await request(app).get(`/api/repairs/${id}/quotes`).set('Cookie', cookie(other)).expect(404);
  await request(app).post(`/api/repairs/${id}/quotes/1/decision`).set('Cookie', cookie(other)).send({ decision: 'approved' }).expect(404);
  await request(app).post(`/api/repairs/${id}/quotes/1/decision`).set('Cookie', cookie(owner)).send({ decision: 'approved' }).expect(200);
});

test('validates quote items and enforces parts blocker lifecycle with audit history', async () => {
  const staff = await user('staff', 'staff@example.com');
  const customer = await user('customer', 'customer@example.com');
  const repair = await createRepair(staff, customer);
  const id = repair.body.repair.id;
  await request(app).patch(`/api/repairs/${id}/diagnosis`).set('Cookie', cookie(staff)).send({ diagnosis: 'Battery failure.' }).expect(200);
  await request(app).post(`/api/repairs/${id}/quotes`).set('Cookie', cookie(staff)).send({ items: [{ description: '', quantity: 0, unitPrice: '-1' }] }).expect(400);
  await request(app).post(`/api/repairs/${id}/quotes`).set('Cookie', cookie(staff)).send(quote).expect(201);
  await request(app).post(`/api/repairs/${id}/quotes/1/decision`).set('Cookie', cookie(customer)).send({ decision: 'approved' }).expect(200);
  await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'awaiting_parts' }).expect(400);
  await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'awaiting_parts', reason: 'Awaiting supplier stock.' }).expect(200);
  await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'in_progress', resolutionNote: 'Part received and checked.' }).expect(200);
  const history = await request(app).get(`/api/repairs/${id}`).set('Cookie', cookie(staff)).expect(200);
  expect(history.body.repair.history.map((event) => event.type)).toEqual(expect.arrayContaining(['quotation_approved', 'parts_blocker_added', 'parts_blocker_cleared']));
});

test('concurrent staff quote requests allocate distinct versions without losing either quote', async () => {
  const staff = await user('staff', 'staff@example.com');
  const customer = await user('customer', 'customer@example.com');
  const repair = await createRepair(staff, customer);
  const id = repair.body.repair.id;
  await request(app).patch(`/api/repairs/${id}/diagnosis`).set('Cookie', cookie(staff)).send({ diagnosis: 'Display failure.' }).expect(200);
  const responses = await Promise.all([1, 2, 3].map(() => request(app).post(`/api/repairs/${id}/quotes`).set('Cookie', cookie(staff)).send(quote)));
  expect(responses.every((response) => response.status === 201)).toBe(true);
  const versions = responses.map((response) => response.body.quote.version).sort((a, b) => a - b);
  expect(versions).toEqual([1, 2, 3]);
  const stored = await RepairOrder.findById(id);
  expect(stored.quotes.map((entry) => entry.version).sort((a, b) => a - b)).toEqual([1, 2, 3]);
});

async function approvedInProgressRepair() {
  const staff = await user('staff', 'staff@example.com');
  const customer = await user('customer', 'customer@example.com');
  const repair = await createRepair(staff, customer);
  const id = repair.body.repair.id;
  await request(app).patch(`/api/repairs/${id}/diagnosis`).set('Cookie', cookie(staff)).send({ diagnosis: 'Display failure.' }).expect(200);
  await request(app).post(`/api/repairs/${id}/quotes`).set('Cookie', cookie(staff)).send(quote).expect(201);
  await request(app).post(`/api/repairs/${id}/quotes/1/decision`).set('Cookie', cookie(customer)).send({ decision: 'approved' }).expect(200);
  return { staff, customer, id };
}

test('staff completes a fresh quality attempt and atomically records handover', async () => {
  const { staff, customer, id } = await approvedInProgressRepair();
  const start = await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'quality_check' }).expect(200);
  expect(start.body.repair.qualityAttempts[0].checks.map((check) => check.result)).toEqual(['pending', 'pending', 'pending']);
  await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'ready_for_collection' }).expect(409);
  await request(app).patch(`/api/repairs/${id}/quality-checks`).set('Cookie', cookie(customer)).send({ checks: [] }).expect(403);
  await request(app).patch(`/api/repairs/${id}/quality-checks`).set('Cookie', cookie(staff)).send({ checks: [
    { id: 'reported_issue_resolved', result: 'pass' }, { id: 'basic_functionality_tested', result: 'pass' }, { id: 'device_condition_verified', result: 'pass' }
  ] }).expect(200);
  await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'ready_for_collection' }).expect(200);
  await request(app).post(`/api/repairs/${id}/handover`).set('Cookie', cookie(staff)).send({ recipientName: 'Customer Member', notes: 'Collected in person.' }).expect(200);
  const returned = await RepairOrder.findById(id);
  expect(returned.status).toBe('returned');
  expect(returned.handover.recipientName).toBe('Customer Member');
  expect(returned.history.map((event) => event.type)).toEqual(expect.arrayContaining(['quality_check_started', 'quality_check_passed', 'handover_recorded']));
  await request(app).post(`/api/repairs/${id}/handover`).set('Cookie', cookie(staff)).send({ recipientName: 'Again' }).expect(409);
});

test('failed checks require a note and a new quality attempt after rework', async () => {
  const { staff, id } = await approvedInProgressRepair();
  await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'quality_check' }).expect(200);
  await request(app).patch(`/api/repairs/${id}/quality-checks`).set('Cookie', cookie(staff)).send({ checks: [{ id: 'reported_issue_resolved', result: 'fail' }] }).expect(400);
  await request(app).patch(`/api/repairs/${id}/quality-checks`).set('Cookie', cookie(staff)).send({ checks: [{ id: 'reported_issue_resolved', result: 'fail', notes: 'Display flickers.' }] }).expect(200);
  await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'in_progress' }).expect(400);
  await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'in_progress', resolutionNote: 'Re-seat display connector.' }).expect(200);
  const restarted = await request(app).patch(`/api/repairs/${id}/status`).set('Cookie', cookie(staff)).send({ status: 'quality_check' }).expect(200);
  expect(restarted.body.repair.qualityAttempts).toHaveLength(2);
  expect(restarted.body.repair.qualityAttempts[1].checks.every((check) => check.result === 'pending')).toBe(true);
});
