// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Asume que el token se envía en el encabezado Authorization como "Bearer TOKEN"
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, decoded) => {
    if (err) {
      console.error('Token verification error:', err.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = decoded; // Puedes acceder al usuario en los controladores mediante `req.user`
    next();
  });
};
