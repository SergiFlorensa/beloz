// routes/pedidosRoutes.js
const express = require('express');
const { crearPedido, getPedidosPorUsuario, getDetallePedido } = require('../controllers/pedidosController');
const { ensureAuthenticated } = require('../middleware/authMiddleware'); // Importar el middleware
const router = express.Router();

// Aplicar el middleware a todas las rutas de pedidos
router.use(ensureAuthenticated);

// Ruta para crear un nuevo pedido
router.post('/', crearPedido);

// Ruta para obtener todos los pedidos de un usuario
router.get('/', getPedidosPorUsuario);

// Ruta para obtener los detalles de un pedido específico
router.get('/:pedidoId', getDetallePedido);

module.exports = router;
