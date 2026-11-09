const express = require('express');
const { savePaymentData, getPaymentData } = require('../controllers/PaymentController');
const router = express.Router();
router.use(require('../middleware/authenticateToken'));

router.post('/save', savePaymentData);

router.get('/:userId', getPaymentData);

router.put('/:userId', savePaymentData);

module.exports = router;
