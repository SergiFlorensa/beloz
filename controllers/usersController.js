// controllers/usersController.js

const pool = require('../models/dbpostgre');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Registro de usuario
exports.registerUser = async (req, res) => {
  const { name, surname, email, password } = req.body;
  try {
    // Verificar si el usuario ya existe
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar nuevo usuario
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
  console.log('Request body:', req.body); // Log del cuerpo de la solicitud
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('User found:', user); // Log del usuario encontrado

      // Verificar contraseña
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const token = jwt.sign({ id: user.id_user }, process.env.JWT_SECRET || 'your_secret_key', { expiresIn: '1h' });
        res.status(200).json({
          id_user: user.id_user,
          token,
          name: user.name,
          surname: user.surname,
          email: user.email
        });
      } else {
        res.status(400).json({ error: 'Invalid credentials' });
      }
    } else {
      res.status(400).json({ error: 'Invalid credentials' });
    }
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

  // Validación de entrada
  if (!newEmail) {
    return res.status(400).json({ error: 'New email is required' });
  }

  try {
    // Verificar el token y obtener el ID del usuario
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    const userId = decoded.id;

    // Verificar si el nuevo correo ya está registrado
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [newEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Actualizar el correo en la base de datos
    const result = await pool.query(
      'UPDATE users SET email = $1 WHERE id_user = $2 RETURNING *',
      [newEmail, userId]
    );

    if (result.rows.length > 0) {
      res.status(200).json({ message: 'Email updated successfully', email: newEmail });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verificar existencia de correo electrónico
exports.checkEmail = async (req, res) => {
  const { email } = req.query;

  // Validación de entrada
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    res.status(200).json({ exists: result.rows.length > 0 }); // Devuelve true si ya existe, false si no
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
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
