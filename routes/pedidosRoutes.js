// routes/pedidosRoutes.js
const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController'); // Asegúrate de que este archivo exporta funciones válidas

// Verifica que las funciones están definidas antes de usarlas en las rutas
if (pedidosController.getPedidosPorUsuario && pedidosController.crearPedido) {
  // Ruta para obtener todos los pedidos del usuario autenticado
  router.get('/', pedidosController.getPedidosPorUsuario);

  // Ruta para crear un nuevo pedido
  router.post('/crear', pedidosController.crearPedido);

  // Ruta para obtener los detalles de un pedido específico
  router.get('/:pedidoId', pedidosController.getDetallePedido);
} else {
  console.error("Error: Funciones de controlador no definidas en pedidosController");
}

module.exports = router;
