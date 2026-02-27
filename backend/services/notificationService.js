const nodemailer = require('nodemailer');
const { query } = require('../config/database');
const { logger } = require('../middleware/logger');

let io = null;

const setSocketIO = (socketIO) => { io = socketIO; };

const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
};

const sendEmail = async (to, subject, html) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    logger.warn('Email not configured, skipping send');
    return false;
  }
  try {
    const transporter = createTransporter();
    await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
    return true;
  } catch (err) {
    logger.error('Email send failed:', err.message);
    return false;
  }
};

const createNotification = async (userId, tipo, titulo, mensaje, datos = {}) => {
  try {
    const result = await query(
      'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, tipo, titulo, mensaje, JSON.stringify(datos)]
    );

    const notification = result.rows[0];

    // Send via WebSocket if connected
    if (io) {
      io.to(`user:${userId}`).emit('notification', {
        id: notification.id,
        tipo, titulo, mensaje, datos,
        timestamp: notification.created_at
      });
    }

    // Send email for important notifications
    if (['BET_RESULT', 'MATCH_START'].includes(tipo)) {
      const user = await query('SELECT email, preferencias_notificaciones FROM users WHERE id = $1', [userId]);
      if (user.rows.length && user.rows[0].preferencias_notificaciones?.email) {
        await sendEmail(user.rows[0].email, titulo, `<p>${mensaje}</p>`);
      }
    }

    return notification;
  } catch (err) {
    logger.error('Failed to create notification:', err.message);
  }
};

const notifyBetResult = async (apuestaId) => {
  const result = await query(
    `SELECT a.*, u.id as uid, e.equipo_local_id, e.equipo_visitante_id,
      el.nombre as local, ev.nombre as visitante
     FROM apuestas a
     JOIN users u ON a.usuario_id = u.id
     JOIN encuentros e ON a.encuentro_id = e.id
     JOIN equipos el ON e.equipo_local_id = el.id
     JOIN equipos ev ON e.equipo_visitante_id = ev.id
     WHERE a.id = $1`,
    [apuestaId]
  );

  if (!result.rows.length) return;
  const apuesta = result.rows[0];

  const isWon = apuesta.estado === 'GANADA';
  const titulo = isWon ? '🎉 ¡Apuesta Ganada!' : '❌ Apuesta Perdida';
  const mensaje = `Tu apuesta en ${apuesta.local} vs ${apuesta.visitante} ha ${isWon ? 'ganado' : 'perdido'}. ${isWon ? `Ganancia: ${apuesta.ganancia_perdida}` : ''}`;

  await createNotification(apuesta.uid, 'BET_RESULT', titulo, mensaje, { apuestaId, resultado: apuesta.estado });
};

const notifyMatchStart = async (encuentroId) => {
  const betsResult = await query(
    'SELECT DISTINCT usuario_id FROM apuestas WHERE encuentro_id = $1 AND estado = \'ACTIVA\'',
    [encuentroId]
  );

  const matchResult = await query(
    `SELECT e.*, el.nombre as local, ev.nombre as visitante
     FROM encuentros e
     JOIN equipos el ON e.equipo_local_id = el.id
     JOIN equipos ev ON e.equipo_visitante_id = ev.id
     WHERE e.id = $1`,
    [encuentroId]
  );

  if (!matchResult.rows.length) return;
  const match = matchResult.rows[0];

  for (const bet of betsResult.rows) {
    await createNotification(
      bet.usuario_id,
      'MATCH_START',
      '⚽ ¡Partido iniciado!',
      `${match.local} vs ${match.visitante} ha comenzado`,
      { encuentroId }
    );
  }
};

const getUnreadNotifications = async (userId) => {
  const result = await query(
    'SELECT * FROM notificaciones WHERE usuario_id = $1 AND leida = FALSE ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return result.rows;
};

const markAsRead = async (userId, notificationId) => {
  await query(
    'UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND usuario_id = $2',
    [notificationId, userId]
  );
};

module.exports = {
  setSocketIO, createNotification, notifyBetResult, notifyMatchStart,
  getUnreadNotifications, markAsRead, sendEmail
};
