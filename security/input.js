class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function positiveId(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^[1-9]\d*$/.test(String(value))) {
    throw new HttpError(400, 'Identificador no valido.');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 2147483647) throw new HttpError(400, 'Identificador no valido.');
  return id;
}

function ownUserId(req, ...suppliedIds) {
  if (!req.user) throw new HttpError(401, 'Debes iniciar sesion.');
  const id = positiveId(req.user.id_user);
  for (const supplied of suppliedIds) {
    if (supplied !== undefined && positiveId(supplied) !== id) {
      throw new HttpError(403, 'No tienes acceso a este recurso.');
    }
  }
  return id;
}

function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Datos no validos.');
  return body;
}

function textField(value, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x1f\x7f]/.test(value)) {
    throw new HttpError(400, 'Campo de texto no valido.');
  }
  return value.trim();
}

function emailField(value) {
  const email = textField(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Correo no valido.');
  return email;
}

function passwordField(value, minimum = 8) {
  if (typeof value !== 'string' || value.length < minimum || Buffer.byteLength(value, 'utf8') > 72 || value.includes('\0')) {
    throw new HttpError(400, 'La contrasena debe tener al menos 8 caracteres y un maximo de 72 bytes.');
  }
  return value;
}

function phoneField(value) {
  if (typeof value !== 'string' || !/^\d{9}$/.test(value)) throw new HttpError(400, 'El telefono debe tener 9 digitos.');
  return value;
}

function handler(action) {
  return async (req, res) => {
    try {
      await action(req, res);
    } catch (error) {
      if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
      if (error.code === '23505') return res.status(409).json({ error: 'Los datos ya estan registrados.' });
      console.error('Backend operation failed.');
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  };
}

module.exports = { HttpError, positiveId, ownUserId, bodyObject, textField, emailField, passwordField, phoneField, handler };
