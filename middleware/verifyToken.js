// middleware/verifyToken.js
const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Verificar si el encabezado de autorización existe y comienza con "Bearer "
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No se proporcionó un token válido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verificar y decodificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Adjuntar la información decodificada al objeto req
    next(); // Continuar con la siguiente función middleware o controlador
  } catch (err) {
    console.error('Error al verificar el token:', err.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
