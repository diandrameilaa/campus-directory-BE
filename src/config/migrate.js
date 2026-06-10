/**
 * Run this once to initialise the database:
 *   node src/config/migrate.js
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL && process.env.DB_PASSWORD === undefined) {
  throw new Error('DB_PASSWORD belum diset. Isi .env atau gunakan DATABASE_URL untuk koneksi PostgreSQL.');
}

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  : {
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: String(process.env.DB_PASSWORD || ''),
      ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

(async () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../sql/schema.sql'),
    'utf8'
  );
  try {
    await pool.query(sql);
    console.log('✅ Migration complete — schema & seed applied');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
})();
