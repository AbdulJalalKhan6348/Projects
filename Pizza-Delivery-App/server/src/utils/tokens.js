import crypto from 'node:crypto';

export function createOpaqueToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
