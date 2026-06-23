const pool = require('../models/dbpostgre');

exports.savePaymentData = async (req, res) => {
    const userId = req.params.userId || req.body.userId || req.body.user_id;
    const nombreTitular = req.body.nombreTitular || req.body.nombre_titular;
    const numeroTarjetaEncriptado = req.body.numeroTarjetaEncriptado || req.body.numero_tarjeta_encriptado || req.body.numero_tarjeta;
    const iv = req.body.iv;
    const fechaExpiracion = req.body.fechaExpiracion || req.body.fecha_expiracion;
    const tipoTarjeta = req.body.tipoTarjeta || req.body.tipo_tarjeta || null;
    const metodoPagoPredeterminado =
        req.body.metodoPagoPredeterminado ?? req.body.metodo_pago_predeterminado ?? true;

    if (!userId || !nombreTitular || !numeroTarjetaEncriptado || !iv || !fechaExpiracion) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const cardColumn = await getPaymentCardColumn();
        const existingData = await pool.query('SELECT * FROM datos_bancarios WHERE user_id = $1', [userId]);

        if (existingData.rows.length > 0) {
            const result = await pool.query(
                `UPDATE datos_bancarios
                 SET nombre_titular = $1,
                     ${cardColumn} = $2,
                     iv = $3,
                     fecha_expiracion = $4,
                     tipo_tarjeta = $5,
                     metodo_pago_predeterminado = $6
                 WHERE user_id = $7
                 RETURNING *`,
                [nombreTitular, numeroTarjetaEncriptado, iv, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado, userId]
            );
            return res.status(200).json(toPaymentResponse(result.rows[0]));
        } else {
            const result = await pool.query(
                `INSERT INTO datos_bancarios
                 (user_id, nombre_titular, ${cardColumn}, iv, fecha_expiracion, tipo_tarjeta, metodo_pago_predeterminado)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [userId, nombreTitular, numeroTarjetaEncriptado, iv, fechaExpiracion, tipoTarjeta, metodoPagoPredeterminado]
            );
            return res.status(201).json(toPaymentResponse(result.rows[0]));
        }
    } catch (err) {
        console.error('Error al guardar los datos de pago:', err);
        return res.status(500).json({ error: 'Error interno del servidor', details: err.message });
    }
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

        res.status(200).json(toPaymentResponse(paymentData));

    } catch (err) {
        console.error('Error al obtener los datos de pago:', err);
        res.status(500).json({ error: 'Error interno del servidor', details: err.message });
    }
};

function toPaymentResponse(paymentData) {
    return {
        id: paymentData.id,
        user_id: paymentData.user_id,
        userId: paymentData.user_id,
        nombre_titular: paymentData.nombre_titular,
        nombreTitular: paymentData.nombre_titular,
        numero_tarjeta_encriptado: paymentData.numero_tarjeta_encriptado || paymentData.numero_tarjeta,
        numeroTarjetaEncriptado: paymentData.numero_tarjeta_encriptado || paymentData.numero_tarjeta,
        iv: paymentData.iv,
        fecha_expiracion: paymentData.fecha_expiracion,
        fechaExpiracion: paymentData.fecha_expiracion,
        tipo_tarjeta: paymentData.tipo_tarjeta,
        tipoTarjeta: paymentData.tipo_tarjeta,
        metodo_pago_predeterminado: paymentData.metodo_pago_predeterminado,
        metodoPagoPredeterminado: paymentData.metodo_pago_predeterminado
    };
}

async function getPaymentCardColumn() {
    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'datos_bancarios'
           AND column_name IN ('numero_tarjeta_encriptado', 'numero_tarjeta')
         ORDER BY CASE column_name
           WHEN 'numero_tarjeta_encriptado' THEN 1
           WHEN 'numero_tarjeta' THEN 2
         END
         LIMIT 1`
    );

    return result.rows[0]?.column_name || 'numero_tarjeta_encriptado';
}
