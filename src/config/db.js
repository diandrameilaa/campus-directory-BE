const { Pool } = require('pg');
const logger = require('../utils/logger');

if (!process.env.DATABASE_URL && process.env.DB_PASSWORD === undefined) {
  throw new Error('DB_PASSWORD belum diset. Isi .env atau gunakan DATABASE_URL untuk koneksi PostgreSQL.');
}

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'campus_directory',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD || ''),
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool({
  ...poolConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => logger.error(`PostgreSQL pool error: ${err.message}`));

pool.ready = pool.connect()
  .then((client) => {
    client.release();
    logger.info('PostgreSQL connected');
    return pool;
  })
  .catch((err) => {
    logger.error(`PostgreSQL connection failed: ${err.message}`);
    throw err;
  });

module.exports = pool;
