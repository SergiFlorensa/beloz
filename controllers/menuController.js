// controllers/menuController.js

const pool = require('../models/dbpostgre');

// Obtener ítems de menú por ID de restaurante
exports.getMenuItemsByRestaurantId = async (req, res) => {
  const { restaurantId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM menu_items WHERE restaurant_id = $1', [restaurantId]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching menu items:', err.message);
    res.status(500).json({ error: 'Error fetching menu items' });
  }
};
