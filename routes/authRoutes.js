const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController'); // Importamos los controladores

const router = express.Router();

// Ruta para registrar usuarios
router.post('/register', registerUser);

// Ruta para login de usuarios
router.post('/login', loginUser);

module.exports = router;
