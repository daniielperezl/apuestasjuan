/**
 * Database configuration for MySQL (compatible con cPanel)
 * Cambiar en server.js si usas MySQL en lugar de PostgreSQL
 */

const mysql = require('mysql2/promise');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'sportbets_db',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
});

pool.on('error', (err) => {
  logger.error('MySQL Pool error:', err);
});

logger.info('MySQL connection pool created');

/**
 * Ejecutar query
 * Compatible con la interfaz de postgres
 */
const query = async (sql, params = []) => {
  const start = Date.now();
  try {
    const [rows] = await pool.query(sql, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn('Slow query detected', { sql: sql.substring(0, 100), duration });
    }

    return {
      rows: Array.isArray(rows) ? rows : [rows],
      rowCount: Array.isArray(rows) ? rows.length : (rows ? 1 : 0)
    };
  } catch (err) {
    logger.error('MySQL query error:', { sql: sql.substring(0, 100), error: err.message });
    throw err;
  }
};

const getClient = () => pool.getConnection();

module.exports = { query, getClient, pool };
