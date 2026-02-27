const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { setCache, deleteSession } = require('../config/redis');
const { hashPassword, comparePassword } = require('../utils/helpers');
const { auditLog } = require('../middleware/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '15m';
const REFRESH_EXPIRES_DAYS = 7;

const generateTokens = (userId, rol) => {
  const accessToken = jwt.sign(
    { userId, rol, iat: Date.now() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
  const refreshToken = uuidv4() + '-' + uuidv4();
  return { accessToken, refreshToken };
};

const register = async (email, password, nombre, req) => {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) throw new Error('El email ya está registrado');

  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users (email, password_hash, nombre, rol, estado)
     VALUES ($1, $2, $3, 'USUARIO', 'ACTIVO') RETURNING id, email, nombre, rol`,
    [email.toLowerCase().trim(), passwordHash, nombre]
  );

  const user = result.rows[0];
  await auditLog(user.id, 'REGISTER', 'users', user.id, null, { email: user.email }, req);
  return user;
};

const login = async (email, password, req) => {
  const result = await query(
    'SELECT id, email, nombre, rol, estado, password_hash, two_factor_enabled, login_attempts, locked_until FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  if (!result.rows.length) {
    throw new Error('Credenciales inválidas');
  }

  const user = result.rows[0];

  // Check account lock
  if (user.locked_until && new Date() < new Date(user.locked_until)) {
    const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new Error(`Cuenta bloqueada. Intenta en ${remaining} minutos`);
  }

  if (user.estado === 'SUSPENDIDO') throw new Error('Cuenta suspendida');
  if (user.estado === 'INACTIVO') throw new Error('Cuenta inactiva');

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    const attempts = (user.login_attempts || 0) + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await query(
      'UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3',
      [attempts, lockUntil, user.id]
    );
    await auditLog(user.id, 'LOGIN_FAILED', 'users', user.id, null, { attempts }, req, 'FAIL');
    throw new Error('Credenciales inválidas');
  }

  // Reset login attempts
  await query(
    'UPDATE users SET login_attempts = 0, locked_until = NULL, ultimo_acceso = NOW(), ip_address = $1 WHERE id = $2',
    [req?.ip, user.id]
  );

  if (user.two_factor_enabled) {
    return { requiresTwoFactor: true, userId: user.id };
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.rol);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);
  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, expiresAt]
  );

  await auditLog(user.id, 'LOGIN_SUCCESS', 'users', user.id, null, null, req);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol }
  };
};

const refreshAccessToken = async (refreshToken) => {
  const result = await query(
    `SELECT rt.user_id, rt.expires_at, rt.revoked, u.rol, u.estado
     FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id
     WHERE rt.token = $1`,
    [refreshToken]
  );

  if (!result.rows.length) throw new Error('Refresh token inválido');

  const { user_id, expires_at, revoked, rol, estado } = result.rows[0];
  if (revoked) throw new Error('Refresh token revocado');
  if (new Date() > new Date(expires_at)) throw new Error('Refresh token expirado');
  if (estado !== 'ACTIVO') throw new Error('Cuenta no activa');

  const { accessToken, refreshToken: newRefresh } = generateTokens(user_id, rol);

  await query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [refreshToken]);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);
  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user_id, newRefresh, expiresAt]
  );

  return { accessToken, refreshToken: newRefresh };
};

const logout = async (userId, token, refreshToken) => {
  if (token) {
    await setCache(`blacklist:${token}`, true, 900);
  }
  if (refreshToken) {
    await query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [refreshToken]);
  }
};

const setup2FA = async (userId) => {
  const secret = speakeasy.generateSecret({ name: 'SportBets AI', length: 32 });
  await query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [secret.base32, userId]);
  const qrCode = await qrcode.toDataURL(secret.otpauth_url);
  return { secret: secret.base32, qrCode };
};

const verify2FA = async (userId, token) => {
  const result = await query('SELECT two_factor_secret FROM users WHERE id = $1', [userId]);
  if (!result.rows.length || !result.rows[0].two_factor_secret) throw new Error('2FA no configurado');

  const valid = speakeasy.totp.verify({
    secret: result.rows[0].two_factor_secret,
    encoding: 'base32',
    token,
    window: 2
  });

  if (!valid) throw new Error('Código 2FA inválido');
  return true;
};

module.exports = { register, login, refreshAccessToken, logout, setup2FA, verify2FA, generateTokens };
