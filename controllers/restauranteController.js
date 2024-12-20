const pool = require('../models/dbpostgre');

exports.getRestaurantesByCountry = async (req, res) => {
  const country = req.query.country;

  console.log('País recibido:', country); 

  if (!country) {
    return res.status(400).json({ error: 'El país es requerido' });
  }

  try {
    const result = await pool.query('SELECT * FROM restaurante WHERE country = $1', [country]);

    console.log('Resultados:', result.rows); 

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron restaurantes para el país especificado.' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error al cargar restaurantes por país:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getRestaurantesPopulares = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurante WHERE es_popular = true');
    res.json(result.rows);
  } catch (err) {
    console.error('Error retrieving popular brands:', err.message);
    res.status(500).send('Error retrieving data from database');
  }
};

exports.getAllRestaurantes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurante');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error en getAllRestaurantes:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getRestaurantesPorNivelPrecio = async (req, res) => {
  const { priceLevel } = req.query;

  if (!priceLevel) {
    return res.status(400).json({ error: 'El nivel de precio es requerido' });
  }

  try {
    const result = await pool.query('SELECT * FROM restaurante WHERE price_level = $1', [priceLevel]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron restaurantes para el nivel de precio especificado.' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error al cargar restaurantes:', err.message); 
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getRestaurantesFiltradosPorTipos = async (req, res) => {
  const types = req.query.types;

  if (!types) {
    return res.status(400).json({ error: 'Types of food are required' });
  }

  const typesArray = types.split(',').map(type => type.trim());

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
    console.error('Error al filtrar restaurantes:', err);
    res.status(500).json({ error: 'Error interno del servidor', details: err.message });
  }
};


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
      return res.status(200).json({ message: 'No restaurants found for your search.' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};


exports.getRestaurantesPorValoracion = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurante ORDER BY valoracion DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error al obtener los restaurantes por valoración:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
exports.getRestaurantesPorRelevancia = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurante ORDER BY relevancia DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error al obtener los restaurantes por relevancia:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getRestaurantesInteres = async (req, res) => {
  try {
    const ids = [5, 6, 8, 22];
    const query = `SELECT restaurante_id, name, image_path FROM restaurante WHERE restaurante_id = ANY($1)`;
    const result = await pool.query(query, [ids]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron restaurantes con los IDs especificados' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error al obtener los restaurantes de interés:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

