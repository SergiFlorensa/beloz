const express = require('express');
const {
  registerUser,
  loginUser,
  logoutUser,
  updateEmail,
  updatePassword,
  updatePhoneNumber,
  deleteUser,
} = require('../controllers/authController');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();
const { createLimiter } = require('../middleware/security');
router.use(createLimiter(20, 15 * 60 * 1000));

router.post('/register', registerUser);

router.post('/login', loginUser);

router.post('/logout', authenticateToken, logoutUser);

router.post('/update_email', authenticateToken, updateEmail);

router.post('/update_password', authenticateToken, updatePassword);

router.post('/update_phone', authenticateToken, updatePhoneNumber);

router.post('/delete_account', authenticateToken, deleteUser);


module.exports = router;
