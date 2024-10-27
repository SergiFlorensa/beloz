// authRoutes.js
const express = require('express');
const {
  registerUser,
  loginUser,
  logoutUser,
  updateEmail,
} = require('../controllers/authController');
const authenticateToken = require('../middlewares/authenticateToken');

const router = express.Router();

// Registro de usuario
router.post('/register', registerUser);

// Inicio de sesión
router.post('/login', loginUser);

// Logout de usuario
router.post('/logout', authenticateToken, logoutUser);

// Actualizar correo electrónico
router.post('/update_email', authenticateToken, updateEmail);

module.exports = router;
