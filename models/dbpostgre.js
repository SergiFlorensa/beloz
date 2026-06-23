const { Pool } = require('pg');

const shouldUseSsl =
  process.env.PGSSLMODE === 'require' ||
  process.env.DB_SSL === 'true' ||
  process.env.NODE_ENV === 'production' ||
  /render\.com|render\.internal|amazonaws\.com/i.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
});

module.exports = pool;
