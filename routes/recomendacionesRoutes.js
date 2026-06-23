const express = require('express');
const { generarRecomendaciones } = require('../controllers/recomendacionesController');

const router = express.Router();

router.post('/', generarRecomendaciones);

module.exports = router;
