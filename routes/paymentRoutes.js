// paymentRoutes.js
const express = require('express');
const { savePaymentData, getPaymentData } = require('../controllers/PaymentController');
const router = express.Router();

// Ruta para guardar los datos de pago
router.post('/save', savePaymentData);

// Ruta para obtener los datos de pago de un usuario por su ID
router.get('/:userId', getPaymentData);

module.exports = router;
