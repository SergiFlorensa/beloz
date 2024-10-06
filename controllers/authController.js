const bcrypt = require('bcrypt');
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
