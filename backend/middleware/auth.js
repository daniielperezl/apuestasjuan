const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { getCache, setCache } = require('../config/redis');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = authHeader.split(' ')[1];

    // Check token blacklist in Redis
    const blacklisted = await getCache(`blacklist:${token}`);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token invalidado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      'SELECT id, email, nombre, rol, estado, two_factor_enabled FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const user = result.rows[0];
    if (user.estado !== 'ACTIVO') {
      return res.status(403).json({ error: `Cuenta ${user.estado.toLowerCase()}` });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query('SELECT id, email, nombre, rol, estado FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length && result.rows[0].estado === 'ACTIVO') {
      req.user = result.rows[0];
    }
  } catch (err) { /* ignore */ }
  next();
};

module.exports = { authenticate, authorize, optionalAuth };
