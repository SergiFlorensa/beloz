const jwt = require('jsonwebtoken');
const pool = require('../models/dbpostgre');

// Actualizar correo electrónico
exports.updateUserEmail = async (req, res) => {
  const { newEmail } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  if (!newEmail) {
    return res.status(400).json({ error: 'Nuevo correo electrónico requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('UPDATE users SET email = $1 WHERE id_user = $2 RETURNING *', [newEmail, decoded.id]);

    if (result.rows.length > 0) {
      res.status(200).json({ message: 'Correo electrónico actualizado', email: newEmail });
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  } catch (err) {
    console.error('Error al actualizar correo electrónico:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener perfil
exports.getProfile = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT id_user, name, surname, email FROM users WHERE id_user = $1', [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error en obtener perfil:', err.message);
    res.status(401).json({ error: 'Token inválido' });
  }
};
