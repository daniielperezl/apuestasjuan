const cron = require('node-cron');
const { query } = require('../config/database');
const {
  getAllTodayMatches,
  getAllLiveMatches,
  getMatchDetail,
  getSportFromId,
  getExternalId,
} = require('./sportsApiService');
const { logger } = require('../middleware/logger');

const ALL_SPORTS = ['football', 'basketball', 'tennis', 'american_football', 'baseball', 'hockey'];

// Global io reference — set from server.js after Socket.io init
let _io = null;
const setSocketIO = (io) => { _io = io; };

/**
 * Upsert a team row — MySQL syntax
 */
const upsertTeam = async (team, sport) => {
  await query(
    `INSERT INTO equipos (id, nombre, deporte, logo_url)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), logo_url = VALUES(logo_url)`,
    [team.id, team.nombre, sport, team.logo || '']
  );
};

/**
 * Upsert a match row — MySQL syntax
 */
const upsertMatch = async (match) => {
  await query(
    `INSERT INTO encuentros
       (id, deporte, equipo_local_id, equipo_visitante_id, fecha_hora,
        estado, goles_local, goles_visitante, estadio, liga, api_external_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       estado           = VALUES(estado),
       goles_local      = VALUES(goles_local),
       goles_visitante  = VALUES(goles_visitante),
       updated_at       = NOW()`,
    [
      match.id, match.deporte,
      match.equipo_local.id, match.equipo_visitante.id,
      match.fecha_hora, match.estado,
      match.goles_local, match.goles_visitante,
      match.estadio, match.liga, match.api_external_id,
    ]
  );
};

/**
 * Persist a normalised match (teams + match row).
 * Returns true if the match was new or its score/status changed.
 */
const persistMatch = async (match) => {
  // Fetch current DB state to detect changes
  const existing = await query(
    'SELECT estado, goles_local, goles_visitante FROM encuentros WHERE id = ? LIMIT 1',
    [match.id]
  );

  await upsertTeam(match.equipo_local, match.deporte);
  await upsertTeam(match.equipo_visitante, match.deporte);
  await upsertMatch(match);

  if (!existing.rows.length) return { changed: true, isNew: true };

  const prev = existing.rows[0];
  const changed =
    prev.estado !== match.estado ||
    prev.goles_local !== match.goles_local ||
    prev.goles_visitante !== match.goles_visitante;

  return { changed, isNew: false };
};

/**
 * Emit a WebSocket event when a match score/status changes.
 */
const emitMatchUpdate = (match) => {
  if (!_io) return;
  _io.emit('match_updated', {
    id: match.id,
    deporte: match.deporte,
    estado: match.estado,
    goles_local: match.goles_local,
    goles_visitante: match.goles_visitante,
    equipo_local: match.equipo_local,
    equipo_visitante: match.equipo_visitante,
  });
};

/**
 * Sync today's matches for all sports.
 */
const syncAllMatches = async () => {
  try {
    logger.info('Starting full match sync for all sports…');
    const matches = await getAllTodayMatches(ALL_SPORTS);

    if (!matches.length) {
      logger.info('No matches found across all sports.');
      return 0;
    }

    let synced = 0;
    for (const match of matches) {
      try {
        const { changed } = await persistMatch(match);
        if (changed) emitMatchUpdate(match);
        synced++;
      } catch (err) {
        logger.error(`Failed to persist match ${match.id}:`, err.message);
      }
    }

    logger.info(`Synced ${synced} matches across all sports.`);
    return synced;
  } catch (err) {
    logger.error('syncAllMatches failed:', err.message);
    return 0;
  }
};

/**
 * Legacy single-sport sync (used by admin manual trigger).
 */
const syncMatches = async (sport = 'football') => {
  try {
    logger.info(`Syncing ${sport} matches…`);
    const { getAllTodayMatches: _get } = require('./sportsApiService');
    const matches = await _get([sport]);

    let synced = 0;
    for (const match of matches) {
      try {
        await persistMatch(match);
        synced++;
      } catch (err) {
        logger.error(`Failed to persist ${sport} match ${match.id}:`, err.message);
      }
    }

    logger.info(`Synced ${synced} ${sport} matches.`);
    return synced;
  } catch (err) {
    logger.error(`syncMatches(${sport}) failed:`, err.message);
    return 0;
  }
};

/**
 * Fetch and update every live match from the API in real time.
 */
const updateLiveMatches = async () => {
  try {
    // 1. Get live matches from API across all sports
    const liveFromApi = await getAllLiveMatches();

    if (liveFromApi.length) {
      for (const match of liveFromApi) {
        try {
          const { changed } = await persistMatch(match);
          if (changed) {
            logger.info(`Live score updated: ${match.id} — ${match.goles_local}:${match.goles_visitante} (${match.estado})`);
            emitMatchUpdate(match);
          }
        } catch (err) {
          logger.error(`Failed to update live match ${match.id}:`, err.message);
        }
      }
    }

    // 2. Any match marked LIVE in DB but not returned by API → mark as FT
    const dbLive = await query(
      "SELECT id, deporte, api_external_id FROM encuentros WHERE estado = 'LIVE'"
    );

    const apiLiveIds = new Set(liveFromApi.map((m) => m.id));
    for (const row of dbLive.rows) {
      if (!apiLiveIds.has(row.id)) {
        // Re-fetch individual match to get final score
        try {
          const sport = row.deporte || getSportFromId(row.id);
          const extId = row.api_external_id || getExternalId(row.id);
          const detail = await getMatchDetail(sport, extId);

          if (detail) {
            const { changed } = await persistMatch(detail);
            if (changed) {
              logger.info(`Match finished: ${detail.id} — final ${detail.goles_local}:${detail.goles_visitante}`);
              emitMatchUpdate(detail);
            }
          } else {
            // Fallback: just mark as FT
            await query(
              "UPDATE encuentros SET estado = 'FT', updated_at = NOW() WHERE id = ?",
              [row.id]
            );
            if (_io) _io.emit('match_updated', { id: row.id, estado: 'FT' });
          }
        } catch (err) {
          logger.error(`Failed to finalise match ${row.id}:`, err.message);
        }
      }
    }
  } catch (err) {
    logger.error('updateLiveMatches failed:', err.message);
  }
};

/**
 * Start all cron jobs.
 */
const startCronJobs = () => {
  // Sync all sports every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await syncAllMatches();
  });

  // Update live scores every minute
  cron.schedule('* * * * *', async () => {
    await updateLiveMatches();
  });

  // Full daily sync at 6 am Bogotá time (11 am UTC)
  cron.schedule('0 11 * * *', async () => {
    logger.info('Running daily full match sync…');
    await syncAllMatches();
  });

  logger.info('Cron jobs started (all sports).');
};

module.exports = {
  syncMatches,
  syncAllMatches,
  updateLiveMatches,
  startCronJobs,
  setSocketIO,
};
