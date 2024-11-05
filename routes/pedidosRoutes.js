const express = require('express');
const {
    crearPedido,
    getPedidosPorUsuario,
} = require('../controllers/pedidosController');

const router = express.Router();

// Ruta para obtener todos los pedidos del usuario autenticado
router.get('/', getPedidosPorUsuario);

// Ruta para crear un nuevo pedido
router.post('/crear', crearPedido);

// Ruta para obtener los detalles de un pedido específico
//router.get('/:pedidoId', getDetallePedido);

module.exports = router;
