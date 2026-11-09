const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

function createLimiter(limit, windowMs = 60000) {
  return rateLimit({
    windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    ipv6Subnet: 56,
    message: { error: 'Demasiadas solicitudes. Intentalo mas tarde.' },
  });
}

function corsOptions(env = process.env) {
  const origins = new Set((env.CORS_ORIGINS || '').split(',').map((entry) => entry.trim()).filter(Boolean));
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new Error('CORS_ORIGINS must contain exact http(s) origins.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('CORS_ORIGINS must contain exact http(s) origins, without paths or wildcards.');
    }
  }
  return {
    origin(origin, callback) {
      if (!origin || origins.has(origin)) return callback(null, true);
      const error = new Error('Origin not allowed');
      error.status = 403;
      callback(error);
    },
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 600,
  };
}

function installSecurity(app, env = process.env) {
  const hops = Number(env.TRUST_PROXY_HOPS ?? (env.RENDER === 'true' ? 1 : 0));
  if (!Number.isInteger(hops) || hops < 0 || hops > 3) throw new Error('TRUST_PROXY_HOPS must be between 0 and 3.');
  app.disable('x-powered-by');
  app.set('trust proxy', hops);
  app.use(helmet({
    strictTransportSecurity: env.NODE_ENV === 'production' ? { maxAge: 31536000 } : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors(corsOptions(env)));
  app.use('/api', createLimiter(120));
  app.use('/api/chat', createLimiter(30));
  app.use(['/api/auth', '/api/payment', '/api/pagos', '/api/pedidos'], (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no valido.' });
  if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') {
    return res.status(415).json({ error: 'Formato no admitido.' });
  }
  if (error.status === 403) return res.status(403).json({ error: 'Origen no permitido.' });
  console.error('Unhandled request failure.');
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { createLimiter, corsOptions, installSecurity, errorHandler };
