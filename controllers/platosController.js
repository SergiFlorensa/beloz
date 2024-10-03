const pool = require('../models/dbpostgre'); // Asegúrate de tener bien configurada la conexión a la base de datos

// Función para obtener platos por ID de restaurante
const getPlatosByRestauranteId = async (req, res) => {
  const { restauranteId } = req.params;

  try {
    const result = await pool.query('SELECT * FROM platos WHERE restauranteId = $1', [restauranteId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron platos para el restaurante especificado.' });
    }
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching platos:', error);
    res.status(500).json({ error: 'Error fetching platos' });
  }
};

module.exports = { getPlatosByRestauranteId };
