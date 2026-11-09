const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../security/config');
const { positiveId } = require('../security/input');

function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  const match = typeof header === 'string' && /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header);
  if (!match || header.length > 4096) return res.status(401).json({ error: 'Debes iniciar sesion.' });
  try {
    const user = jwt.verify(match[1], getJwtSecret(), {
      algorithms: ['HS256'], issuer: 'beloz-api', audience: 'beloz-app',
    });
    const id = positiveId(user.id_user);
    if (!Number.isFinite(user.exp)) throw new Error('Missing expiry');
    req.user = { id_user: id, user_id: id, id };
    next();
  } catch {
    return res.status(401).json({ error: 'Sesion no valida o caducada.' });
  }
}

module.exports = authenticateToken;
