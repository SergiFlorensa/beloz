const pool = require('../models/dbpostgre');

// Obtener todos los restaurantes
exports.getAllRestaurantes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurante');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching restaurantes:', err.message);
    res.status(500).json({ error: 'Error fetching restaurantes' });
  }
};

// Obtener un restaurante por ID
exports.getRestauranteById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM restaurante WHERE restaurante_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching restaurante:', err.message);
    res.status(500).json({ error: 'Error fetching restaurante' });
  }
};


// Obtener restaurantes filtrados por país
exports.getRestaurantesByCountry = async (req, res) => {
    const { country } = req.query;
    try {
      let query = 'SELECT * FROM restaurante';
      let params = [];
  
      if (country) {
        query += ' WHERE country = $1';
        params.push(country);
      }
  
      const result = await pool.query(query, params);
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error fetching restaurantes por país:', err.message);
      res.status(500).json({ error: 'Error fetching restaurantes' });
    }
  };
  
  // Obtener restaurantes filtrados por tipo de comida
  exports.getRestaurantesByFoodType = async (req, res) => {
    const { types } = req.query; // espera una lista separada por comas
    try {
      const typesArray = types.split(',').map(type => type.trim());
      const placeholders = typesArray.map((_, index) => `$${index + 1}`).join(', ');
      const query = `SELECT * FROM restaurante WHERE type_of_food ILIKE ANY (ARRAY[${placeholders}])`;
      const result = await pool.query(query, typesArray);
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error fetching restaurantes por tipo de comida:', err.message);
      res.status(500).json({ error: 'Error fetching restaurantes' });
    }
  };
  
  // Obtener restaurantes filtrados por nivel de precio
  exports.getRestaurantesByPriceLevel = async (req, res) => {
    const { priceLevel } = req.query;
    if (!priceLevel) {
      return res.status(400).json({ error: 'Price level is required' });
    }
  
    try {
      const result = await pool.query(
        'SELECT * FROM restaurante WHERE price_level = $1',
        [priceLevel]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No restaurants found for the given price level' });
      }
  
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error fetching restaurantes por nivel de precio:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  
  // Buscar restaurantes
  exports.searchRestaurantes = async (req, res) => {
    const { query } = req.query;
  
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
  
    try {
      const result = await pool.query(
        `SELECT * FROM restaurante 
         WHERE type_of_food ILIKE $1 
            OR name ILIKE $2`,
        [`%${query}%`, `%${query}%`]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'No restaurants found' });
      }
  
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error searching restaurantes:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };