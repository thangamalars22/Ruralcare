
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(
  process.env.REPORTS_DIR ||
    path.join(__dirname, '..', '..', 'storage', 'reports')
);

const MAX_BYTES =
  Number(process.env.MAX_REPORT_MB || 10) * 1024 * 1024;

const TYPES = {
  'application/pdf': {
    ext: 'pdf',
    magic: (buf) =>
      buf.length >= 5 &&
      buf.subarray(0, 5).toString('latin1') === '%PDF-',
  },
  'image/jpeg': {
    ext: 'jpg',
    magic: (buf) =>
      buf.length >= 3 &&
      buf[0] === 0xff &&
      buf[1] === 0xd8 &&
      buf[2] === 0xff,
  },
  'image/png': {
    ext: 'png',
    magic: (buf) =>
      buf.length >= 8 &&
      buf.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      ),
  },
};

const KEY_RX = /^[a-f0-9]{32}\.(pdf|jpg|png)$/i;

async function ensureDir() {
  await fs.promises.mkdir(ROOT, {
    recursive: true,
    mode: 0o700,
  });
}

function detectType(buf) {
  if (!Buffer.isBuffer(buf)) return null;

  for (const [mime, config] of Object.entries(TYPES)) {
    if (config.magic(buf)) return mime;
  }

  return null;
}

async function save(buf, mime) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw new Error('Cannot save an empty report file.');
  }

  if (buf.length > MAX_BYTES) {
    throw new Error('Report file exceeds the maximum allowed size.');
  }

  const config = TYPES[mime];

  if (!config) {
    throw new Error('Unsupported report file type.');
  }

  if (detectType(buf) !== mime) {
    throw new Error('Report file contents do not match its type.');
  }

  await ensureDir();

  const key = `${crypto.randomBytes(16).toString('hex')}.${config.ext}`;
  await fs.promises.writeFile(path.join(ROOT, key), buf, {
    flag: 'wx',
    mode: 0o600,
  });

  return key;
}

function safePath(key) {
  if (typeof key !== 'string' || !KEY_RX.test(key)) {
    return null;
  }

  return path.join(ROOT, key);
}

function stream(key) {
  const filePath = safePath(key);
  if (!filePath) return null;

  return fs.createReadStream(filePath);
}

async function exists(key) {
  const filePath = safePath(key);
  if (!filePath) return false;

  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function remove(key) {
  const filePath = safePath(key);
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

module.exports = {
  ROOT,
  MAX_BYTES,
  TYPES,
  detectType,
  save,
  stream,
  exists,
  remove,
};

