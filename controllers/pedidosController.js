const pool = require('../models/dbpostgre');

exports.crearPedido = async (req, res) => {
    const userId = req.body.userId || req.body.user_id;
    const restaurantId = req.body.restaurantId || req.body.restaurant_id;
    const detalles = req.body.detalles;

    if (!userId || !restaurantId) {
        return res.status(400).json({ error: 'Datos incompletos para crear el pedido.' });
    }

    const total = Array.isArray(detalles) && detalles.length > 0
        ? detalles.reduce((acc, detalle) => acc + (detalle.precio * detalle.cantidad), 0)
        : Number(req.body.total || 0);

    try {
        await pool.query('BEGIN');

        const pedidoResult = await pool.query(
            `INSERT INTO pedidos (user_id, restaurant_id, fecha, total) 
             VALUES ($1, $2, NOW(), $3) RETURNING id`,
            [userId, restaurantId, total]
        );

        const pedidoId = pedidoResult.rows[0].id;

        for (const detalle of detalles || []) {
            await pool.query(
                `INSERT INTO detalle_pedido (pedido_id, plato_id, cantidad, precio) 
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, detalle.platoId || detalle.plato_id, detalle.cantidad, detalle.precio]
            );
        }

        await pool.query('COMMIT');

        res.status(201).json({
            id: pedidoId,
            user_id: Number(userId),
            restaurant_id: Number(restaurantId),
            fecha: new Date().toISOString(),
            total: total
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error al crear el pedido:', err.message);
        res.status(500).json({ error: 'Error al crear el pedido', details: err.message });
    }
};

exports.crearDetallesPedido = async (req, res) => {
    const { pedidoId } = req.params;
    const detalles = req.body;

    if (!pedidoId || !Array.isArray(detalles)) {
        return res.status(400).json({ error: 'El pedido y los detalles son obligatorios.' });
    }

    try {
        const inserted = [];

        for (const detalle of detalles) {
            const result = await pool.query(
                `INSERT INTO detalle_pedido (pedido_id, plato_id, cantidad, precio)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id_detalle, pedido_id, plato_id, cantidad, precio`,
                [pedidoId, detalle.platoId || detalle.plato_id, detalle.cantidad, detalle.precio]
            );
            inserted.push(result.rows[0]);
        }

        res.status(201).json(inserted);
    } catch (err) {
        console.error('Error al crear detalles del pedido:', err.message);
        res.status(500).json({ error: 'Error al crear detalles del pedido', details: err.message });
    }
};



exports.getPedidosPorUsuario = async (req, res) => {
    const userId = req.query.user_id; 

    if (!userId) {
        return res.status(400).json({ error: 'El ID del usuario es requerido' });
    }

    try {
        const result = await pool.query(
            `SELECT * FROM pedidos WHERE user_id = $1 ORDER BY fecha DESC`,
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron pedidos para este usuario' });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener pedidos del usuario:', err.message);
        res.status(500).json({ error: 'Error interno del servidor', details: err.message });
    }
};


exports.getDetallePedido = async (req, res) => {
    const { pedidoId } = req.params;

    try {
        const restaurantTable = await getRestaurantTableName();
        const restaurantIdColumn = restaurantTable === 'restaurantes' ? 'id' : 'restaurante_id';
        const result = await pool.query(
            `SELECT dp.id_detalle,
                    dp.pedido_id,
                    dp.plato_id,
                    dp.cantidad,
                    dp.precio,
                    p.name AS plato_nombre,
                    r.name AS restaurante_nombre
             FROM detalle_pedido dp
             JOIN platos p ON dp.plato_id = p.id
             JOIN pedidos pe ON dp.pedido_id = pe.id
             JOIN ${restaurantTable} r ON pe.restaurant_id = r.${restaurantIdColumn}
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

async function getRestaurantTableName() {
    const result = await pool.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('restaurante', 'restaurantes')
         ORDER BY CASE table_name
           WHEN 'restaurante' THEN 1
           WHEN 'restaurantes' THEN 2
         END
         LIMIT 1`
    );

    return result.rows[0]?.table_name || 'restaurante';
}
