const express = require('express');
const {
  getAllRestaurantes,
  getRestaurantesByCountry,
  getRestaurantesPopulares,
  getRestaurantesPorNivelPrecio ,
  getRestaurantesByTypeOfFood,
  searchRestaurantes
} = require('../controllers/restauranteController');
const router = express.Router();

// Obtener todos los restaurantes
router.get('/', getAllRestaurantes);

// Obtener restaurantes filtrados por país
router.get('/country', getRestaurantesByCountry);

// Obtener restaurantes populares
router.get('/populares', getRestaurantesPopulares);

// Filtrar restaurantes por nivel de precio
router.get('/filter_by_price', getRestaurantesPorNivelPrecio);
// Filtrar restaurantes por tipos de comida
router.get('/filter', getRestaurantesByTypeOfFood);

// Buscar restaurantes por nombre o tipo de comida
router.get('/search', searchRestaurantes);

// Ruta de prueba
router.get('/test', async (req, res) => {
  console.log('Solicitud a /api/restaurantes/test recibida');
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({ message: 'Servidor y base de datos funcionando', timestamp: result.rows[0].now });
  } catch (err) {
    console.error('Error en ruta de prueba:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


module.exports = router;
