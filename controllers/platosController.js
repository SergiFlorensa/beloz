const pool = require('../models/dbpostgre');

// Obtener platos por ID de restaurante
exports.getPlatosByRestauranteId = async (req, res) => {
  const { restaurantId } = req.query;

  try {
    const result = await pool.query(
      'SELECT * FROM platos WHERE restauranteId = $1',
      [restaurantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching platos:', error);
    res.status(500).send('Error fetching platos');
  }
};
