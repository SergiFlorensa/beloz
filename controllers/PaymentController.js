// PaymentController.js
const pool = require('../models/dbpostgre'); // Cambia la ruta según la estructura de tu proyecto

// Guardar datos de pago
exports.savePaymentData = async (req, res) => {
  const { userId, nombreTitular, numeroTarjetaEncriptado, iv, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado } = req.body;

  if (!userId || !nombreTitular || !numeroTarjetaEncriptado || !iv || !fechaExpiracion) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const existingData = await pool.query('SELECT * FROM datos_bancarios WHERE user_id = $1', [userId]);

    if (existingData.rows.length > 0) {
      // Actualizar si los datos de pago existen
      await pool.query(
        `UPDATE datos_bancarios 
         SET nombre_titular = $1, numero_tarjeta_encriptado = $2, iv = $3, fecha_expiracion = $4, tipo_tarjeta = $5, metodo_pago_predeterminado = $6 
         WHERE user_id = $7`,
        [nombreTitular, numeroTarjetaEncriptado, iv, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado, userId]
      );
      return res.status(200).json({ message: 'Datos de pago actualizados correctamente' });
    } else {
      // Insertar si los datos de pago no existen
      await pool.query(
        `INSERT INTO datos_bancarios (user_id, nombre_titular, numero_tarjeta_encriptado, iv, fecha_expiracion, tipo_tarjeta, metodo_pago_predeterminado) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, nombreTitular, numeroTarjetaEncriptado, iv, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado]
      );
      return res.status(201).json({ message: 'Datos de pago guardados correctamente' });
    }
  } catch (err) {
    console.error('Error al guardar los datos de pago:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener datos de pago por ID de usuario
exports.getPaymentData = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'El ID de usuario es requerido' });
  }

  try {
    const result = await pool.query('SELECT * FROM datos_bancarios WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron datos de pago para este usuario.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener los datos de pago:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
