const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../models/dbpostgre');

// Registrar usuario
exports.registerUser = async (req, res) => {
  const { name, surname, email, password, num_telefono } = req.body;

  if (!name || !surname || !email || !password || !num_telefono) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, surname, email, password, num_telefono) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, surname, email, hashedPassword, num_telefono]
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


// Actualizar correo electrónico
exports.updateEmail = async (req, res) => {
  const { new_email } = req.body;
  const userId = req.user.id_user; // Obtenemos el ID del usuario autenticado desde el token

  if (!new_email) {
    return res.status(400).json({ error: 'El nuevo correo es obligatorio' });
  }

  try {
    // Verificar si el nuevo correo ya está registrado
    const emailResult = await pool.query('SELECT * FROM users WHERE email = $1', [new_email]);
    if (emailResult.rows.length > 0) {
      return res.status(400).json({ error: 'El correo ya está en uso' });
    }

    // Actualizar el correo en la base de datos
    await pool.query('UPDATE users SET email = $1 WHERE id_user = $2', [new_email, userId]);

    // Obtener el usuario actualizado
    const userResult = await pool.query('SELECT * FROM users WHERE id_user = $1', [userId]);
    const user = userResult.rows[0];

    // Crear un nuevo token JWT con el correo actualizado
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
    console.error('Error al actualizar el correo electrónico:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


// Actualizar contraseña
exports.updatePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const userId = req.user.id_user; // Obtenemos el ID del usuario autenticado

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    // Obtener el usuario actual
    const userResult = await pool.query('SELECT * FROM users WHERE id_user = $1', [userId]);
    const user = userResult.rows[0];

    // Verificar que la contraseña actual coincide
    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    // Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Actualizar la contraseña en la base de datos
    await pool.query('UPDATE users SET password = $1 WHERE id_user = $2', [hashedPassword, userId]);

    res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
  } catch (err) {
    console.error('Error al actualizar la contraseña:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


// authController.js
exports.updatePhoneNumber = async (req, res) => {
  const { num_telefono } = req.body;
  const userId = req.user.id_user;

  if (!num_telefono) {
    return res.status(400).json({ error: 'El número de teléfono es obligatorio' });
  }

  try {
    await pool.query('UPDATE users SET num_telefono = $1 WHERE id_user = $2', [num_telefono, userId]);
    res.status(200).json({ message: 'Número de teléfono actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar el número de teléfono:', err);
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
