const pool = require('../models/dbpostgre');

// Obtener restaurantes filtrados por país
exports.getRestaurantesByCountry = async (req, res) => {
  const country = req.query.country;
  let query = 'SELECT * FROM restaurante';
  const params = [];

  if (country) {
    query += ' WHERE country = $1';
    params.push(country);
  }

  try {
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Obtener restaurantes populares
exports.getRestaurantesPopulares = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurante WHERE es_popular = true');
    res.json(result.rows);
  } catch (err) {
    console.error('Error retrieving popular brands:', err.message);
    res.status(500).send('Error retrieving data from database');
  }
};

// Obtener todos los restaurantes
exports.getAllRestaurantes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurante');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Filtrar restaurantes por nivel de precio
exports.getRestaurantesByPriceLevel = async (req, res) => {
  const { priceLevel } = req.query;

  if (!priceLevel) {
    return res.status(400).json({ error: 'Price level is required' });
  }

  try {
    const result = await pool.query('SELECT * FROM restaurante WHERE price_level = $1', [priceLevel]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No restaurants found for the given price level' });
    }
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};


// Filtrar restaurantes por tipos de comida
exports.getRestaurantesByTypeOfFood = async (req, res) => {
  const types = req.query.types;

  if (!types) {
    return res.status(400).json({ error: 'Types of food are required' });
  }

  const typesArray = types.split(',').map(type => type.trim());

  // Generar condiciones dinámicas para la consulta
  const conditions = typesArray.map((type, index) => `type_of_food ILIKE $${index + 1}`).join(' OR ');
  const values = typesArray.map(type => `%${type}%`);

  try {
    const query = `SELECT * FROM restaurante WHERE ${conditions}`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No restaurants found for the given types' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Buscar restaurantes por nombre o tipo de comida
exports.searchRestaurantes = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM restaurante WHERE name ILIKE $1 OR type_of_food ILIKE $1`,
      [`%${query}%`]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No restaurants found' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
