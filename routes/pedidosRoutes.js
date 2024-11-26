const express = require('express');
const {
    crearPedido,
    getPedidosPorUsuario,
    getDetallePedido,
} = require('../controllers/pedidosController');

const router = express.Router();

router.get('/', getPedidosPorUsuario);

router.post('/crear', crearPedido);

router.get('/:pedidoId', getDetallePedido);

module.exports = router;
