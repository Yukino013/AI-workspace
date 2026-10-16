import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import sharp from 'sharp';

const database = `ai-workbench-avatar-test-${randomUUID()}`;
const uploads = await mkdtemp(join(tmpdir(), 'ai-workbench-avatar-test-'));
process.env.JWT_SECRET = randomUUID() + randomUUID();
process.env.JWT_EXPIRES_IN = '1h';
process.env.UPLOAD_DIR = uploads;
const { default: app } = await import('../dist/app.js');
const { User } = await import('../dist/models/user.model.js');
let server;
let base;
let token;
let userId;

before(async () => {
  await mongoose.connect(process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017', { dbName: database, serverSelectionTimeoutMS: 3000 });
  await User.init();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}`;
  const credentials = { username: 'avatar_user', password: 'avatar-test-password-123' };
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) };
  assert.equal((await fetch(`${base}/api/auth/register`, options)).status, 201);
  const response = await fetch(`${base}/api/auth/login`, options);
  const { data } = await response.json();
  token = data.token;
  userId = data.user.id;
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

function image(format = 'png', width = 40, height = 20) {
  return sharp({ create: { width, height, channels: 3, background: '#e24c35' } }).toFormat(format).toBuffer();
}
async function upload(bytes, { mime = 'image/png', name = 'avatar.png', authenticated = true, customize } = {}) {
  const body = new FormData();
  if (bytes !== undefined) body.append('avatar', new Blob([bytes], { type: mime }), name);
  customize?.(body);
  const res = await fetch(`${base}/api/auth/avatar`, {
    method: 'POST', headers: authenticated ? { Authorization: `Bearer ${token}` } : {}, body,
  });
  return { status: res.status, body: await res.json() };
}
async function state() {
  return { files: (await readdir(uploads)).sort(), avatar: (await User.findById(userId)).avatar };
}
async function rejected(bytes, options = {}, status = 400) {
  const previous = await state();
  const result = await upload(bytes, options);
  assert.equal(result.status, status, JSON.stringify(result));
  assert.equal(result.body.code, status === 401 ? 40101 : 40001);
  assert.equal(result.body.data, null);
  assert.deepEqual(await state(), previous, 'failed upload must not write files or change the user');
  return result;
}
async function output(result) {
  assert.equal(result.status, 200, JSON.stringify(result));
  const avatar = result.body.data.avatar;
  assert.match(avatar, /^\/uploads\/[0-9a-f-]{36}\.webp$/);
  assert.equal((await User.findById(userId)).avatar, avatar);
  const bytes = await readFile(join(uploads, avatar.split('/').pop()));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.ok(metadata.width <= 512 && metadata.height <= 512);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
  assert.equal(metadata.icc, undefined);
  return { avatar, bytes, metadata };
}

test('JPEG, PNG, WebP and GIF become generated WebP files served with image headers', async () => {
  for (const format of ['jpeg', 'png', 'webp', 'gif']) {
    const result = await upload(await image(format), { mime: `image/${format}`, name: `avatar.${format}` });
    const { avatar, bytes, metadata } = await output(result);
    assert.equal(metadata.width, 40);
    assert.equal(metadata.height, 20);
    const response = await fetch(`${base}${avatar}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  }
});

test('actual image content controls processing; extension/MIME cannot control saved format', async () => {
  const marker = '<script>avatar-tail-marker</script>';
  const bytes = Buffer.concat([await image('png'), Buffer.from(marker)]);
  const { bytes: saved } = await output(await upload(bytes, { mime: 'image/jpeg', name: '../../avatar.html' }));
  assert.equal(saved.includes(Buffer.from(marker)), false);
});

test('spoofed text/SVG/TIFF, forged headers and truncated image data are rejected', async () => {
  const png = await image('png');
  const jpeg = await image('jpeg');
  // Keep the PNG header and metadata but cut the actual compressed image data.
  const truncatedPng = png.subarray(0, png.indexOf(Buffer.from('IDAT')) + 8);
  assert.equal((await sharp(truncatedPng).metadata()).format, 'png');
  const invalid = [
    Buffer.alloc(0), Buffer.from('not an image'),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>'),
    await image('tiff'), Buffer.from('GIF89a-this-is-not-a-gif'),
    Buffer.concat([png.subarray(0, 8), Buffer.from('fake png')]),
    truncatedPng, jpeg.subarray(0, Math.floor(jpeg.length * 0.8)),
  ];
  for (const bytes of invalid) await rejected(bytes);
});

test('byte, dimension and pixel limits reject inputs without public files', async () => {
  const oversized = Buffer.concat([await image(), Buffer.alloc(2 * 1024 * 1024)]);
  const sizeError = await rejected(oversized);
  assert.match(sizeError.body.message, /2MB/);
  await rejected(await image('png', 8193, 1));
  await rejected(await image('png', 1, 8193));
  await rejected(await image('png', 4001, 4000));
  await output(await upload(await image('png', 8192, 1)));
  await output(await upload(await image('png', 4000, 4000)));
});

test('resizing preserves aspect ratio, applies EXIF orientation and removes private metadata', async () => {
  const source = await sharp({ create: { width: 1000, height: 500, channels: 3, background: 'blue' } })
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Artist: 'private-avatar-owner' } })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">private-location-marker</x:xmpmeta>')
    .jpeg().toBuffer();
  const sourceMetadata = await sharp(source).metadata();
  assert.ok(sourceMetadata.exif && sourceMetadata.icc && sourceMetadata.xmp);
  const { bytes, metadata } = await output(await upload(source, { mime: 'image/jpeg' }));
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.orientation, undefined);
  assert.equal(bytes.includes(Buffer.from('private-avatar-owner')), false);
  assert.equal(bytes.includes(Buffer.from('private-location-marker')), false);
});

test('animated GIF is decoded to a single static first-frame avatar', async () => {
  const red = Buffer.from([255, 0, 0]);
  const green = Buffer.from([0, 255, 0]);
  const raw = Buffer.concat([Buffer.concat(Array(16 * 16).fill(red)), Buffer.concat(Array(16 * 16).fill(green))]);
  const animated = await sharp(raw, { raw: { width: 16, height: 32, channels: 3, pageHeight: 16 } })
    .gif({ delay: [100, 100], loop: 0 }).toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  const { bytes, metadata } = await output(await upload(animated, { mime: 'image/gif' }));
  assert.equal(metadata.pages ?? 1, 1);
  assert.equal(metadata.height, 16);
  const pixel = await sharp(bytes).removeAlpha().raw().toBuffer();
  assert.ok(pixel[0] > 200 && pixel[1] < 30, 'first frame is red');
});

test('authentication, required field, declared MIME and single-file constraints are enforced', async () => {
  const bytes = await image();
  await rejected(bytes, { authenticated: false }, 401);
  await rejected(undefined);
  await rejected(bytes, { mime: 'text/html' });
  await rejected(bytes, { customize: (form) => form.append('avatar', new Blob([bytes], { type: 'image/png' }), 'other.png') });
  await rejected(undefined, { customize: (form) => form.append('other', new Blob([bytes], { type: 'image/png' }), 'other.png') });
  await rejected(bytes, { customize: (form) => form.append('extra', 'value') });
});

test('database errors or a vanished user remove the new file and preserve the previous avatar', async (t) => {
  const previous = await state();
  const spy = t.mock.method(User, 'findByIdAndUpdate', async () => { throw new Error('test database unavailable'); });
  try {
    const failed = await upload(await image());
    assert.equal(failed.status, 500);
    assert.equal(failed.body.code, 50000);
    assert.equal(failed.body.message, '服务器内部错误');
    assert.deepEqual(await state(), previous);
    spy.mock.mockImplementation(async () => null);
    const missing = await upload(await image());
    assert.equal(missing.status, 404);
    assert.deepEqual(await state(), previous);
  } finally {
    spy.mock.restore();
  }
});

test('storage failure remains a server error rather than an invalid-image error', async () => {
  const previous = await state();
  const backup = `${uploads}-backup`;
  await rename(uploads, backup);
  try {
    await writeFile(uploads, 'block directory creation');
    const failed = await upload(await image());
    assert.equal(failed.status, 500);
    assert.equal(failed.body.message, '服务器内部错误');
  } finally {
    await rm(uploads, { force: true });
    await rename(backup, uploads);
  }
  assert.deepEqual(await state(), previous);
});
