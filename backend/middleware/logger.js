const winston = require('winston');
const { query } = require('../config/database');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

const auditLog = async (userId, accion, entidad, entidadId, datoAntes, datosDespues, req, resultado = 'SUCCESS') => {
  try {
    await query(
      `INSERT INTO audit_log (usuario_id, accion, entidad, entidad_id, datos_antes, datos_despues, ip_address, user_agent, resultado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, accion, entidad, entidadId,
        datoAntes ? JSON.stringify(datoAntes) : null,
        datosDespues ? JSON.stringify(datosDespues) : null,
        req?.ip, req?.headers?.['user-agent'], resultado]
    );
  } catch (err) {
    logger.error('Failed to write audit log:', err.message);
  }
};

module.exports = { logger, auditLog };
