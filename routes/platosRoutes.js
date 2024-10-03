const express = require('express');
const router = express.Router();
const platosController = require('../controllers/platosController');

// Obtener todos los platos
router.get('/', platosController.getAllPlatos);

// Obtener un plato por ID
router.get('/:id', platosController.getPlatoById);

// Obtener platos por ID de restaurante
router.get('/restaurant/:restaurantId', platosController.getPlatosByRestaurantId);

module.exports = router;
