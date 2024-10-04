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

module.exports = router;
