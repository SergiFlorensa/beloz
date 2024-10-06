// routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { registerUser } = require('../controllers/authController'); // Importa el controlador

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// routes/authRoutes.js
router.post('/register', async (req, res) => {
    const { name, surname, email, password } = req.body;
  
    try {
      // Verificar si el usuario ya existe
      const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (userResult.rows.length > 0) {
        return res.status(400).json({ error: 'Email ya registrado' });
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
      console.error('Error en el registro:', err.stack);  // Mostrar la pila completa del error
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
  
// Login de usuario
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Buscar usuario en la base de datos
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    // Verificar la contraseña
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    // Generar token JWT
    const token = jwt.sign({ id: user.id_user }, process.env.SESSION_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      id_user: user.id_user,
      token,
      name: user.name,
      surname: user.surname,
      email: user.email
    });
  } catch (err) {
    console.error('Error en el login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
