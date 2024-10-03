// routes/menuRoutes.js

const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

// Obtener ítems de menú por ID de restaurante
router.get('/:restaurantId', menuController.getMenuItemsByRestaurantId);

module.exports = router;
