import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardForRole, hasSafeRepairOrigin, safeDestination } from '../src/routing.js';

test('dashboard destination follows the backend role and rejects unsupported roles', () => {
  assert.equal(dashboardForRole({ role: 'customer' }), '/customer');
  assert.equal(dashboardForRole({ role: 'staff' }), '/staff');
  assert.equal(dashboardForRole({ role: 'admin' }), null);
});

test('return destination accepts role home and internal repair routes', () => {
  const customer = { role: 'customer' };
  assert.equal(safeDestination('/customer', customer), '/customer');
  assert.equal(safeDestination('/repairs/6adf5c9b07459ab84333d714?tab=quotes', customer), '/repairs/6adf5c9b07459ab84333d714?tab=quotes');
  assert.equal(safeDestination({ pathname: '/repairs/6adf5c9b07459ab84333d714', search: '?tab=quotes' }, customer), '/repairs/6adf5c9b07459ab84333d714?tab=quotes');
});

test('return destination rejects external, unsupported, and other-role routes', () => {
  assert.equal(safeDestination('//example.com', { role: 'customer' }), '/customer');
  assert.equal(safeDestination('/staff', { role: 'customer' }), '/customer');
  assert.equal(safeDestination('/not-a-route', { role: 'staff' }), '/staff');
  assert.equal(safeDestination('/repairs/not-an-id', { role: 'staff' }), '/staff');
  assert.equal(safeDestination('/staff', { role: 'superuser' }), null);
});

test('repair back navigation trusts only the current role dashboard as its in-app origin', () => {
  assert.equal(hasSafeRepairOrigin('/customer', { role: 'customer' }), true);
  assert.equal(hasSafeRepairOrigin('/customer?filter=open', { role: 'customer' }), true);
  assert.equal(hasSafeRepairOrigin('/staff', { role: 'staff' }), true);
  assert.equal(hasSafeRepairOrigin('/staff', { role: 'customer' }), false);
  assert.equal(hasSafeRepairOrigin('https://example.com', { role: 'customer' }), false);
  assert.equal(hasSafeRepairOrigin(undefined, { role: 'customer' }), false);
});
