const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../models/dbpostgre');

// Registrar usuario
exports.registerUser = async (req, res) => {
  const { name, surname, email, password } = req.body;

  if (!name || !surname || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

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
    console.error('Error durante el registro:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Iniciar sesión
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Contraseña incorrecta' });
    }

    // Crear token JWT
    const token = jwt.sign({ id_user: user.id_user, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(200).json({
      id_user: user.id_user,
      name: user.name,
      surname: user.surname,
      email: user.email,
      token,
    });
  } catch (err) {
    console.error('Error durante el inicio de sesión:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Logout
exports.logoutUser = (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (token) {
    // Aquí puedes agregar lógica para invalidar el token en caso de que lo necesites
    res.status(200).json({ message: 'Logout exitoso' });
  } else {
    res.status(400).json({ error: 'No se proporcionó un token para logout' });
  }
};
