const express = require('express');
const {
    crearPedido,
    crearDetallesPedido,
    getPedidosPorUsuario,
    getDetallePedido,
} = require('../controllers/pedidosController');

const router = express.Router();
router.use(require('../middleware/authenticateToken'));

router.get('/', getPedidosPorUsuario);

router.post('/crear', crearPedido);

router.post('/:pedidoId/detalles', crearDetallesPedido);

router.get('/:pedidoId', getDetallePedido);

router.get('/:pedidoId/detalles', getDetallePedido);

module.exports = router;
