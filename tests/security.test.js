const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { resolveJwtSecret, getJwtSecret } = require('../security/config');
const { databaseConfig } = require('../security/database');
const { positiveId, ownUserId, passwordField } = require('../security/input');
const { corsOptions } = require('../middleware/security');
const authenticate = require('../middleware/authenticateToken');
const { searchCatalog } = require('../controllers/catalogSearch');
const { transaction } = require('../security/transaction');

test('production rejects missing and weak keys', () => {
  for (const secret of ['', 'default_secret', 'a'.repeat(64)]) {
    assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret }));
  }
  const secret = randomBytes(48).toString('hex');
  assert.equal(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret }), secret);
});
test('ownership cannot be supplied or spoofed by clients', () => {
  assert.equal(ownUserId({ user: { id_user: 7 } }, '7'), 7);
  assert.throws(() => ownUserId({ user: { id_user: 7 } }, 8), { status: 403 });
  assert.throws(() => ownUserId({}, 7), { status: 401 });
  for (const id of [0, -1, '1 OR 1=1', {}, 2147483648]) assert.throws(() => positiveId(id));
});
test('bcrypt input uses byte limits, not only string length', () => {
  assert.throws(() => passwordField('short'));
  assert.throws(() => passwordField('😀'.repeat(20)));
  assert.equal(passwordField('valid-password'), 'valid-password');
});
test('external PostgreSQL requires verified TLS', () => {
  assert.equal(databaseConfig({ DATABASE_URL: 'postgres://user@localhost/db' }).ssl, false);
  assert.equal(databaseConfig({ DATABASE_URL: 'postgres://user@db.example/db?sslmode=require' }).ssl.rejectUnauthorized, true);
  assert.throws(() => databaseConfig({ DATABASE_URL: 'postgres://user@db.example/db?sslmode=disable' }));
  assert.throws(() => databaseConfig({ DATABASE_URL: 'postgres://user@db.example/db?sslmode=no-verify' }));
});
test('CORS accepts native requests but rejects unlisted origins', () => {
  const cors = corsOptions({ CORS_ORIGINS: 'https://beloz.example' });
  cors.origin(undefined, (err, allowed) => { assert.equal(err, null); assert.equal(allowed, true); });
  cors.origin('https://beloz.example', (err, allowed) => { assert.equal(err, null); assert.equal(allowed, true); });
  cors.origin('https://evil.example', (err) => assert.equal(err.status, 403));
  assert.throws(() => corsOptions({ CORS_ORIGINS: '*' }));
});
test('JWT rejects expiry, wrong audience, algorithm and unsigned requests', () => {
  const key = getJwtSecret();
  const sign = (options = {}) => jwt.sign({ id_user: 7 }, key, { issuer: 'beloz-api', audience: 'beloz-app', expiresIn: '1h', ...options });
  const run = (token) => {
    let status = 200;
    let passed = false;
    authenticate({ headers: token ? { authorization: `Bearer ${token}` } : {} },
      { status(value) { status = value; return this; }, json() {} }, () => { passed = true; });
    return { status, passed };
  };
  assert.equal(run(sign()).passed, true);
  for (const token of [null, sign({ expiresIn: -1 }), sign({ audience: 'other' }), sign({ algorithm: 'HS384' })]) {
    assert.equal(run(token).status, 401);
  }
});
test('transaction uses one client and rolls back on failure', async () => {
  const statements = [];
  let released = false;
  const client = { query: async (sql) => statements.push(sql), release: () => { released = true; } };
  await assert.rejects(transaction({ connect: async () => client }, async (db) => { assert.equal(db, client); throw new Error('test'); }));
  assert.deepEqual(statements, ['BEGIN', 'ROLLBACK']);
  assert.equal(released, true);
});
test('catalog search matches word prefixes, accents, and never arbitrary fallback', () => {
  const rows = [{ name: 'La Tagliatella', type_of_food: 'Pasta' }, { name: 'Café Central', type_of_food: 'Tapas' }, { name: 'Kokoro', type_of_food: 'Sushi' }];
  assert.deepEqual(searchCatalog(rows, 'tagli').map(x => x.name), ['La Tagliatella']);
  assert.deepEqual(searchCatalog(rows, 'cafe').map(x => x.name), ['Café Central']);
  assert.deepEqual(searchCatalog(rows, 'sus').map(x => x.name), ['Kokoro']);
  assert.deepEqual(searchCatalog(rows, 'C').map(x => x.name), ['Café Central']);
  assert.deepEqual(searchCatalog(rows, 'xyz'), []);
  assert.deepEqual(searchCatalog(rows, '%'), []);
});
