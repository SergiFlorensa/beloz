const pool = require('../models/dbpostgre');

exports.getRestaurantes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurante');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getRestaurantesPopulares = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurante WHERE es_popular = true');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Añade otras funciones si las necesitas
