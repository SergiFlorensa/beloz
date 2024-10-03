const express = require('express');
const router = express.Router();

// Asegúrate de que la ruta y el nombre del archivo sean correctos
const restauranteController = require('../controllers/restauranteController');

// Usando las funciones del controlador
router.get('/', restauranteController.getRestaurantes);
router.get('/populares', restauranteController.getRestaurantesPopulares);
// Añade otras rutas según sea necesario

module.exports = router;
