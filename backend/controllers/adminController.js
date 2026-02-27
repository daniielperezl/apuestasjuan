const { query } = require('../config/database');
const { hashPassword } = require('../utils/helpers');
const { auditLog } = require('../middleware/logger');
const { syncMatches } = require('../services/matchSyncService');
const { paginate } = require('../utils/helpers');

const getUsers = async (req, res) => {
  try {
    const { estado, rol, page = 1, limit = 20, search } = req.query;
    const { offset, limit: lim } = paginate(page, limit);

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (estado) { where += ` AND estado = $${idx++}`; params.push(estado); }
    if (rol) { where += ` AND rol = $${idx++}`; params.push(rol); }
    if (search) { where += ` AND (email ILIKE $${idx} OR nombre ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    const countResult = await query(`SELECT COUNT(*) FROM users ${where}`, params);
    const result = await query(
      `SELECT id, email, nombre, rol, estado, moneda, balance, two_factor_enabled,
        created_at, ultimo_acceso, verificado_email
       FROM users ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...params, lim, offset]
    );

    res.json({
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page), limit: lim,
      users: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

const getUserById = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, nombre, rol, estado, moneda, balance, two_factor_enabled,
        preferencias_notificaciones, created_at, ultimo_acceso, ip_address
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
};

const createUser = async (req, res) => {
  try {
    const { email, password, nombre, rol = 'USUARIO', estado = 'ACTIVO' } = req.body;
    if (!email || !password || !nombre) return res.status(400).json({ error: 'email, password y nombre requeridos' });

    const passwordHash = await hashPassword(password);
    const result = await query(
      "INSERT INTO users (email, password_hash, nombre, rol, estado) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, nombre, rol",
      [email.toLowerCase(), passwordHash, nombre, rol, estado]
    );

    await auditLog(req.user.id, 'ADMIN_CREATE_USER', 'users', result.rows[0].id, null, result.rows[0], req);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rol, estado, balance, moneda } = req.body;

    const before = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!before.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    const result = await query(
      `UPDATE users SET
        nombre = COALESCE($1, nombre),
        rol = COALESCE($2, rol),
        estado = COALESCE($3, estado),
        balance = COALESCE($4, balance),
        moneda = COALESCE($5, moneda),
        updated_at = NOW()
       WHERE id = $6 RETURNING id, email, nombre, rol, estado, balance`,
      [nombre, rol, estado, balance, moneda, id]
    );

    await auditLog(req.user.id, 'ADMIN_UPDATE_USER', 'users', id, before.rows[0], result.rows[0], req);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });

    const user = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!user.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    await query("UPDATE users SET estado = 'INACTIVO', updated_at = NOW() WHERE id = $1", [id]);
    await auditLog(req.user.id, 'ADMIN_DELETE_USER', 'users', id, user.rows[0], { estado: 'INACTIVO' }, req);
    res.json({ message: 'Usuario desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

const getReports = async (req, res) => {
  try {
    const [usersStats, betsStats, matchesStats] = await Promise.all([
      query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'ACTIVO') as activos,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as nuevos_mes
       FROM users`),
      query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'GANADA') as ganadas,
        COUNT(*) FILTER (WHERE estado = 'PERDIDA') as perdidas,
        COUNT(*) FILTER (WHERE estado = 'ACTIVA') as activas,
        COALESCE(SUM(cantidad_apostada), 0) as volumen_total,
        COALESCE(SUM(ganancia_perdida) FILTER (WHERE estado = 'GANADA'), 0) as pagos_totales
       FROM apuestas`),
      query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'FINISHED') as finalizados,
        COUNT(*) FILTER (WHERE estado = 'LIVE') as en_vivo,
        COUNT(*) FILTER (WHERE fecha_hora >= NOW() AND estado = 'SCHEDULED') as proximos
       FROM encuentros`)
    ]);

    res.json({
      usuarios: usersStats.rows[0],
      apuestas: betsStats.rows[0],
      encuentros: matchesStats.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar reporte' });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, accion, usuario_id } = req.query;
    const { offset, limit: lim } = paginate(page, limit);

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (accion) { where += ` AND al.accion ILIKE $${idx++}`; params.push(`%${accion}%`); }
    if (usuario_id) { where += ` AND al.usuario_id = $${idx++}`; params.push(usuario_id); }

    const result = await query(
      `SELECT al.*, u.email as usuario_email, u.nombre as usuario_nombre
       FROM audit_log al
       LEFT JOIN users u ON al.usuario_id = u.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, lim, offset]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener logs' });
  }
};

const syncMatchesManually = async (req, res) => {
  try {
    const { sport = 'football' } = req.body;
    const count = await syncMatches(sport);
    res.json({ message: `Sincronizados ${count} partidos de ${sport}` });
  } catch (err) {
    res.status(500).json({ error: 'Error al sincronizar partidos' });
  }
};

module.exports = {
  getUsers, getUserById, createUser, updateUser, deleteUser,
  getReports, getAuditLogs, syncMatchesManually
};
