const { randomBytes } = require('node:crypto');

function resolveJwtSecret(env = process.env, warn = console.warn) {
  const secret = env.JWT_SECRET || '';
  const strong = Buffer.byteLength(secret) >= 32 && new Set(secret).size >= 12 &&
    !/default|change.?me|example|your.?secret/i.test(secret);
  if (strong) return secret;
  if (env.NODE_ENV && env.NODE_ENV !== 'development') {
    throw new Error('JWT_SECRET must be a randomly generated secret of at least 32 bytes.');
  }
  warn('Development only: using an ephemeral JWT key; sessions expire on restart.');
  return randomBytes(48).toString('base64url');
}

let jwtSecret;
function getJwtSecret() {
  if (!jwtSecret) jwtSecret = resolveJwtSecret();
  return jwtSecret;
}

module.exports = { getJwtSecret, resolveJwtSecret };
