const { Pool } = require('pg');

const { databaseConfig } = require('../security/database');
const pool = new Pool(databaseConfig());
pool.on('error', () => console.error('Idle database connection failed.'));

module.exports = pool;
