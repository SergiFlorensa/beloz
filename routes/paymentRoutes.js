const express = require('express');
const { savePaymentData, getPaymentData } = require('../controllers/PaymentController');
const router = express.Router();

router.post('/save', savePaymentData);

router.get('/:userId', getPaymentData);

module.exports = router;
