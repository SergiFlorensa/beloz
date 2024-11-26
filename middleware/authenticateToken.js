function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  console.log('Authorization Header:', authHeader);

  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.error('Token no proporcionado en el encabezado Authorization');
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Error al verificar el token:', err);
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
    console.log('Usuario decodificado del token:', user);
    req.user = user;
    next();
  });
}
