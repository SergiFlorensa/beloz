const pool = require('../models/dbpostgre');

exports.crearPedido = async (req, res) => {
    const { userId, restaurantId, detalles } = req.body;

    if (!userId || !restaurantId || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos para crear el pedido.' });
    }

    const total = detalles.reduce((acc, detalle) => acc + (detalle.precio * detalle.cantidad), 0);

    try {
        await pool.query('BEGIN');
        const pedidoResult = await pool.query(
            `INSERT INTO pedidos (user_id, restaurant_id, fecha, total) 
             VALUES ($1, $2, NOW(), $3) RETURNING id, fecha`,
            [userId, restaurantId, total]
        );
        const pedidoId = pedidoResult.rows[0].id;

        const detalleInsertPromises = detalles.map(detalle => {
            return pool.query(
                `INSERT INTO detalle_pedidos (pedido_id, plato_id, cantidad, precio) VALUES ($1, $2, $3, $4)`,
                [pedidoId, detalle.platoId, detalle.cantidad, detalle.precio]
            );
        });

        await Promise.all(detalleInsertPromises);
        await pool.query('COMMIT');
        res.status(201).json({ id: pedidoId, fecha: pedidoResult.rows[0].fecha, total });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error al crear el pedido:', err.message);
        res.status(500).json({ error: 'Error al crear el pedido' });
    }
};
