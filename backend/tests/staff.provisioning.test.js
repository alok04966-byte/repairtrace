const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User');
const { provisionStaff } = require('../src/services/staffProvisioning');
const { validateStaffProvisioningConfig } = require('../src/validators/staffProvisioningValidators');

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

const createConfiguration = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/repairtrace-test',
  STAFF_PROVISION_MODE: 'create',
  STAFF_NAME: 'Staff Member',
  STAFF_EMAIL: 'staff@example.com',
  STAFF_PHONE: '+919876543210',
  STAFF_PASSWORD: 'Strong-password-123'
};

test('reports required configuration variable names without exposing values', () => {
  const { errors } = validateStaffProvisioningConfig({ MONGODB_URI: createConfiguration.MONGODB_URI });

  expect(Object.keys(errors).sort()).toEqual([
    'STAFF_EMAIL', 'STAFF_NAME', 'STAFF_PASSWORD', 'STAFF_PHONE'
  ]);
});

test('validates explicit promotion configuration with only a staff email', () => {
  const { errors, value } = validateStaffProvisioningConfig({
    MONGODB_URI: createConfiguration.MONGODB_URI,
    STAFF_PROVISION_MODE: 'promote',
    STAFF_EMAIL: 'CUSTOMER@example.com'
  });

  expect(errors).toEqual({});
  expect(value).toMatchObject({ mode: 'promote', email: 'customer@example.com' });
});

test('creates a staff account with a hash and never overwrites an existing customer', async () => {
  const { value } = validateStaffProvisioningConfig(createConfiguration);
  expect(await provisionStaff(value)).toEqual({ outcome: 'created' });

  const staff = await User.findOne({ email: createConfiguration.STAFF_EMAIL }).select('+passwordHash');
  expect(staff.role).toBe('staff');
  expect(await bcrypt.compare(createConfiguration.STAFF_PASSWORD, staff.passwordHash)).toBe(true);

  const customerHash = await bcrypt.hash('Existing-password-123', 12);
  await User.create({
    name: 'Customer Member', email: 'customer@example.com', phone: '+919876543211', passwordHash: customerHash, role: 'customer'
  });
  const customerConfig = { ...value, email: 'customer@example.com' };
  expect(await provisionStaff(customerConfig)).toEqual({ outcome: 'account-exists' });

  const customer = await User.findOne({ email: 'customer@example.com' }).select('+passwordHash');
  expect(customer.role).toBe('customer');
  expect(customer.passwordHash).toBe(customerHash);
});

test('promotes only an existing customer and is safe to repeat', async () => {
  const passwordHash = await bcrypt.hash('Existing-password-123', 12);
  await User.create({
    name: 'Customer Member', email: 'customer@example.com', phone: '+919876543210', passwordHash, role: 'customer'
  });
  const { value } = validateStaffProvisioningConfig({
    MONGODB_URI: createConfiguration.MONGODB_URI,
    STAFF_PROVISION_MODE: 'promote',
    STAFF_EMAIL: 'customer@example.com'
  });

  expect(await provisionStaff(value)).toEqual({ outcome: 'promoted' });
  const promoted = await User.findOne({ email: 'customer@example.com' }).select('+passwordHash');
  expect(promoted.role).toBe('staff');
  expect(promoted.passwordHash).toBe(passwordHash);
  expect(await provisionStaff(value)).toEqual({ outcome: 'already-staff' });
});
