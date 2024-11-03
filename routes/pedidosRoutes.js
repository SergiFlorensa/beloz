const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController'); // Asegúrate de que este archivo existe y exporta funciones válidas

// Ruta para obtener pedidos
router.get('/', pedidosController.getPedidos);

// Otra ruta, por ejemplo, para crear un pedido
router.post('/crear', pedidosController.createPedido);

module.exports = router;
