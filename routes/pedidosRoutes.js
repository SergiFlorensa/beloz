// routes/pedidosRoutes.js
const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');
const { verifyToken } = require('../middleware/verifyToken'); // Importa el middleware

// Ruta para obtener todos los pedidos de un usuario
router.get('/', verifyToken, pedidosController.getPedidosPorUsuario);

// Ruta para crear un nuevo pedido
router.post('/crear', verifyToken, pedidosController.crearPedido);

// Ruta para obtener los detalles de un pedido específico
router.get('/:pedidoId', verifyToken, pedidosController.getDetallePedido);

module.exports = router;
