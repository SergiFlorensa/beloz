/*const express = require('express');
const usersController = require('../controllers/usersController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Actualizar correo electrónico (ruta protegida)
router.put('/update-email', authMiddleware.verifyToken, usersController.updateUserEmail);

// Obtener perfil del usuario (ruta protegida)
router.get('/profile', authMiddleware.verifyToken, usersController.getProfile);

module.exports = router;
*/