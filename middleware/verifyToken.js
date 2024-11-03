exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No se proporcionó un token válido' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log('Token verificado, usuario decodificado:', req.user); // Log adicional
        next();
    } catch (err) {
        console.error('Error al verificar el token:', err.message);
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};
