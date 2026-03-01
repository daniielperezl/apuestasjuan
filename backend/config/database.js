// Use MySQL adapter on cPanel / shared hosting
if (process.env.DB_TYPE === 'mysql') {
  module.exports = require('./database-mysql');
  return; // Node wraps modules in a function, so this is valid
}

const { Pool } = require('pg');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'sportbets_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'sportbets_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => logger.info('Database connected'));
pool.on('error', (err) => logger.error('Database error:', err));

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow query detected', { text: text.substring(0, 100), duration });
    }
    return res;
  } catch (err) {
    logger.error('Database query error:', { text: text.substring(0, 100), error: err.message });
    throw err;
  }
};

const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
