const pool = require('../models/dbpostgre');
const { transaction } = require('../security/transaction');
const { HttpError, positiveId, ownUserId, bodyObject, handler } = require('../security/input');

exports.crearPedido = handler(async (req, res) => {
  const body = bodyObject(req.body);
  const userId = ownUserId(req, body.userId, body.user_id);
  const restaurantId = positiveId(body.restaurantId ?? body.restaurant_id);
  if (body.restaurantId !== undefined && body.restaurant_id !== undefined &&
      positiveId(body.restaurantId) !== positiveId(body.restaurant_id)) {
    throw new HttpError(400, 'Restaurante no valido.');
  }
  const details = body.detalles === undefined ? [] : validateDetails(body.detalles);
  if (body.total !== undefined && (typeof body.total !== 'number' || !Number.isFinite(body.total) || body.total < 0 || body.total > 100000)) {
    throw new HttpError(400, 'Importe no valido.');
  }
  const order = await transaction(pool, async (client) => {
    const schema = await getRestaurantSchema(client);
    const restaurant = await client.query(
      `SELECT 1 FROM ${schema.table} WHERE ${schema.idColumn} = $1`, [restaurantId]
    );
    if (!restaurant.rows.length) throw new HttpError(400, 'Restaurante no disponible.');
    const priced = details.length ? await catalogueDetails(client, restaurantId, details) : [];
    const total = totalPrice(priced);
    // Legacy two-step clients create a zero-total draft; only catalogue lines can set its total.
    const result = await client.query(
      'INSERT INTO pedidos (user_id, restaurant_id, fecha, total) VALUES ($1, $2, NOW(), $3) RETURNING id, fecha',
      [userId, restaurantId, total]
    );
    const orderId = result.rows[0].id;
    await insertDetails(client, orderId, priced);
    return { id: orderId, user_id: userId, restaurant_id: restaurantId, fecha: result.rows[0].fecha, total };
  });
  res.status(201).json(order);
});

exports.crearDetallesPedido = handler(async (req, res) => {
  const userId = ownUserId(req);
  const orderId = positiveId(req.params.pedidoId);
  const details = validateDetails(req.body);
  const inserted = await transaction(pool, async (client) => {
    const order = await client.query(
      'SELECT restaurant_id FROM pedidos WHERE id = $1 AND user_id = $2 FOR UPDATE', [orderId, userId]
    );
    if (!order.rows.length) throw new HttpError(404, 'Pedido no encontrado.');
    const existing = await client.query('SELECT 1 FROM detalle_pedido WHERE pedido_id = $1 LIMIT 1', [orderId]);
    if (existing.rows.length) throw new HttpError(409, 'El pedido ya tiene detalles.');
    const priced = await catalogueDetails(client, order.rows[0].restaurant_id, details);
    const rows = await insertDetails(client, orderId, priced);
    await client.query('UPDATE pedidos SET total = $1 WHERE id = $2 AND user_id = $3', [totalPrice(priced), orderId, userId]);
    return rows;
  });
  res.status(201).json(inserted);
});

exports.getPedidosPorUsuario = handler(async (req, res) => {
  const userId = ownUserId(req, req.query.user_id, req.query.userId);
  const result = await pool.query(
    'SELECT id, user_id, restaurant_id, fecha, total FROM pedidos WHERE user_id = $1 ORDER BY fecha DESC', [userId]
  );
  res.status(200).json(result.rows);
});

exports.getDetallePedido = handler(async (req, res) => {
  const userId = ownUserId(req);
  const orderId = positiveId(req.params.pedidoId);
  const schema = await getRestaurantSchema(pool);
  const result = await pool.query(
    `SELECT dp.id_detalle, dp.pedido_id, dp.plato_id, dp.cantidad, dp.precio,
            p.name AS plato_nombre, r.name AS restaurante_nombre
     FROM detalle_pedido dp
     JOIN platos p ON dp.plato_id = p.id
     JOIN pedidos pe ON dp.pedido_id = pe.id
     JOIN ${schema.table} r ON pe.restaurant_id = r.${schema.idColumn}
     WHERE dp.pedido_id = $1 AND pe.user_id = $2`,
    [orderId, userId]
  );
  if (!result.rows.length) throw new HttpError(404, 'Pedido no encontrado o sin detalles.');
  res.status(200).json(result.rows);
});

function validateDetails(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    throw new HttpError(400, 'El pedido debe tener entre 1 y 50 lineas.');
  }
  const seen = new Set();
  return value.map((raw) => {
    const row = bodyObject(raw);
    const id = positiveId(row.platoId ?? row.plato_id);
    if (row.platoId !== undefined && row.plato_id !== undefined && positiveId(row.platoId) !== positiveId(row.plato_id)) {
      throw new HttpError(400, 'Plato no valido.');
    }
    if (!Number.isInteger(row.cantidad) || row.cantidad < 1 || row.cantidad > 99 || seen.has(id)) {
      throw new HttpError(400, 'Cantidad no valida o plato duplicado.');
    }
    seen.add(id);
    return { id, cantidad: row.cantidad };
  });
}

async function catalogueDetails(client, restaurantId, details) {
  const schema = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'platos'
       AND column_name IN ('restaurantid', 'restaurante_id')
     ORDER BY CASE column_name WHEN 'restaurantid' THEN 1 ELSE 2 END LIMIT 1`
  );
  const column = schema.rows[0]?.column_name;
  if (!['restaurantid', 'restaurante_id'].includes(column)) throw new Error('Unsupported menu schema');
  const result = await client.query(
    `SELECT id, price FROM platos WHERE ${column} = $1 AND id = ANY($2::int[]) FOR SHARE`,
    [restaurantId, details.map((detail) => detail.id)]
  );
  const catalogue = new Map(result.rows.map((row) => [Number(row.id), row]));
  return details.map((detail) => {
    const row = catalogue.get(detail.id);
    if (!row) throw new HttpError(400, 'Un plato no pertenece al restaurante o ya no esta disponible.');
    const price = Number(row.price);
    if (row.price === null || !Number.isFinite(price) || price < 0 || price > 100000) {
      throw new HttpError(409, 'Un plato no tiene un precio valido.');
    }
    return { ...detail, cents: Math.round(price * 100) };
  });
}

function totalPrice(details) {
  const cents = details.reduce((sum, row) => sum + row.cents * row.cantidad, 0);
  if (!Number.isSafeInteger(cents) || cents > 10000000) throw new HttpError(400, 'Importe fuera de limite.');
  return cents / 100;
}

async function insertDetails(client, orderId, details) {
  const inserted = [];
  for (const detail of details) {
    const result = await client.query(
      `INSERT INTO detalle_pedido (pedido_id, plato_id, cantidad, precio)
       VALUES ($1, $2, $3, $4) RETURNING id_detalle, pedido_id, plato_id, cantidad, precio`,
      [orderId, detail.id, detail.cantidad, detail.cents / 100]
    );
    inserted.push(result.rows[0]);
  }
  return inserted;
}

async function getRestaurantSchema(client) {
  const result = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('restaurante', 'restaurantes')
     ORDER BY CASE table_name WHEN 'restaurante' THEN 1 ELSE 2 END LIMIT 1`
  );
  const table = result.rows[0]?.table_name;
  if (!['restaurante', 'restaurantes'].includes(table)) throw new Error('Unsupported restaurant schema');
  return { table, idColumn: table === 'restaurantes' ? 'id' : 'restaurante_id' };
}
