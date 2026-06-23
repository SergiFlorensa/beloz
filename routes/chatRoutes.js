const express = require('express');
const { responderChat } = require('../controllers/chatController');

const router = express.Router();

router.post('/', responderChat);

module.exports = router;
