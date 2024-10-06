const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const authMiddleware = require('../middleware/authMiddleware');

// Registro de usuario
router.post('/register', usersController.registerUser);

// Inicio de sesión
router.post('/login', usersController.loginUser);

// Actualizar correo electrónico (ruta protegida)
router.put('/update-email', authMiddleware.verifyToken, usersController.updateUserEmail);

// Obtener perfil del usuario (ruta protegida)
router.get('/profile', authMiddleware.verifyToken, usersController.getProfile);

module.exports = router;
