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

module.exports = router;
