import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { apiPath } from '../src/apiPath.js';
import { api, auth, repairs } from '../src/api.js';

test('API paths are same-origin and contain exactly one api prefix', () => {
  for (const path of ['/api/auth/me', '/api/auth/login', '/api/auth/logout', '/api/repairs', 'api/repairs/123/quotes/1/decision']) {
    assert.equal(apiPath(path).startsWith('/'), true);
    assert.equal(apiPath(path).includes('/api/api/'), false);
  }

  assert.equal(apiPath('/api/auth/me'), '/api/auth/me');
  assert.equal(apiPath('/auth/login'), '/api/auth/login');
  assert.equal(apiPath('/api'), '/api');
});

test('API path builder rejects absolute host URLs', () => {
  assert.throws(() => apiPath('https://repairtrace.onrender.com/api/auth/me'), /relative path/);
});

test('Vercel forwards API requests before applying the SPA deep-link fallback', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.rewrites[0].source, '/api/:path*');
  assert.equal(config.rewrites[0].destination, 'https://repairtrace.onrender.com/api/:path*');
  assert.equal(config.rewrites[1].destination, '/index.html');
});

test('auth and repair API calls use same-origin paths, include cookies, and preserve methods and bodies', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return { ok: true, status: 200, json: async () => ({}) };
  };

  try {
    await auth.me();
    await auth.login({ email: 'customer@example.com', password: 'secret' });
    await auth.register({ email: 'customer@example.com' });
    await auth.logout();
    await repairs.list();
    await repairs.get('repair-id');
    await repairs.create({ customerEmail: 'customer@example.com' });
    await repairs.diagnosis('repair-id', { diagnosis: 'Fault' });
    await repairs.quote('repair-id', { items: [] });
    await repairs.decision('repair-id', 1, 'approved');
    await repairs.status('repair-id', { status: 'in_progress' });
    await repairs.checks('repair-id', []);
    await repairs.handover('repair-id', { recipientName: 'Customer' });

    assert.deepEqual(calls.map(({ path }) => path), [
      '/api/auth/me', '/api/auth/login', '/api/auth/register', '/api/auth/logout',
      '/api/repairs', '/api/repairs/repair-id', '/api/repairs',
      '/api/repairs/repair-id/diagnosis', '/api/repairs/repair-id/quotes',
      '/api/repairs/repair-id/quotes/1/decision', '/api/repairs/repair-id/status',
      '/api/repairs/repair-id/quality-checks', '/api/repairs/repair-id/handover'
    ]);
    assert.ok(calls.every(({ path, options }) => path.startsWith('/') && !path.includes('onrender.com') && options.credentials === 'include'));
    assert.equal(calls[1].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[1].options.body), { email: 'customer@example.com', password: 'secret' });
    assert.equal(calls[7].options.method, 'PATCH');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('API errors retain the backend status code', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 409, json: async () => ({ error: 'Conflict.' }) });
  try {
    await assert.rejects(api('/api/repairs'), (error) => error.status === 409 && error.message === 'Conflict.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
