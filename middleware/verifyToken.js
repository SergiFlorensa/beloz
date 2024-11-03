const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Token no proporcionado o malformado');
        return res.status(401).json({ error: 'Token no proporcionado o malformado' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log('Token verificado con éxito:', req.user);
        next();
    } catch (err) {
        console.error('Error al verificar el token:', err.message);
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};
