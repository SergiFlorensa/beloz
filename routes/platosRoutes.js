const express = require('express');
const { getPlatosPorRestaurante } = require('../controllers/platosController');
const router = express.Router();

router.get('/', getPlatosPorRestaurante);

module.exports = router;
