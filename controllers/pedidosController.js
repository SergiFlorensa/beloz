// controllers/pedidosController.js
const pool = require('../models/dbpostgre');

// Controlador para crear un nuevo pedido
exports.crearPedido = async (req, res) => {
    const userId = req.user.idUser; // Obtener userId desde el token JWT
    const { restaurantId, detalles } = req.body;

    if (!userId || !restaurantId || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
        return res.status(400).json({ error: 'restaurantId y detalles son requeridos.' });
    }

    // Calcular el total del pedido
    const total = detalles.reduce((acc, detalle) => acc + (detalle.precio * detalle.cantidad), 0);

    try {
        // Iniciar una transacción
        await pool.query('BEGIN');

        // Insertar el pedido
        const pedidoResult = await pool.query(
            `INSERT INTO pedidos (user_id, restaurant_id, total)
             VALUES ($1, $2, $3)
             RETURNING id, fecha`,
            [userId, restaurantId, total]
        );

        const pedidoId = pedidoResult.rows[0].id;
        const fecha = pedidoResult.rows[0].fecha;

        // Insertar los detalles del pedido
        const detalleInsertPromises = detalles.map(detalle => {
            return pool.query(
                `INSERT INTO detalle_pedidos (pedido_id, plato_id, cantidad, precio)
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, detalle.platoId, detalle.cantidad, detalle.precio]
            );
        });

        await Promise.all(detalleInsertPromises);

        // Confirmar la transacción
        await pool.query('COMMIT');

        res.status(201).json({
            id: pedidoId,
            userId,
            restaurantId,
            fecha,
            total,
            detalles
        });
    } catch (err) {
        // Revertir la transacción en caso de error
        await pool.query('ROLLBACK');
        console.error('Error al crear el pedido:', err.message);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};


// Controlador para obtener todos los pedidos de un usuario
exports.getPedidosPorUsuario = async (req, res) => {
    const userId = req.session.userId; // Obtener userId desde la sesión

    if (!userId) {
        return res.status(400).json({ error: 'El ID de usuario es requerido' });
    }

    try {
        const result = await pool.query(
            `SELECT id, user_id, restaurant_id, fecha, total
             FROM pedidos
             WHERE user_id = $1
             ORDER BY fecha DESC`,
            [userId]
        );

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener los pedidos:', err.message);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Controlador para obtener los detalles de un pedido específico
exports.getDetallePedido = async (req, res) => {
    const pedidoId = req.params.pedidoId;
    const userId = req.user.idUser; // Obtener userId desde el token JWT

    if (!pedidoId) {
        return res.status(400).json({ error: 'El ID del pedido es requerido' });
    }

    try {
        // Verificar que el pedido pertenece al usuario
        const pedidoResult = await pool.query(
            `SELECT id, user_id, restaurant_id, fecha, total
             FROM pedidos
             WHERE id = $1 AND user_id = $2`,
            [pedidoId, userId]
        );

        if (pedidoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado o no pertenece al usuario.' });
        }

        // Obtener los detalles del pedido
        const detallesResult = await pool.query(
            `SELECT dp.id_detalle, dp.pedido_id, dp.plato_id, dp.cantidad, dp.precio, p.name AS plato_name
             FROM detalle_pedido dp
             JOIN platos p ON dp.plato_id = p.id
             WHERE dp.pedido_id = $1`,
            [pedidoId]
        );

        res.status(200).json(detallesResult.rows);
    } catch (err) {
        console.error('Error al obtener los detalles del pedido:', err.message);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
