const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');

// Ruta para guardar los datos de pago
router.post('/api/payment', paymentController.savePaymentData);

// Ruta para obtener los datos de pago de un usuario
router.get('/api/payment/:userId', paymentController.getPaymentData);

module.exports = router;
