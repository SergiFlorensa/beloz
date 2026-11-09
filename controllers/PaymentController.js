const { ownUserId, handler } = require('../security/input');

// No tokenizing provider exists. Never accept, read, log, or echo card data.
const unavailable = handler(async (req, res) => {
  ownUserId(req, req.params.userId, req.body?.userId, req.body?.user_id);
  res.status(410).json({
    error: 'El almacenamiento de tarjetas no esta disponible. No se ha guardado ni cobrado nada.',
    code: 'PAYMENT_STORAGE_DISABLED',
  });
});

exports.savePaymentData = unavailable;
exports.getPaymentData = unavailable;
