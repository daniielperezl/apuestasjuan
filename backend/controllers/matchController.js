const { query } = require('../config/database');
const { getCache, setCache } = require('../config/redis');
const { getTodayRange, paginate } = require('../utils/helpers');
const { analyzeMatch, getAnalysis } = require('../services/iaAnalysisService');
const { logger } = require('../middleware/logger');

const getTodayMatches = async (req, res) => {
  try {
    const { deporte, liga, estado, page = 1, limit = 50 } = req.query;
    const { offset, limit: lim } = paginate(page, limit);
    const { start, end } = getTodayRange();

    let whereClause = 'WHERE e.fecha_hora BETWEEN $1 AND $2';
    const params = [start, end];
    let paramIdx = 3;

    if (deporte) { whereClause += ` AND e.deporte = $${paramIdx++}`; params.push(deporte); }
    if (liga) { whereClause += ` AND e.liga ILIKE $${paramIdx++}`; params.push(`%${liga}%`); }
    if (estado) { whereClause += ` AND e.estado = $${paramIdx++}`; params.push(estado.toUpperCase()); }

    const countResult = await query(
      `SELECT COUNT(*) FROM encuentros e ${whereClause}`,
      params
    );

    const result = await query(
      `SELECT e.*,
        el.nombre as local_nombre, el.logo_url as local_logo, el.nombre_corto as local_corto,
        ev.nombre as visitante_nombre, ev.logo_url as visitante_logo, ev.nombre_corto as visitante_corto,
        a.confianza_porcentaje, a.probabilidades, a.goles_esperados,
        a.apuestas_sugeridas
       FROM encuentros e
       JOIN equipos el ON e.equipo_local_id = el.id
       JOIN equipos ev ON e.equipo_visitante_id = ev.id
       LEFT JOIN analisis_ia a ON e.id = a.encuentro_id
       ${whereClause}
       ORDER BY e.fecha_hora ASC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, lim, offset]
    );

    res.json({
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: lim,
      matches: result.rows
    });
  } catch (err) {
    logger.error('getTodayMatches error:', err.message);
    res.status(500).json({ error: 'Error al obtener partidos' });
  }
};

const getMatchById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT e.*,
        el.nombre as local_nombre, el.logo_url as local_logo, el.datos_json as local_datos,
        ev.nombre as visitante_nombre, ev.logo_url as visitante_logo, ev.datos_json as visitante_datos
       FROM encuentros e
       JOIN equipos el ON e.equipo_local_id = el.id
       JOIN equipos ev ON e.equipo_visitante_id = ev.id
       WHERE e.id = $1`,
      [id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Encuentro no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener encuentro' });
  }
};

const getMatchAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const { refresh } = req.query;

    // Check if analysis exists and is recent
    const existing = await getAnalysis(id);
    if (existing && !refresh) {
      const age = (Date.now() - new Date(existing.created_at).getTime()) / 1000 / 60;
      if (age < 60) return res.json(existing);
    }

    // Generate new analysis
    const analysis = await analyzeMatch(id);
    res.json(analysis);
  } catch (err) {
    logger.error('getMatchAnalysis error:', err.message);
    res.status(500).json({ error: err.message || 'Error al generar análisis' });
  }
};

const getSuggestedBets = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getAnalysis(id);

    if (!existing) {
      const analysis = await analyzeMatch(id);
      return res.json({
        encuentro_id: id,
        apuestas: analysis.apuestas_recomendadas || []
      });
    }

    res.json({
      encuentro_id: id,
      confianza: existing.confianza_porcentaje,
      apuestas: existing.apuestas_sugeridas || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener apuestas sugeridas' });
  }
};

const getUpcomingMatches = async (req, res) => {
  try {
    const { days = 3, deporte, limit = 20 } = req.query;
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + parseInt(days));

    let sql = `SELECT e.*,
      el.nombre as local_nombre, el.logo_url as local_logo,
      ev.nombre as visitante_nombre, ev.logo_url as visitante_logo,
      a.confianza_porcentaje, a.probabilidades
     FROM encuentros e
     JOIN equipos el ON e.equipo_local_id = el.id
     JOIN equipos ev ON e.equipo_visitante_id = ev.id
     LEFT JOIN analisis_ia a ON e.id = a.encuentro_id
     WHERE e.fecha_hora BETWEEN $1 AND $2 AND e.estado IN ('SCHEDULED','LIVE')`;

    const params = [now, future];
    if (deporte) { sql += ' AND e.deporte = $3'; params.push(deporte); }
    sql += ` ORDER BY e.fecha_hora ASC LIMIT ${Math.min(100, parseInt(limit))}`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener próximos partidos' });
  }
};

const getLiveMatches = async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*,
        el.nombre as local_nombre, el.logo_url as local_logo,
        ev.nombre as visitante_nombre, ev.logo_url as visitante_logo
       FROM encuentros e
       JOIN equipos el ON e.equipo_local_id = el.id
       JOIN equipos ev ON e.equipo_visitante_id = ev.id
       WHERE e.estado = 'LIVE'
       ORDER BY e.fecha_hora ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener partidos en vivo' });
  }
};

const getH2H = async (req, res) => {
  try {
    const { team1, team2 } = req.query;
    if (!team1 || !team2) return res.status(400).json({ error: 'team1 y team2 requeridos' });

    const result = await query(
      `SELECT h.*,
        el.nombre as local_nombre,
        ev.nombre as visitante_nombre
       FROM historial_directo h
       JOIN equipos el ON h.equipo_local_id = el.id
       JOIN equipos ev ON h.equipo_visitante_id = ev.id
       WHERE (h.equipo_local_id = $1 AND h.equipo_visitante_id = $2)
          OR (h.equipo_local_id = $2 AND h.equipo_visitante_id = $1)
       ORDER BY h.fecha DESC LIMIT 10`,
      [team1, team2]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historial directo' });
  }
};

module.exports = {
  getTodayMatches, getMatchById, getMatchAnalysis,
  getSuggestedBets, getUpcomingMatches, getLiveMatches, getH2H
};
