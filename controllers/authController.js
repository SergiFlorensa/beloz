const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../models/dbpostgre'); // Asegúrate de que esta ruta apunta a donde configuraste tu pool de PostgreSQL

const registerUser = async (req, res) => {
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

module.exports = { registerUser };



const loginUser = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    // Verificar si el usuario existe
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];

    // Comparar la contraseña ingresada con el hash almacenado en la base de datos
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Contraseña incorrecta' });
    }

    // Crear token de sesión con JWT
    const token = jwt.sign({ id_user: user.id_user, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '1h', // Token expira en 1 hora
    });

    // Retornar los datos del usuario y el token
    res.status(200).json({
      id_user: user.id_user,
      name: user.name,
      surname: user.surname,
      email: user.email,
      token, // Devolvemos el token al cliente
    });
  } catch (err) {
    console.error('Error durante el inicio de sesión:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { loginUser };