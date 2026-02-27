const rateLimit = require('express-rate-limit');
const { getRedisClient } = require('../config/redis');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de login. Intenta en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip + ':login'
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Límite de requests excedido. Máximo 100/minuto.' },
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Límite de requests excedido para esta operación.' }
});

module.exports = { loginLimiter, apiLimiter, strictLimiter };
