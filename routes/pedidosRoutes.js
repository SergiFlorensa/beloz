// routes/pedidosRoutes.js
const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');

router.post('/crear', pedidosController.crearPedido);
router.get('/', pedidosController.getPedidosPorUsuario);
router.get('/:pedidoId', pedidosController.getDetallePedido);

module.exports = router;
