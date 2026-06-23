const pool = require('../models/dbpostgre');

exports.getPlatosPorRestaurante = async (req, res) => {
  const restauranteId = req.params.id || req.query.restauranteId || req.query.restaurante_id;

  if (!restauranteId) {
    return res.status(400).json({ error: 'El ID del restaurante es requerido' });
  }

  try {
    const restaurantColumn = await getPlatosRestaurantColumn();
    const result = await pool.query(
      `SELECT id, name, description, price, image_path, ${restaurantColumn} AS restaurante_id
       FROM platos
       WHERE ${restaurantColumn} = $1`,
      [restauranteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron platos para el restaurante especificado.' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error al cargar platos:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

async function getPlatosRestaurantColumn() {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'platos'
       AND column_name IN ('restaurantid', 'restaurante_id')
     ORDER BY CASE column_name
       WHEN 'restaurantid' THEN 1
       WHEN 'restaurante_id' THEN 2
     END
     LIMIT 1`
  );

  return result.rows[0]?.column_name || 'restaurantid';
}
