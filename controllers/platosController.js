const pool = require('../models/dbpostgre');

exports.getPlatosPorRestaurante = async (req, res) => {
  const restauranteId = req.query.restauranteId;

  if (!restauranteId) {
    return res.status(400).json({ error: 'El ID del restaurante es requerido' });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, description, price, image_path, restaurantid AS restaurante_id
       FROM platos
       WHERE restaurantid = $1`,
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

