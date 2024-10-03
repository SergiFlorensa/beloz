const pool = require('../models/db');

// Obtener todos los platos
exports.getAllPlatos = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM platos');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching platos:', err.message);
    res.status(500).json({ error: 'Error fetching platos' });
  }
};

// Obtener un plato por ID
exports.getPlatoById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM platos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching plato:', err.message);
    res.status(500).json({ error: 'Error fetching plato' });
  }
};

// Obtener platos por ID de restaurante
exports.getPlatosByRestaurantId = async (req, res) => {
    const { restaurantId } = req.query;
    try {
      const result = await pool.query('SELECT * FROM platos WHERE restaurantid = $1', [restaurantId]);
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error fetching platos:', err.message);
      res.status(500).json({ error: 'Error fetching platos' });
    }
  };