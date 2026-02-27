const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { auditLog } = require('../middleware/logger');
const { notifyBetResult } = require('../services/notificationService');
const { paginate } = require('../utils/helpers');

const createBetValidation = [
  body('encuentro_id').notEmpty().withMessage('encuentro_id requerido'),
  body('tipo_apuesta').notEmpty().withMessage('tipo_apuesta requerido'),
  body('descripcion').notEmpty().withMessage('descripcion requerida'),
  body('seleccion').notEmpty().withMessage('seleccion requerida'),
  body('cantidad_apostada').isFloat({ min: 0.01 }).withMessage('Cantidad inválida'),
  body('cuota_bloqueada').isFloat({ min: 1.01 }).withMessage('Cuota inválida'),
  validate
];

const createBet = async (req, res) => {
  try {
    const { encuentro_id, tipo_apuesta, descripcion, seleccion, cantidad_apostada, cuota_bloqueada, notas } = req.body;
    const userId = req.user.id;

    // Validate encounter exists and is upcoming/live
    const encounterResult = await query(
      "SELECT id, estado FROM encuentros WHERE id = $1 AND estado IN ('SCHEDULED','LIVE')",
      [encuentro_id]
    );
    if (!encounterResult.rows.length) {
      return res.status(400).json({ error: 'Encuentro no disponible para apuestas' });
    }

    // Check user balance
    const userResult = await query('SELECT balance, moneda FROM users WHERE id = $1', [userId]);
    if (!userResult.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const { balance } = userResult.rows[0];

    if (parseFloat(balance) < parseFloat(cantidad_apostada)) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    const ganancia_potencial = parseFloat(cantidad_apostada) * parseFloat(cuota_bloqueada);

    // Create bet
    const betResult = await query(
      `INSERT INTO apuestas (usuario_id, encuentro_id, tipo_apuesta, descripcion, seleccion,
         cantidad_apostada, cuota_bloqueada, ganancia_potencial, estado, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVA', $9)
       RETURNING *`,
      [userId, encuentro_id, tipo_apuesta, descripcion, seleccion,
        cantidad_apostada, cuota_bloqueada, ganancia_potencial, notas]
    );

    // Deduct from balance
    await query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [cantidad_apostada, userId]
    );

    const bet = betResult.rows[0];
    await auditLog(userId, 'BET_CREATED', 'apuestas', bet.id, null, bet, req);

    res.status(201).json(bet);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear apuesta: ' + err.message });
  }
};

const getUserBets = async (req, res) => {
  try {
    const { estado, page = 1, limit = 20 } = req.query;
    const { offset, limit: lim } = paginate(page, limit);
    const userId = req.user.id;

    let whereClause = 'WHERE a.usuario_id = $1';
    const params = [userId];
    let paramIdx = 2;

    if (estado) { whereClause += ` AND a.estado = $${paramIdx++}`; params.push(estado.toUpperCase()); }

    const countResult = await query(`SELECT COUNT(*) FROM apuestas a ${whereClause}`, params);
    const result = await query(
      `SELECT a.*,
        e.fecha_hora, e.liga, e.deporte,
        el.nombre as local_nombre, ev.nombre as visitante_nombre
       FROM apuestas a
       JOIN encuentros e ON a.encuentro_id = e.id
       JOIN equipos el ON e.equipo_local_id = el.id
       JOIN equipos ev ON e.equipo_visitante_id = ev.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, lim, offset]
    );

    res.json({
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: lim,
      bets: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener apuestas' });
  }
};

const getBetById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT a.*,
        e.fecha_hora, e.liga, e.deporte, e.estadio,
        el.nombre as local_nombre, el.logo_url as local_logo,
        ev.nombre as visitante_nombre, ev.logo_url as visitante_logo
       FROM apuestas a
       JOIN encuentros e ON a.encuentro_id = e.id
       JOIN equipos el ON e.equipo_local_id = el.id
       JOIN equipos ev ON e.equipo_visitante_id = ev.id
       WHERE a.id = $1 AND (a.usuario_id = $2 OR $3 = ANY(ARRAY['ADMIN','SUPERADMIN']))`,
      [id, userId, req.user.rol]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Apuesta no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener apuesta' });
  }
};

const cancelBet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const bet = await query(
      "SELECT * FROM apuestas WHERE id = $1 AND usuario_id = $2 AND estado = 'ACTIVA'",
      [id, userId]
    );

    if (!bet.rows.length) return res.status(404).json({ error: 'Apuesta activa no encontrada' });

    const apuesta = bet.rows[0];
    await query("UPDATE apuestas SET estado = 'CANCELADA', updated_at = NOW() WHERE id = $1", [id]);

    // Refund amount
    await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [apuesta.cantidad_apostada, userId]);

    await auditLog(userId, 'BET_CANCELLED', 'apuestas', id, apuesta, { estado: 'CANCELADA' }, req);
    res.json({ message: 'Apuesta cancelada y monto reintegrado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar apuesta' });
  }
};

const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE estado = 'GANADA') as ganadas,
        COUNT(*) FILTER (WHERE estado = 'PERDIDA') as perdidas,
        COUNT(*) FILTER (WHERE estado = 'ACTIVA') as activas,
        COUNT(*) FILTER (WHERE estado = 'CANCELADA') as canceladas,
        COUNT(*) as total,
        COALESCE(SUM(cantidad_apostada) FILTER (WHERE estado != 'CANCELADA'), 0) as total_apostado,
        COALESCE(SUM(ganancia_perdida) FILTER (WHERE estado = 'GANADA'), 0) as total_ganado,
        COALESCE(SUM(ganancia_perdida) FILTER (WHERE estado = 'PERDIDA'), 0) as total_perdido,
        ROUND(
          CASE WHEN COUNT(*) FILTER (WHERE estado IN ('GANADA','PERDIDA')) > 0
          THEN COUNT(*) FILTER (WHERE estado = 'GANADA')::decimal /
               COUNT(*) FILTER (WHERE estado IN ('GANADA','PERDIDA')) * 100
          ELSE 0 END, 2
        ) as ratio_acierto
       FROM apuestas WHERE usuario_id = $1`,
      [userId]
    );

    const balanceResult = await query('SELECT balance, moneda FROM users WHERE id = $1', [userId]);

    const stats = result.rows[0];
    const totalApostado = parseFloat(stats.total_apostado) || 0;
    const totalGanado = parseFloat(stats.total_ganado) || 0;
    const totalPerdido = Math.abs(parseFloat(stats.total_perdido) || 0);
    const roi = totalApostado > 0 ? ((totalGanado - totalPerdido) / totalApostado * 100).toFixed(2) : 0;

    res.json({
      ...stats,
      roi: parseFloat(roi),
      balance: parseFloat(balanceResult.rows[0]?.balance || 0),
      moneda: balanceResult.rows[0]?.moneda || 'USD'
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

// Admin: resolve bet
const resolveBet = async (req, res) => {
  try {
    const { id } = req.params;
    const { resultado, ganancia_perdida } = req.body;

    if (!['GANADA', 'PERDIDA', 'CANCELADA'].includes(resultado)) {
      return res.status(400).json({ error: 'Resultado inválido' });
    }

    const bet = await query("SELECT * FROM apuestas WHERE id = $1 AND estado = 'ACTIVA'", [id]);
    if (!bet.rows.length) return res.status(404).json({ error: 'Apuesta activa no encontrada' });

    const apuesta = bet.rows[0];
    const gananciaPerdida = resultado === 'GANADA'
      ? apuesta.ganancia_potencial - apuesta.cantidad_apostada
      : resultado === 'CANCELADA' ? 0 : -apuesta.cantidad_apostada;

    await query(
      `UPDATE apuestas SET estado = $1, resultado = $1, ganancia_perdida = $2,
       resultado_timestamp = NOW(), updated_at = NOW() WHERE id = $3`,
      [resultado, ganancia_perdida || gananciaPerdida, id]
    );

    if (resultado === 'GANADA') {
      await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [apuesta.ganancia_potencial, apuesta.usuario_id]);
    } else if (resultado === 'CANCELADA') {
      await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [apuesta.cantidad_apostada, apuesta.usuario_id]);
    }

    await notifyBetResult(id);
    await auditLog(req.user.id, 'BET_RESOLVED', 'apuestas', id, apuesta, { resultado }, req);

    res.json({ message: `Apuesta resuelta como ${resultado}` });
  } catch (err) {
    res.status(500).json({ error: 'Error al resolver apuesta' });
  }
};

module.exports = {
  createBetValidation, createBet, getUserBets, getBetById,
  cancelBet, getUserStats, resolveBet
};
