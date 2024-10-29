// PaymentController.js
const pool = require('../models/dbpostgre'); // Asegúrate de que la ruta sea correcta según la estructura del proyecto
const bcrypt = require('bcrypt'); // Si usas bcrypt para alguna funcionalidad adicional

// Guardar o actualizar datos de pago
exports.savePaymentData = async (req, res) => {
    const { userId, nombreTitular, numeroTarjetaEncriptado, iv, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado } = req.body;

    if (!userId || !nombreTitular || !numeroTarjetaEncriptado || !iv || !fechaExpiracion) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const existingData = await pool.query('SELECT * FROM datos_bancarios WHERE user_id = $1', [userId]);
        
        if (existingData.rows.length > 0) {
            // Actualizar si ya existen datos
            await pool.query(
                'UPDATE datos_bancarios SET nombre_titular = $1, numero_tarjeta = $2, iv = $3, fecha_expiracion = $4, tipo_tarjeta = $5, metodo_pago_predeterminado = $6 WHERE user_id = $7',
                [nombreTitular, numeroTarjetaEncriptado, iv, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado, userId]
            );
            return res.status(200).json({ message: 'Datos de pago actualizados correctamente' });
        } else {
            // Insertar si no existen datos
            await pool.query(
                'INSERT INTO datos_bancarios (user_id, nombre_titular, numero_tarjeta, iv, fecha_expiracion, tipo_tarjeta, metodo_pago_predeterminado) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [userId, nombreTitular, numeroTarjetaEncriptado, iv, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado]
            );
            return res.status(201).json({ message: 'Datos de pago guardados correctamente' });
        }
    } catch (err) {
        console.error('Error al guardar los datos de pago:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Obtener datos de pago por ID de usuario
exports.getPaymentData = async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query('SELECT * FROM datos_bancarios WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron datos de pago para este usuario.' });
        }
        console.log("Datos de pago recuperados:", result.rows[0]); // Para ver los datos en consola
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener los datos de pago:', err.message);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

