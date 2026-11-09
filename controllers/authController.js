const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../models/dbpostgre');
const { getJwtSecret } = require('../security/config');
const { transaction } = require('../security/transaction');
const {
  HttpError, ownUserId, bodyObject, textField, emailField, passwordField, phoneField, handler,
} = require('../security/input');

// Use a real bcrypt comparison for unknown accounts as well.
const dummyHash = bcrypt.hashSync('not-an-account-password', 10);

exports.registerUser = handler(async (req, res) => {
  const body = bodyObject(req.body);
  const name = textField(body.name);
  const surname = textField(body.surname);
  const email = emailField(body.email);
  const phone = phoneField(body.num_telefono);
  const password = passwordField(body.password ?? body.password_hash);
  const schema = await getUsersSchema(pool);
  const existing = await pool.query(
    'SELECT 1 FROM users WHERE LOWER(email) = $1 OR num_telefono = $2 LIMIT 1', [email, phone]
  );
  if (existing.rows.length) throw new HttpError(409, 'Los datos ya estan registrados.');
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (name, surname, email, ${schema.passwordColumn}, num_telefono)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, surname, email, hashedPassword, phone]
  );
  res.status(201).json(toUserResponse(result.rows[0], schema));
});

exports.loginUser = handler(async (req, res) => {
  const body = bodyObject(req.body);
  const email = emailField(body.email);
  const password = passwordField(body.password, 1);
  const schema = await getUsersSchema(pool);
  const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 2', [email]);
  const user = result.rows.length === 1 ? result.rows[0] : undefined;
  const matches = await bcrypt.compare(password, user?.[schema.passwordColumn] || dummyHash);
  if (!user || !matches) throw new HttpError(401, 'Correo o contrasena incorrectos.');
  res.status(200).json({ ...toUserResponse(user, schema), token: signToken(user, schema) });
});

exports.updateEmail = handler(async (req, res) => {
  const body = bodyObject(req.body);
  const userId = ownUserId(req);
  const email = emailField(body.new_email);
  const schema = await getUsersSchema(pool);
  const existing = await pool.query(
    `SELECT 1 FROM users WHERE LOWER(email) = $1 AND ${schema.idColumn} <> $2 LIMIT 1`, [email, userId]
  );
  if (existing.rows.length) throw new HttpError(409, 'El correo ya esta en uso.');
  const result = await pool.query(
    `UPDATE users SET email = $1 WHERE ${schema.idColumn} = $2 RETURNING *`, [email, userId]
  );
  const user = requireUser(result);
  res.status(200).json({ ...toUserResponse(user, schema), token: signToken(user, schema) });
});

exports.updatePassword = handler(async (req, res) => {
  const body = bodyObject(req.body);
  const userId = ownUserId(req);
  const currentPassword = passwordField(body.current_password, 1);
  const newPassword = passwordField(body.new_password);
  const schema = await getUsersSchema(pool);
  const result = await pool.query(`SELECT * FROM users WHERE ${schema.idColumn} = $1`, [userId]);
  const user = requireUser(result);
  if (!await bcrypt.compare(currentPassword, user[schema.passwordColumn])) {
    throw new HttpError(400, 'La contrasena actual es incorrecta.');
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query(
    `UPDATE users SET ${schema.passwordColumn} = $1 WHERE ${schema.idColumn} = $2`, [hashed, userId]
  );
  res.status(200).json({ message: 'Contrasena actualizada exitosamente' });
});

exports.updatePhoneNumber = handler(async (req, res) => {
  const body = bodyObject(req.body);
  const userId = ownUserId(req);
  const phone = phoneField(body.num_telefono);
  const schema = await getUsersSchema(pool);
  const existing = await pool.query(
    `SELECT 1 FROM users WHERE num_telefono = $1 AND ${schema.idColumn} <> $2 LIMIT 1`, [phone, userId]
  );
  if (existing.rows.length) throw new HttpError(409, 'El telefono ya esta registrado.');
  const result = await pool.query(
    `UPDATE users SET num_telefono = $1 WHERE ${schema.idColumn} = $2 RETURNING *`, [phone, userId]
  );
  res.status(200).json(toUserResponse(requireUser(result), schema));
});

exports.deleteUser = handler(async (req, res) => {
  const userId = ownUserId(req);
  await transaction(pool, async (client) => {
    const schema = await getUsersSchema(client);
    requireUser(await client.query(`SELECT ${schema.idColumn} FROM users WHERE ${schema.idColumn} = $1 FOR UPDATE`, [userId]));
    await client.query('DELETE FROM datos_bancarios WHERE user_id = $1', [userId]);
    await client.query(
      'DELETE FROM detalle_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE user_id = $1)', [userId]
    );
    await client.query('DELETE FROM pedidos WHERE user_id = $1', [userId]);
    await client.query(`DELETE FROM users WHERE ${schema.idColumn} = $1`, [userId]);
  });
  res.status(200).json({ message: 'Cuenta eliminada exitosamente' });
});

exports.logoutUser = (req, res) => {
  res.status(200).json({ message: 'Logout exitoso' });
};

async function getUsersSchema(client) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
     AND column_name IN ('id', 'id_user', 'password', 'password_hash')`
  );
  const columns = new Set(result.rows.map((row) => row.column_name));
  const idColumn = columns.has('id_user') ? 'id_user' : columns.has('id') ? 'id' : null;
  const passwordColumn = columns.has('password') ? 'password' : columns.has('password_hash') ? 'password_hash' : null;
  if (!idColumn || !passwordColumn) throw new Error('Unsupported users schema');
  return { idColumn, passwordColumn };
}

function requireUser(result) {
  if (!result.rows[0]) throw new HttpError(401, 'La cuenta ya no esta disponible.');
  return result.rows[0];
}

function signToken(user, schema) {
  const userId = user[schema.idColumn];
  return jwt.sign({ id_user: userId, user_id: userId, id: userId }, getJwtSecret(), {
    algorithm: 'HS256', expiresIn: '1h', issuer: 'beloz-api', audience: 'beloz-app',
  });
}

function toUserResponse(user, schema) {
  const userId = user[schema.idColumn];
  return {
    id: userId, id_user: userId, user_id: userId,
    name: user.name, surname: user.surname, email: user.email, num_telefono: user.num_telefono,
  };
}
