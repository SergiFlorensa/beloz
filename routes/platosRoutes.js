const express = require('express');
const { getPlatosByRestauranteId } = require('../controllers/platosController');
const router = express.Router();

router.get('/', getPlatosByRestauranteId);

module.exports = router;
