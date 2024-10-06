const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../models/dbpostgre');

// Registro de usuario
exports.registerUser = async (req, res) => {
  const { name, surname, email, password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, surname, email, password) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, surname, email, hashedPassword]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Inicio de sesión
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user.id_user }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      id_user: user.id_user,
      token,
      name: user.name,
      surname: user.surname,
      email: user.email
    });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Actualizar correo electrónico
exports.updateUserEmail = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const { newEmail } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [newEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const result = await pool.query(
      'UPDATE users SET email = $1 WHERE id_user = $2 RETURNING *',
      [newEmail, userId]
    );

    res.status(200).json({ message: 'Email updated successfully', email: newEmail });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Obtener perfil del usuario
exports.getProfile = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const userResult = await pool.query('SELECT id_user, name, surname, email FROM users WHERE id_user = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(userResult.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};
