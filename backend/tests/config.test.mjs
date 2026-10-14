import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveJwtSecret } from '../dist/config/jwt-secret.js';

const randomSecret = () => randomBytes(32).toString('hex');

test('production rejects missing, empty and whitespace-only secrets', () => {
  for (const secret of [undefined, '', ' ', '\n\t']) {
    assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret }), /必须设置 JWT_SECRET/);
  }
});

test('production rejects known placeholders, short secrets, whitespace and single-character repetition', () => {
  for (const secret of [
    'dev-secret-do-not-use-in-prod',
    'replace-with-a-long-random-secret',
    'REPLACE-WITH-A-LONG-RANDOM-SECRET',
    'your-secret-key', 'your-jwt-secret', 'change-me', 'changeme', 'xxx',
    randomBytes(15).toString('hex'),
    `${randomSecret()} `, ` ${randomSecret()}`, `${randomSecret()}\n`,
    `${randomSecret()} ${randomSecret()}`, 'a'.repeat(64),
  ]) {
    assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret }), (err) => {
      assert.match(err.message, /生产配置错误.*JWT_SECRET/);
      assert.ok(!err.message.includes(secret), 'error must not expose supplied secret');
      return true;
    });
  }
});

test('production accepts generated secrets without transforming the value', () => {
  for (const secret of [randomSecret(), randomBytes(32).toString('base64')]) {
    assert.equal(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret }), secret);
  }
});

test('development and test retain existing local configuration behavior', () => {
  for (const mode of [undefined, 'development', 'test']) {
    assert.equal(resolveJwtSecret({ NODE_ENV: mode }), 'dev-secret-do-not-use-in-prod');
    assert.equal(resolveJwtSecret({ NODE_ENV: mode, JWT_SECRET: 'qa-test-secret' }), 'qa-test-secret');
  }
});

// Child processes get an explicit environment and empty dotenv source, never the developer's .env.
function run(entry, secret) {
  const env = { NODE_ENV: 'production', DOTENV_CONFIG_PATH: '/dev/null' };
  if (secret !== undefined) env.JWT_SECRET = secret;
  return spawnSync(process.execPath, entry, { env, encoding: 'utf8', timeout: 5000 });
}

test('real server entry refuses unsafe configuration before connecting or listening', () => {
  const server = fileURLToPath(new URL('../dist/server.js', import.meta.url));
  for (const secret of [undefined, 'replace-with-a-long-random-secret', 'private-short-test-key']) {
    const result = run([server], secret);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /生产配置错误.*JWT_SECRET/);
    assert.doesNotMatch(result.stdout + result.stderr, /MongoDB connected|Server running|MongooseServerSelectionError/);
    if (secret) assert.ok(!(result.stdout + result.stderr).includes(secret));
  }
});

test('real config module accepts production configuration without printing the secret', () => {
  const url = new URL('../dist/config/index.js', import.meta.url).href;
  const secret = randomSecret();
  const result = run(['--input-type=module', '-e', `const { config } = await import(${JSON.stringify(url)}); if (config.jwt.secret !== process.env.JWT_SECRET) process.exit(2); console.log('config accepted');`], secret);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /config accepted/);
  assert.ok(!(result.stdout + result.stderr).includes(secret));
});
