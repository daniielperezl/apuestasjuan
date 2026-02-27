const cron = require('node-cron');
const { query } = require('../config/database');
const { getTodayMatches, normalizeMatch } = require('./sportsApiService');
const { logger } = require('../middleware/logger');

const syncMatches = async (sport = 'football') => {
  try {
    logger.info(`Syncing ${sport} matches...`);
    const data = await getTodayMatches(sport);

    if (!data?.response?.length) {
      logger.info(`No matches found for ${sport}`);
      return 0;
    }

    let synced = 0;
    for (const rawMatch of data.response) {
      const match = normalizeMatch(rawMatch, sport);
      if (!match) continue;

      // Upsert team local
      await query(
        `INSERT INTO equipos (id, nombre, deporte, logo_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, logo_url = EXCLUDED.logo_url`,
        [match.equipo_local.id, match.equipo_local.nombre, sport, match.equipo_local.logo || '']
      );

      // Upsert team visitante
      await query(
        `INSERT INTO equipos (id, nombre, deporte, logo_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, logo_url = EXCLUDED.logo_url`,
        [match.equipo_visitante.id, match.equipo_visitante.nombre, sport, match.equipo_visitante.logo || '']
      );

      // Upsert match
      await query(
        `INSERT INTO encuentros (id, deporte, equipo_local_id, equipo_visitante_id, fecha_hora,
           estado, goles_local, goles_visitante, estadio, liga, api_external_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           estado = EXCLUDED.estado,
           goles_local = EXCLUDED.goles_local,
           goles_visitante = EXCLUDED.goles_visitante,
           updated_at = NOW()`,
        [
          match.id, match.deporte,
          match.equipo_local.id, match.equipo_visitante.id,
          match.fecha_hora, match.estado,
          match.goles_local, match.goles_visitante,
          match.estadio, match.liga, match.api_external_id
        ]
      );

      synced++;
    }

    logger.info(`Synced ${synced} ${sport} matches`);
    return synced;
  } catch (err) {
    logger.error(`Failed to sync ${sport} matches:`, err.message);
    return 0;
  }
};

const updateLiveMatches = async () => {
  try {
    const liveMatches = await query("SELECT id FROM encuentros WHERE estado = 'LIVE'");
    for (const match of liveMatches.rows) {
      // Re-sync individual live match
      logger.info(`Updating live match: ${match.id}`);
    }
  } catch (err) {
    logger.error('Failed to update live matches:', err.message);
  }
};

const startCronJobs = () => {
  // Sync matches every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await syncMatches('football');
    await syncMatches('basketball');
  });

  // Update live matches every minute
  cron.schedule('* * * * *', async () => {
    await updateLiveMatches();
  });

  // Daily sync at 6am Bogota time (11am UTC)
  cron.schedule('0 11 * * *', async () => {
    logger.info('Running daily match sync...');
    await syncMatches('football');
    await syncMatches('basketball');
  });

  logger.info('Cron jobs started');
};

module.exports = { syncMatches, updateLiveMatches, startCronJobs };
