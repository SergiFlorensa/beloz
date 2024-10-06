const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(403).json({ error: 'No se proporcionó un token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Guardar la info del usuario en req.user
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token no válido' });
  }
};

module.exports = verifyToken;
