const pool = require('../models/dbpostgre');

exports.crearPedido = async (req, res) => {
    const { userId, restaurantId, detalles } = req.body;

    if (!userId || !restaurantId || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos para crear el pedido.' });
    }

    const total = detalles.reduce((acc, detalle) => acc + (detalle.precio * detalle.cantidad), 0);

    try {
        // Iniciar transacción
        await pool.query('BEGIN');

        // Insertar el pedido en la tabla `pedidos`
        const pedidoResult = await pool.query(
            `INSERT INTO pedidos (user_id, restaurant_id, fecha, total) 
             VALUES ($1, $2, NOW(), $3) RETURNING id`,
            [userId, restaurantId, total]
        );
        
        const pedidoId = pedidoResult.rows[0].id;

        // Insertar detalles del pedido en la tabla `detalle_pedido`
        const detallePromises = detalles.map(detalle => {
            return pool.query(
                `INSERT INTO detalle_pedido (pedido_id, plato_id, cantidad, precio) 
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, detalle.platoId, detalle.cantidad, detalle.precio]
            );
        });

        // Ejecutar todas las inserciones de detalle
        await Promise.all(detallePromises);

        // Confirmar transacción
        await pool.query('COMMIT');

        // Responder con el pedido creado
        res.status(201).json({
            id: pedidoId,
            fecha: new Date().toISOString(),
            total: total
        });
    } catch (err) {
        // Si ocurre un error, revertir la transacción
        await pool.query('ROLLBACK');
        console.error('Error al crear el pedido:', err.message);
        res.status(500).json({ error: 'Error al crear el pedido', details: err.message });
    }
};


exports.getPedidosPorUsuario = async (req, res) => {
    const userId = req.query.user_id; // Obtenemos el ID del usuario desde los parámetros de consulta

    if (!userId) {
        return res.status(400).json({ error: 'El ID del usuario es requerido' });
    }

    try {
        // Consulta para obtener los pedidos del usuario
        const result = await pool.query(
            `SELECT * FROM pedidos WHERE user_id = $1 ORDER BY fecha DESC`,
            [userId]
        );
        
        // Si no hay pedidos, retorna un mensaje
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron pedidos para este usuario' });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener pedidos del usuario:', err.message);
        res.status(500).json({ error: 'Error interno del servidor', details: err.message });
    }
};


// Obtener los detalles de un pedido
exports.getDetallePedido = async (req, res) => {
    const { pedidoId } = req.params;

    try {
        const result = await pool.query(
            `SELECT dp.cantidad, dp.precio, p.name AS plato_nombre, r.name AS restaurante_nombre
             FROM detalle_pedido dp
             JOIN platos p ON dp.plato_id = p.id
             JOIN pedidos pe ON dp.pedido_id = pe.id
             JOIN restaurante r ON pe.restaurant_id = r.restaurante_id
             WHERE dp.pedido_id = $1`,
            [pedidoId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No se encontraron detalles para este pedido' });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener detalles del pedido:', err.message);
        res.status(500).json({ error: 'Error al obtener detalles del pedido', details: err.message });
    }
};
