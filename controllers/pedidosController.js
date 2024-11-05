const pool = require('../models/dbpostgre');

exports.crearPedido = async (req, res) => {
    const { userId, restaurantId, detalles } = req.body;

    if (!userId || !restaurantId || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos para crear el pedido.' });
    }

    const total = detalles.reduce((acc, detalle) => acc + (detalle.precio * detalle.cantidad), 0);

    try {
        await pool.query('BEGIN');
        
        // Inserta en la tabla pedidos y obtiene el id del nuevo pedido
        const pedidoResult = await pool.query(
            `INSERT INTO pedidos (user_id, restaurant_id, fecha, total) 
             VALUES ($1, $2, NOW(), $3) RETURNING id`,
            [userId, restaurantId, total]
        );
        
        const pedidoId = pedidoResult.rows[0].id;  // ID del pedido recién creado

        // Inserta cada detalle en la tabla detalle_pedido usando el pedidoId
        const detalleInsertPromises = detalles.map(detalle => {
            return pool.query(
                `INSERT INTO detalle_pedido (pedido_id, plato_id, cantidad, precio) 
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, detalle.platoId, detalle.cantidad, detalle.precio]
            );
        });

        await Promise.all(detalleInsertPromises);  // Ejecuta todas las inserciones en detalle_pedido
        await pool.query('COMMIT');  // Confirma la transacción
        res.status(201).json({ id: pedidoId, fecha: pedidoResult.rows[0].fecha, total });
    } catch (err) {
        await pool.query('ROLLBACK');  // Revierte la transacción en caso de error
        console.error('Error al crear el pedido:', err.message);
        res.status(500).json({ error: 'Error al crear el pedido', details: err.message });
    }
};
