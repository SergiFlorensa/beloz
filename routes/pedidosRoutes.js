// routes/pedidosRoutes.js
const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController'); // Asegúrate de que este archivo existe y exporta funciones válidas
const { verifyToken } = require('../middleware/verifyToken'); // Importar el middleware correctamente

// Ruta para obtener todos los pedidos del usuario autenticado
router.get('/', verifyToken, pedidosController.getPedidosPorUsuario);

// Ruta para crear un nuevo pedido
router.post('/crear', verifyToken, pedidosController.crearPedido);

// Ruta para obtener los detalles de un pedido específico
router.get('/:pedidoId', verifyToken, pedidosController.getDetallePedido);

module.exports = router;
