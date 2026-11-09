const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dbPath = require.resolve('../models/dbpostgre');
const original = require('../models/dbpostgre');
let rows = [];
const schema = ['id_user', 'password'].map(column_name => ({ column_name }));
require.cache[dbPath].exports = { query: async (sql, values) => {
  assert.ok(Array.isArray(values) || sql.includes('information_schema'));
  return { rows: sql.includes('information_schema') ? schema : rows };
} };
const auth = require('../controllers/authController');
const { getJwtSecret } = require('../security/config');
require.cache[dbPath].exports = original;

async function login(password) {
  const result = { status: 200, data: null };
  await auth.loginUser({ body: { email: 'test@example.invalid', password } }, {
    status(value) { result.status = value; return this; }, json(data) { result.data = data; }
  });
  return result;
}

test('login returns a verified token and never returns the password hash', async () => {
  rows = [{ id_user: 7, name: 'Prueba', surname: 'Local', email: 'test@example.invalid',
    num_telefono: '600000000', password: await bcrypt.hash('Test-Password-42', 10) }];
  const response = await login('Test-Password-42');
  assert.equal(response.status, 200);
  assert.equal(response.data.name, 'Prueba');
  assert.equal(response.data.password, undefined);
  assert.equal(response.data.password_hash, undefined);
  const payload = jwt.verify(response.data.token, getJwtSecret(), { audience: 'beloz-app', issuer: 'beloz-api' });
  assert.equal(payload.id_user, 7);
  assert.equal(payload.exp - payload.iat, 3600);
});

test('unknown user and wrong password produce the same response', async () => {
  rows = [{ id_user: 7, password: await bcrypt.hash('Test-Password-42', 10) }];
  const wrong = await login('different-password');
  rows = [];
  const unknown = await login('different-password');
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong, unknown);
});
