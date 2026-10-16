import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// Always use a process-owned database; never read the personal database from .env.
const database = `ai-workbench-auth-test-${randomUUID()}`;
const uploads = await mkdtemp(join(tmpdir(), 'ai-workbench-auth-test-'));
process.env.JWT_SECRET = randomUUID() + randomUUID();
process.env.JWT_EXPIRES_IN = '1h';
process.env.UPLOAD_DIR = uploads;
const { default: app } = await import('../dist/app.js');
const { User } = await import('../dist/models/user.model.js');
const { logoutAll } = await import('../dist/services/auth.service.js');
const { auth } = await import('../dist/middleware/auth.middleware.js');
let server;
let base;

before(async () => {
  await mongoose.connect(process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017', { dbName: database, serverSelectionTimeoutMS: 3000 });
  await User.init();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await rm(uploads, { recursive: true, force: true });
});
async function request(path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
}
async function account(username) {
  const credentials = { username, password: 'test-password-123' };
  assert.equal((await request('/auth/register', { body: credentials })).status, 201);
  const result = await request('/auth/login', { body: credentials });
  assert.equal(result.status, 200);
  return { credentials, ...result.body.data };
}

test('logout revokes both devices, preserves other users, and permits fresh login', async () => {
  const a = await account('version_user');
  const b = await account('other_user');
  const second = (await request('/auth/login', { body: a.credentials })).body.data.token;
  assert.equal(jwt.decode(a.token).tokenVersion, 0);
  assert.equal((await request('/auth/me', { token: a.token })).status, 200);
  assert.equal((await request('/auth/me', { token: second })).status, 200);
  assert.equal((await request('/auth/logout-all', { token: a.token, body: {} })).status, 200);
  for (const token of [a.token, second]) {
    assert.equal((await request('/auth/me', { token })).status, 401);
    assert.equal((await request('/prompts', { token })).status, 401);
  }
  assert.equal((await request('/auth/me', { token: b.token })).status, 200);
  const fresh = (await request('/auth/login', { body: a.credentials })).body.data.token;
  assert.equal(jwt.decode(fresh).tokenVersion, 1);
  assert.equal((await request('/auth/me', { token: fresh })).status, 200);
  // Simulate two old logout requests that both passed middleware before the first increment.
  await Promise.all([logoutAll(a.user.id, 0), logoutAll(a.user.id, 0)]);
  assert.equal((await request('/auth/me', { token: fresh })).status, 200);
  assert.equal((await User.findById(a.user.id)).tokenVersion, 1);
});

test('legacy user documents can log in; JWTs without a version are rejected', async () => {
  const a = await account('legacy_user');
  await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(a.user.id) }, { $unset: { tokenVersion: '' } });
  const token = (await request('/auth/login', { body: a.credentials })).body.data.token;
  assert.equal(jwt.decode(token).tokenVersion, 0);
  const oldToken = jwt.sign({ userId: a.user.id, username: 'legacy_user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  assert.equal((await request('/auth/me', { token: oldToken })).status, 401);
  assert.equal((await request('/auth/me', { token })).status, 200);
  await Promise.all([logoutAll(a.user.id, 0), logoutAll(a.user.id, 0)]);
  assert.equal((await User.findById(a.user.id)).tokenVersion, 1);
  assert.equal((await request('/auth/me', { token })).status, 401);
});

test('missing, malformed, expired, wrongly signed tokens and deleted users are denied', async () => {
  const a = await account('invalid_user');
  const payload = { userId: a.user.id, username: 'invalid_user', tokenVersion: 0 };
  const sign = (value, options = { expiresIn: '1h' }) => jwt.sign(value, process.env.JWT_SECRET, options);
  for (const token of [undefined, 'invalid', sign({ ...payload, tokenVersion: -1 }), sign({ ...payload, tokenVersion: '0' }), sign({ ...payload, userId: 'invalid' }), sign(payload, {}), sign(payload, { expiresIn: -1 }), sign(payload, { algorithm: 'HS384', expiresIn: '1h' }), jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' })]) {
    assert.equal((await request('/auth/me', { token })).status, 401);
  }
  assert.equal((await request('/auth/logout-all', { body: {} })).status, 401);
  await User.deleteOne({ _id: a.user.id });
  assert.equal((await request('/auth/me', { token: a.token })).status, 401);
});

test('database failure is forwarded, not reported as invalid credentials', async (t) => {
  const a = await account('database_user');
  const failure = new Error('simulated database unavailable');
  t.mock.method(User, 'findById', () => ({ select: async () => { throw failure; } }));
  let forwarded;
  const res = { status() { assert.fail('database errors must not become 401'); } };
  await auth({ headers: { authorization: `Bearer ${a.token}` } }, res, (err) => { forwarded = err; });
  assert.equal(forwarded, failure);
});
