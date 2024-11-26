const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  // Obtener el encabezado de autorización
  const authHeader = req.headers['authorization'];
  
  // Verificar si el token está presente y tiene el formato adecuado (Bearer <token>)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado o formato incorrecto.' });
  }

  // Extraer el token del encabezado Authorization
  const token = authHeader.split(' ')[1];

  // Verificar el token usando jwt.verify
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Si el token es inválido o ha expirado, retornar un error específico
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }

    // Si todo es correcto, agregar los datos del usuario al objeto `req`
    req.user = user;

    // Continuar con la ejecución del siguiente middleware o ruta
    next();
  });
}

module.exports = authenticateToken;
