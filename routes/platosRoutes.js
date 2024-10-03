const express = require('express');
const router = express.Router();
const { getPlatosByRestauranteId } = require('../controllers/platosController');

// Definir las rutas
router.get('/:restauranteId', getPlatosByRestauranteId);

module.exports = router;
