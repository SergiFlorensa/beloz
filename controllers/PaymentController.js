const pool = require('../models/dbpostgre'); 
const bcrypt = require('bcrypt'); 

exports.savePaymentData = async (req, res) => {
    const { userId, nombreTitular, numeroTarjetaEncriptado, iv, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado } = req.body;

    if (!userId || !nombreTitular || !numeroTarjetaEncriptado || !iv || !fechaExpiracion) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const existingData = await pool.query('SELECT * FROM datos_bancarios WHERE user_id = $1', [userId]);
        
        if (existingData.rows.length > 0) {
            await pool.query(
                'UPDATE datos_bancarios SET nombre_titular = $1, numero_tarjeta = $2, iv = $3, fecha_expiracion = $4, tipo_tarjeta = $5, metodo_pago_predeterminado = $6 WHERE user_id = $7',
                [nombreTitular, numeroTarjetaEncriptado, iv, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado, userId]
            );
            return res.status(200).json({ message: 'Datos de pago actualizados correctamente' });
        } else {
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

const decryptCardData = (encryptedData, iv) => {
    const key = process.env.ENCRYPTION_KEY; 
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};
exports.getPaymentData = async (req, res) => {
    const { userId } = req.params;
    console.log(`Recibiendo solicitud para obtener datos de pago para userId: ${userId}`);

    if (!userId) {
        return res.status(400).json({ error: 'El userId es requerido' });
    }

    try {
        const result = await pool.query('SELECT * FROM datos_bancarios WHERE user_id = $1', [userId]);

        if (result.rows.length === 0) {
            console.error("No se encontraron datos para el usuario:", userId);
            return res.status(404).json({ error: 'No se encontraron datos de pago para este usuario.' });
        }

        const paymentData = result.rows[0];
        console.log("Datos de pago encontrados:", paymentData);

        const paymentDataCamelCase = {
            userId: paymentData.userId,
            nombreTitular: paymentData.nombre_titular,
            numeroTarjetaEncriptado: paymentData.numero_tarjeta,
            iv: paymentData.iv,
            fechaExpiracion: paymentData.fecha_expiracion,
            tipoTarjeta: paymentData.tipo_tarjeta,
            metodoPagoPredeterminado: paymentData.metodo_pago_predeterminado
        };

        res.status(200).json(paymentDataCamelCase);

    } catch (err) {
        console.error('Error al obtener los datos de pago:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
