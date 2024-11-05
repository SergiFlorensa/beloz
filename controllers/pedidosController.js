const pool = require('../models/dbpostgre');

exports.crearPedido = async (req, res) => {
    const { userId, restaurantId, detalles } = req.body;

    // Verifica que los campos necesarios están presentes
    if (!userId || !restaurantId || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos para crear el pedido.' });
    }

    // Calcular el total basándonos en los detalles proporcionados
    const total = detalles.reduce((acc, detalle) => acc + (detalle.precio * detalle.cantidad), 0);

    try {
        // Insertar el pedido en la tabla `pedidos`
        const pedidoResult = await pool.query(
            `INSERT INTO pedidos (user_id, restaurant_id, fecha, total) 
             VALUES ($1, $2, NOW(), $3) RETURNING id, fecha, total`,
            [userId, restaurantId, total]
        );

        // Extraer el pedido insertado
        const pedido = pedidoResult.rows[0];

        // Responder con el pedido creado
        res.status(201).json({
            id: pedido.id,
            fecha: pedido.fecha,
            total: pedido.total
        });
    } catch (err) {
        console.error('Error al crear el pedido:', err.message);
        res.status(500).json({ error: 'Error al crear el pedido', details: err.message });
    }
};
