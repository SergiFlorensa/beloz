const express = require('express');
const {
  getAllRestaurantes,
  getRestaurantesByCountry,
  getRestaurantesPopulares,
  getRestaurantesPorNivelPrecio ,
  getRestaurantesFiltradosPorTipos,
  searchRestaurantes,
  getRestaurantesPorValoracion,    
  getRestaurantesPorRelevancia,
  getRestaurantesInteres
} = require('../controllers/restauranteController');
const router = express.Router();

router.get('/', getAllRestaurantes);

router.get('/country', getRestaurantesByCountry);

router.get('/populares', getRestaurantesPopulares);

router.get('/filter_by_price', getRestaurantesPorNivelPrecio);

router.get('/filter', getRestaurantesFiltradosPorTipos);

router.get('/search', searchRestaurantes);

router.get('/ordenar_por_valoracion', getRestaurantesPorValoracion);

router.get('/ordenar_por_relevancia', getRestaurantesPorRelevancia);

router.get('/interes', getRestaurantesInteres);

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
