// PaymentController.js
const pool = require('../database'); // Asegúrate de tener la conexión a la base de datos
const bcrypt = require('bcrypt');

exports.savePaymentData = async (req, res) => {
    const { userId, nombreTitular, numeroTarjetaEncriptado, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado } = req.body;

    if (!userId || !nombreTitular || !numeroTarjetaEncriptado || !fechaExpiracion) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const existingData = await pool.query('SELECT * FROM datos_bancarios WHERE user_id = $1', [userId]);
        if (existingData.rows.length > 0) {
            // Actualiza si ya existe
            await pool.query(
                'UPDATE datos_bancarios SET nombre_titular = $1, numero_tarjeta = $2, fecha_expiracion = $3, tipo_tarjeta = $4, metodo_pago_predeterminado = $5 WHERE user_id = $6',
                [nombreTitular, numeroTarjetaEncriptado, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado, userId]
            );
            return res.status(200).json({ message: 'Datos de pago actualizados correctamente' });
        } else {
            // Inserta si no existe
            await pool.query(
                'INSERT INTO datos_bancarios (user_id, nombre_titular, numero_tarjeta, fecha_expiracion, tipo_tarjeta, metodo_pago_predeterminado) VALUES ($1, $2, $3, $4, $5, $6)',
                [userId, nombreTitular, numeroTarjetaEncriptado, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado]
            );
            return res.status(201).json({ message: 'Datos de pago guardados correctamente' });
        }
    } catch (err) {
        console.error('Error al guardar los datos de pago:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.getPaymentData = async (req, res) => {
    const { userId } = req.params;

    try {
        const result = await pool.query('SELECT * FROM datos_bancarios WHERE user_id = $1', [userId]);
        if (result.rows.length > 0) {
            return res.status(200).json(result.rows[0]);
        } else {
            return res.status(404).json({ message: 'No se encontraron datos de pago para este usuario' });
        }
    } catch (err) {
        console.error('Error al obtener los datos de pago:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
