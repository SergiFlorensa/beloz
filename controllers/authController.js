const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../models/dbpostgre');


exports.registerUser = async (req, res) => {
  const { name, surname, email, password, num_telefono } = req.body;

  if (!name || !surname || !email || !password || !num_telefono) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (num_telefono.length !== 9 || !/^\d+$/.test(num_telefono)) {
    return res.status(400).json({ error: 'El número de teléfono debe tener 9 dígitos' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    const phoneResult = await pool.query('SELECT * FROM users WHERE num_telefono = $1', [num_telefono]);
    if (phoneResult.rows.length > 0) {
      return res.status(400).json({ error: 'El número de teléfono ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (name, surname, email, password, num_telefono) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, surname, email, hashedPassword, num_telefono]
    );

     res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error durante el registro:', err);
    if (err.code === '23505') { 
      return res.status(400).json({ error: 'El número de teléfono ya está registrado' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


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

    const token = jwt.sign({ id_user: user.id_user, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    res.status(200).json({
      id_user: user.id_user,
      name: user.name,
      surname: user.surname,
      email: user.email,
      num_telefono: user.num_telefono,
      token,
    });
  } catch (err) {
    console.error('Error durante el inicio de sesión:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


exports.updateEmail = async (req, res) => {
  const { new_email } = req.body;
  const userId = req.user.id_user; 

  if (!new_email) {
    return res.status(400).json({ error: 'El nuevo correo es obligatorio' });
  }

  try {
    const emailResult = await pool.query('SELECT * FROM users WHERE email = $1', [new_email]);
    if (emailResult.rows.length > 0) {
      return res.status(400).json({ error: 'El correo ya está en uso' });
    }

    await pool.query('UPDATE users SET email = $1 WHERE id_user = $2', [new_email, userId]);

    const userResult = await pool.query('SELECT * FROM users WHERE id_user = $1', [userId]);
    const user = userResult.rows[0];

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


exports.updatePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const userId = req.user.id_user; 

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id_user = $1', [userId]);
    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await pool.query('UPDATE users SET password = $1 WHERE id_user = $2', [hashedPassword, userId]);

    res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
  } catch (err) {
    console.error('Error al actualizar la contraseña:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.updatePhoneNumber = async (req, res) => {
  const { num_telefono } = req.body;
  const userId = req.user.id_user; 

  if (!num_telefono) {
    return res.status(400).json({ error: 'El número de teléfono es obligatorio' });
  }

  if (num_telefono.length !== 9 || !/^\d+$/.test(num_telefono)) {
    return res.status(400).json({ error: 'El número de teléfono debe tener 9 dígitos' });
  }

  try {
    const phoneResult = await pool.query(
      'SELECT * FROM users WHERE num_telefono = $1 AND id_user != $2',
      [num_telefono, userId]
    );
    if (phoneResult.rows.length > 0) {
      return res.status(400).json({ error: 'El número de teléfono ya está registrado por otro usuario' });
    }

    const result = await pool.query(
      'UPDATE users SET num_telefono = $1 WHERE id_user = $2 RETURNING *',
      [num_telefono, userId]
    );

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar el número de teléfono:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.deleteUser = async (req, res) => {
  const userId = req.user.id_user;

  try {
      // Eliminar los detalles de pedido asociados
      await pool.query(
          'DELETE FROM detalles_pedido WHERE pedido_id IN (SELECT id_pedido FROM pedidos WHERE user_id = $1)',
          [userId]
      );

      // Eliminar los pedidos asociados
      await pool.query('DELETE FROM pedidos WHERE user_id = $1', [userId]);

      // Finalmente, eliminar al usuario
      await pool.query('DELETE FROM users WHERE id_user = $1', [userId]);

      // Respuesta exitosa
      res.status(200).json({ message: "Cuenta eliminada exitosamente" });
  } catch (err) {
      console.error('Error al eliminar la cuenta:', err);
      res.status(500).json({ error: "Error interno del servidor" });
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
