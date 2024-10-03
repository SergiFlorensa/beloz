// routes/restauranteRoutes.js

const express = require('express');
const router = express.Router();
const restauranteController = require('../controllers/restauranteController');

// Obtener todos los restaurantes
router.get('/', restauranteController.getAllRestaurantes);

// Obtener un restaurante por ID
router.get('/:id', restauranteController.getRestauranteById);

// Filtrar restaurantes por país
router.get('/filter/country', restauranteController.getRestaurantesByCountry);

// Filtrar restaurantes por tipo de comida
router.get('/filter/food-type', restauranteController.getRestaurantesByFoodType);

// Filtrar restaurantes por nivel de precio
router.get('/filter/price', restauranteController.getRestaurantesByPriceLevel);

// Buscar restaurantes
router.get('/search', restauranteController.searchRestaurantes);

module.exports = router;