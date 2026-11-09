function databaseConfig(env = process.env) {
  let url;
  try { url = env.DATABASE_URL ? new URL(env.DATABASE_URL) : undefined; } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (url && !['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL.');
  const host = (url?.hostname || env.PGHOST || 'localhost').toLowerCase();
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
  const renderInternal = env.RENDER === 'true' && /^dpg-[a-z0-9-]+$/.test(host);
  const mode = env.PGSSLMODE || url?.searchParams.get('sslmode');
  const disabled = env.DB_SSL === 'false' || mode === 'disable';
  const required = env.DB_SSL === 'true' || (mode && mode !== 'disable');
  if (disabled && !local && !renderInternal) throw new Error('External database connections require verified TLS.');
  if (mode === 'no-verify' && !renderInternal) throw new Error('Unverified database TLS is not allowed.');
  const tls = !disabled && (required || !local);
  // pg URL SSL parameters override the ssl object, so normalize them here.
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url?.searchParams.delete(key);
  const timeout = Number(env.DB_CONNECTION_TIMEOUT_MS || 10000);
  return {
    connectionString: url?.toString(),
    ssl: tls ? {
      rejectUnauthorized: !renderInternal || Boolean(env.DB_SSL_CA),
      ...(env.DB_SSL_CA ? { ca: env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}),
    } : false,
    connectionTimeoutMillis: Number.isInteger(timeout) && timeout >= 100 && timeout <= 30000 ? timeout : 10000,
    statement_timeout: 15000,
    max: 10,
  };
}

module.exports = { databaseConfig };
