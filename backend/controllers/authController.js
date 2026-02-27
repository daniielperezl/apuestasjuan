const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const authService = require('../services/authService');
const { setCache } = require('../config/redis');

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 12 }).withMessage('Contraseña mínimo 12 caracteres')
    .matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/).withMessage('Contraseña debe tener mayúsculas, números y símbolos'),
  body('nombre').trim().isLength({ min: 2, max: 100 }).withMessage('Nombre inválido'),
  validate
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
  validate
];

const register = async (req, res) => {
  try {
    const { email, password, nombre } = req.body;
    const user = await authService.register(email, password, nombre, req);
    res.status(201).json({ message: 'Usuario registrado exitosamente', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password, req);

    if (result.requiresTwoFactor) {
      return res.json({ requiresTwoFactor: true, userId: result.userId });
    }

    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

const loginWith2FA = async (req, res) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) return res.status(400).json({ error: 'userId y token requeridos' });

    await authService.verify2FA(userId, token);

    const userResult = require('../config/database').query('SELECT rol FROM users WHERE id = $1', [userId]);
    const rol = (await userResult).rows[0]?.rol || 'USUARIO';

    const { accessToken, refreshToken } = authService.generateTokens(userId, rol);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await require('../config/database').query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, refreshToken, expiresAt]
    );

    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido' });
    const tokens = await authService.refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(req.user.id, req.token, refreshToken);
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
};

const setup2FA = async (req, res) => {
  try {
    const result = await authService.setup2FA(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    await authService.verify2FA(req.user.id, token);
    await require('../config/database').query('UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [req.user.id]);
    res.json({ message: '2FA activado exitosamente' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await require('../config/database').query(
      `SELECT id, email, nombre, rol, estado, moneda, two_factor_enabled,
        preferencias_notificaciones, balance, created_at, ultimo_acceso
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { nombre, moneda, preferencias_notificaciones } = req.body;
    const result = await require('../config/database').query(
      `UPDATE users SET
        nombre = COALESCE($1, nombre),
        moneda = COALESCE($2, moneda),
        preferencias_notificaciones = COALESCE($3, preferencias_notificaciones),
        updated_at = NOW()
       WHERE id = $4 RETURNING id, email, nombre, rol, moneda`,
      [nombre, moneda, preferencias_notificaciones ? JSON.stringify(preferencias_notificaciones) : null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

module.exports = {
  registerValidation, loginValidation,
  register, login, loginWith2FA, refreshToken, logout,
  setup2FA, verify2FA, getProfile, updateProfile
};
