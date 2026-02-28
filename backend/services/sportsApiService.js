/**
 * ============================================================
 * SPORTS API SERVICE - Multi-deporte completo
 *
 * Fuentes de datos:
 *   API-Sports (RapidAPI) → Fútbol, Básquet, Tenis, NFL, Béisbol, Hockey
 *   Misma API KEY para todos los deportes
 *
 * URLs por deporte:
 *   football          → v3.football.api-sports.io
 *   basketball        → v1.basketball.api-sports.io
 *   tennis            → v1.tennis.api-sports.io
 *   american_football → v1.american-football.api-sports.io
 *   baseball          → v1.baseball.api-sports.io
 *   hockey            → v1.hockey.api-sports.io
 * ============================================================
 */

const axios = require('axios');
const { setCache, getCache } = require('../config/redis');
const { logger } = require('../middleware/logger');

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const SPORT_BASES = {
  football:          'https://v3.football.api-sports.io',
  basketball:        'https://v1.basketball.api-sports.io',
  tennis:            'https://v1.tennis.api-sports.io',
  american_football: 'https://v1.american-football.api-sports.io',
  baseball:          'https://v1.baseball.api-sports.io',
  hockey:            'https://v1.hockey.api-sports.io',
};

const SPORT_LABELS = {
  football:          '⚽ Fútbol',
  basketball:        '🏀 Baloncesto',
  tennis:            '🎾 Tenis',
  american_football: '🏈 Fútbol Americano',
  baseball:          '⚾ Béisbol',
  hockey:            '🏒 Hockey',
};

const ALL_SPORTS = Object.keys(SPORT_BASES);

// ─────────────────────────────────────────────────────────────
// HELPERS DE FECHA (hora Bogotá UTC-5)
// ─────────────────────────────────────────────────────────────

const getTodayBogota = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD

const getDateBogota = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};

// ─────────────────────────────────────────────────────────────
// HTTP CLIENT con reintentos
// ─────────────────────────────────────────────────────────────

const apiCall = async (baseUrl, endpoint, params = {}, cacheKey = null, cacheTTL = 300) => {
  // Intento de caché
  if (cacheKey) {
    try {
      const cached = await getCache(cacheKey);
      if (cached) return cached;
    } catch (_) {}
  }

  const apiKey = process.env.SPORTS_API_KEY;
  if (!apiKey) {
    logger.warn('SPORTS_API_KEY no configurada');
    return { response: [], results: 0 };
  }

  const url  = `${baseUrl}${endpoint}`;
  const host = new URL(baseUrl).hostname;

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.get(url, {
        params,
        headers: {
          'x-rapidapi-key':  apiKey,
          'x-rapidapi-host': host,
        },
        timeout: 12000,
      });

      if (cacheKey) {
        try { await setCache(cacheKey, res.data, cacheTTL); } catch (_) {}
      }
      return res.data;
    } catch (err) {
      lastErr = err;
      if (err.response?.status === 429) {
        await new Promise(r => setTimeout(r, attempt * 2000));
      } else {
        break;
      }
    }
  }

  logger.error('Sports API error', { url, error: lastErr?.message });
  return { response: [], results: 0 };
};

// ─────────────────────────────────────────────────────────────
// OBTENER PARTIDOS DEL DÍA — por deporte
// ─────────────────────────────────────────────────────────────

const getTodayMatches = async (sport) => {
  const today    = getTodayBogota();
  const cacheKey = `today:${sport}:${today}`;
  const base     = SPORT_BASES[sport];

  if (!base) return { response: [] };

  switch (sport) {
    case 'football':
      return apiCall(base, '/fixtures',
        { date: today, timezone: 'America/Bogota' }, cacheKey, 120);

    case 'basketball':
      return apiCall(base, '/games',
        { date: today, timezone: 'America/Bogota' }, cacheKey, 120);

    case 'tennis':
      return apiCall(base, '/games',
        { date: today, timezone: 'America/Bogota' }, cacheKey, 180);

    case 'american_football':
      return apiCall(base, '/games',
        { date: today }, cacheKey, 180);

    case 'baseball':
      return apiCall(base, '/games',
        { date: today }, cacheKey, 180);

    case 'hockey':
      return apiCall(base, '/games',
        { date: today }, cacheKey, 180);

    default:
      return { response: [] };
  }
};

// ── Todos los deportes en paralelo ────────────────────────────
const getAllTodayMatches = async (sports = ALL_SPORTS) => {
  const results = await Promise.allSettled(
    sports.map(sport => getTodayMatches(sport))
  );

  const allMatches = [];
  sports.forEach((sport, i) => {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value?.response?.length) {
      r.value.response.forEach(raw => {
        const match = normalizeMatch(raw, sport);
        if (match) allMatches.push(match);
      });
    }
  });

  return allMatches;
};

// ─────────────────────────────────────────────────────────────
// PARTIDOS EN VIVO — por deporte
// ─────────────────────────────────────────────────────────────

const getLiveMatches = async (sport) => {
  const base = SPORT_BASES[sport];
  if (!base) return { response: [] };

  switch (sport) {
    case 'football':
      return apiCall(base, '/fixtures', { live: 'all' }, null, 60);
    case 'basketball':
      return apiCall(base, '/games',    { live: 'all' }, null, 60);
    case 'tennis':
      return apiCall(base, '/games',    { live: 'all' }, null, 60);
    case 'american_football':
      return apiCall(base, '/games',    { live: 'all' }, null, 60);
    case 'baseball':
      return apiCall(base, '/games',    { live: 'all' }, null, 60);
    case 'hockey':
      return apiCall(base, '/games',    { live: 'all' }, null, 60);
    default:
      return { response: [] };
  }
};

// Todos los deportes en vivo en paralelo
const getAllLiveMatches = async () => {
  const results = await Promise.allSettled(
    ALL_SPORTS.map(sport => getLiveMatches(sport))
  );

  const live = [];
  ALL_SPORTS.forEach((sport, i) => {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value?.response?.length) {
      r.value.response.forEach(raw => {
        const match = normalizeMatch(raw, sport);
        if (match) live.push(match);
      });
    }
  });

  return live;
};

// ─────────────────────────────────────────────────────────────
// DETALLE — partido individual (para actualizar marcador)
// ─────────────────────────────────────────────────────────────

const getMatchDetail = async (sport, externalId) => {
  const base = SPORT_BASES[sport];
  if (!base) return { response: [] };

  switch (sport) {
    case 'football':
      return apiCall(base, '/fixtures', { id: externalId }, null, 60);
    case 'basketball':
      return apiCall(base, '/games',    { id: externalId }, null, 60);
    case 'tennis':
      return apiCall(base, '/games',    { id: externalId }, null, 60);
    case 'american_football':
      return apiCall(base, '/games',    { id: externalId }, null, 60);
    case 'baseball':
      return apiCall(base, '/games',    { id: externalId }, null, 60);
    case 'hockey':
      return apiCall(base, '/games',    { id: externalId }, null, 60);
    default:
      return { response: [] };
  }
};

// ─────────────────────────────────────────────────────────────
// OTRAS CONSULTAS (fútbol principalmente)
// ─────────────────────────────────────────────────────────────

const getTeamStats = async (sport, teamId, leagueId, season) => {
  const base = SPORT_BASES[sport];
  if (!base) return { response: [] };
  const cacheKey = `stats:${sport}:${teamId}:${leagueId}:${season}`;

  if (sport === 'football') {
    return apiCall(base, '/teams/statistics',
      { team: teamId, league: leagueId, season }, cacheKey, 3600);
  }
  if (sport === 'basketball') {
    return apiCall(base, '/teams/statistics',
      { id: teamId, league: leagueId, season }, cacheKey, 3600);
  }
  return { response: [] };
};

const getHeadToHead = async (sport, team1, team2) => {
  if (sport !== 'football') return { response: [] };
  const cacheKey = `h2h:${team1}:${team2}`;
  return apiCall(SPORT_BASES.football, '/fixtures/headtohead',
    { h2h: `${team1}-${team2}`, last: 10 }, cacheKey, 3600);
};

const getTeamLastMatches = async (sport, teamId, count = 10) => {
  const base = SPORT_BASES[sport];
  if (!base) return { response: [] };
  const cacheKey = `last:${sport}:${teamId}:${count}`;

  if (sport === 'football') {
    return apiCall(base, '/fixtures', { team: teamId, last: count }, cacheKey, 1800);
  }
  if (sport === 'basketball') {
    return apiCall(base, '/games', { team: teamId, last: count }, cacheKey, 1800);
  }
  return { response: [] };
};

const getLineups = async (fixtureId) =>
  apiCall(SPORT_BASES.football, '/fixtures/lineups',
    { fixture: fixtureId }, `lineups:${fixtureId}`, 300);

const getInjuries = async (teamId, leagueId, season) =>
  apiCall(SPORT_BASES.football, '/injuries',
    { team: teamId, league: leagueId, season },
    `injuries:${teamId}:${leagueId}:${season}`, 3600);

// ─────────────────────────────────────────────────────────────
// NORMALIZACIÓN — API raw → formato interno del sistema
// ─────────────────────────────────────────────────────────────

const normalizeMatch = (raw, sport) => {
  if (!raw) return null;
  try {
    switch (sport) {
      case 'football':          return _normalizeFootball(raw);
      case 'basketball':        return _normalizeBasketball(raw);
      case 'tennis':            return _normalizeTennis(raw);
      case 'american_football': return _normalizeAmericanFootball(raw);
      case 'baseball':          return _normalizeBaseball(raw);
      case 'hockey':            return _normalizeHockey(raw);
      default:
        logger.warn(`normalizeMatch: deporte desconocido '${sport}'`);
        return null;
    }
  } catch (err) {
    logger.error(`Error normalizando partido ${sport}:`, err.message);
    return null;
  }
};

// ── ⚽ FÚTBOL ─────────────────────────────────────────────────
function _normalizeFootball(r) {
  const f  = r.fixture;
  const t  = r.teams;
  const g  = r.goals;
  const l  = r.league;
  const sc = r.score;

  if (!f?.id || !t?.home?.id || !t?.away?.id) return null;

  return {
    id:           `football-${f.id}`,
    deporte:      'football',
    deporte_label: SPORT_LABELS.football,
    equipo_local: {
      id:     `football-team-${t.home.id}`,
      nombre: t.home.name,
      logo:   t.home.logo || '',
    },
    equipo_visitante: {
      id:     `football-team-${t.away.id}`,
      nombre: t.away.name,
      logo:   t.away.logo || '',
    },
    fecha_hora:      new Date(f.date),
    estado:          _statusFootball(f.status?.short),
    minuto:          f.status?.elapsed || null,
    goles_local:     g?.home ?? null,
    goles_visitante: g?.away ?? null,
    estadio:         f.venue?.name || null,
    liga:            l?.name || null,
    competencia:     l?.country || null,
    liga_logo:       l?.logo || null,
    temporada:       String(l?.season || ''),
    datos_json: {
      halftime: { local: sc?.halftime?.home, visitante: sc?.halftime?.away },
      referee:  f.referee,
    },
    api_external_id: String(f.id),
  };
}

const _statusFootball = (s) => ({
  'NS':'SCHEDULED','TBD':'SCHEDULED','SUSP':'POSTPONED',
  '1H':'LIVE','HT':'LIVE','2H':'LIVE','ET':'LIVE','BT':'LIVE','P':'LIVE','INT':'LIVE',
  'FT':'FINISHED','AET':'FINISHED','PEN':'FINISHED',
  'PST':'POSTPONED','CANC':'CANCELLED','ABD':'CANCELLED','WO':'CANCELLED',
})[s] || 'SCHEDULED';

// ── 🏀 BALONCESTO ─────────────────────────────────────────────
function _normalizeBasketball(r) {
  const t = r.teams;
  const s = r.scores;
  const l = r.league;

  if (!r.id || !t?.home?.id || !t?.away?.id) return null;

  return {
    id:           `basketball-${r.id}`,
    deporte:      'basketball',
    deporte_label: SPORT_LABELS.basketball,
    equipo_local: {
      id:     `basketball-team-${t.home.id}`,
      nombre: t.home.name,
      logo:   t.home.logo || '',
    },
    equipo_visitante: {
      id:     `basketball-team-${t.away.id}`,
      nombre: t.away.name,
      logo:   t.away.logo || '',
    },
    fecha_hora:      new Date(r.date),
    estado:          _statusBasketball(r.status?.short),
    periodo:         r.status?.short || null,
    goles_local:     s?.home?.total ?? null,   // puntos
    goles_visitante: s?.away?.total ?? null,
    estadio:         r.arena?.name || null,
    liga:            l?.name || null,
    competencia:     l?.country || null,
    liga_logo:       l?.logo || null,
    temporada:       String(l?.season || ''),
    datos_json: {
      cuartos: {
        local:     [s?.home?.quarter_1, s?.home?.quarter_2, s?.home?.quarter_3, s?.home?.quarter_4],
        visitante: [s?.away?.quarter_1, s?.away?.quarter_2, s?.away?.quarter_3, s?.away?.quarter_4],
      },
    },
    api_external_id: String(r.id),
  };
}

const _statusBasketball = (s) => ({
  'NS':'SCHEDULED','TBD':'SCHEDULED',
  'Q1':'LIVE','Q2':'LIVE','Q3':'LIVE','Q4':'LIVE','OT':'LIVE','HT':'LIVE','BT':'LIVE',
  'FT':'FINISHED','AOT':'FINISHED',
  'CANC':'CANCELLED','PST':'POSTPONED','ABD':'CANCELLED',
})[s] || 'SCHEDULED';

// ── 🎾 TENIS ──────────────────────────────────────────────────
function _normalizeTennis(r) {
  const players = r.players;
  const tour    = r.tournament;

  if (!r.id || !players?.length) return null;

  const p1 = players[0] || {};
  const p2 = players[1] || {};

  // Contar sets ganados por cada jugador
  const sets = r.scores || [];
  let sets1 = 0, sets2 = 0;
  sets.forEach(set => {
    const h = parseInt(set.home) || 0;
    const a = parseInt(set.away) || 0;
    if (h > a) sets1++;
    else if (a > h) sets2++;
  });

  return {
    id:           `tennis-${r.id}`,
    deporte:      'tennis',
    deporte_label: SPORT_LABELS.tennis,
    equipo_local: {
      id:     `tennis-player-${p1.id || 'p1'}`,
      nombre: p1.name || 'Jugador 1',
      logo:   p1.image || '',
    },
    equipo_visitante: {
      id:     `tennis-player-${p2.id || 'p2'}`,
      nombre: p2.name || 'Jugador 2',
      logo:   p2.image || '',
    },
    fecha_hora:      new Date(r.date),
    estado:          _statusTennis(r.status?.short),
    goles_local:     sets.length ? sets1 : null,    // sets ganados
    goles_visitante: sets.length ? sets2 : null,
    estadio:         tour?.venue || null,
    liga:            tour?.name || null,
    competencia:     r.country?.name || tour?.category?.name || null,
    liga_logo:       null,
    temporada:       String(new Date().getFullYear()),
    datos_json: {
      sets:    sets,
      surface: tour?.surface || null,
      round:   r.round || null,
    },
    api_external_id: String(r.id),
  };
}

const _statusTennis = (s = '') => {
  if (s === 'FT' || s === 'FINAL') return 'FINISHED';
  if (s === 'CANC' || s === 'WO')  return 'CANCELLED';
  if (s === 'PST')                  return 'POSTPONED';
  if (s === 'NS' || s === 'TBD')   return 'SCHEDULED';
  if (s?.includes('S') || s === 'LIVE') return 'LIVE'; // 1S, 2S, 3S...
  return 'SCHEDULED';
};

// ── 🏈 FÚTBOL AMERICANO / NFL ─────────────────────────────────
function _normalizeAmericanFootball(r) {
  const g = r.game;
  const t = r.teams;
  const s = r.scores;
  const l = r.league;

  if (!g?.id || !t?.home?.id || !t?.away?.id) return null;

  // Fecha: el campo viene como { date: "YYYY-MM-DD", time: "HH:MM" }
  let fecha;
  try {
    fecha = new Date(`${g.date?.date}T${g.date?.time || '00:00'}:00`);
  } catch (_) {
    fecha = new Date();
  }

  return {
    id:           `nfl-${g.id}`,
    deporte:      'american_football',
    deporte_label: SPORT_LABELS.american_football,
    equipo_local: {
      id:     `nfl-team-${t.home.id}`,
      nombre: t.home.name,
      logo:   t.home.logo || '',
    },
    equipo_visitante: {
      id:     `nfl-team-${t.away.id}`,
      nombre: t.away.name,
      logo:   t.away.logo || '',
    },
    fecha_hora:      fecha,
    estado:          _statusNFL(g.status?.short),
    periodo:         g.status?.short || null,
    goles_local:     s?.home?.total ?? null,    // puntos
    goles_visitante: s?.away?.total ?? null,
    estadio:         g.venue?.name || null,
    liga:            l?.name || null,
    competencia:     `Temporada ${l?.season || ''}`,
    liga_logo:       null,
    temporada:       String(l?.season || ''),
    datos_json: {
      cuartos: {
        local:     [s?.home?.quarter_1, s?.home?.quarter_2, s?.home?.quarter_3, s?.home?.quarter_4],
        visitante: [s?.away?.quarter_1, s?.away?.quarter_2, s?.away?.quarter_3, s?.away?.quarter_4],
      },
      week: l?.stage || null,
    },
    api_external_id: String(g.id),
  };
}

const _statusNFL = (s) => ({
  'NS':'SCHEDULED','TBD':'SCHEDULED',
  'Q1':'LIVE','Q2':'LIVE','Q3':'LIVE','Q4':'LIVE','OT':'LIVE','HT':'LIVE','P':'LIVE',
  'FT':'FINISHED','AOT':'FINISHED',
  'CANC':'CANCELLED','PST':'POSTPONED',
})[s] || 'SCHEDULED';

// ── ⚾ BÉISBOL ─────────────────────────────────────────────────
function _normalizeBaseball(r) {
  const t = r.teams;
  const s = r.scores;
  const l = r.league;

  if (!r.id || !t?.home?.id || !t?.away?.id) return null;

  return {
    id:           `baseball-${r.id}`,
    deporte:      'baseball',
    deporte_label: SPORT_LABELS.baseball,
    equipo_local: {
      id:     `baseball-team-${t.home.id}`,
      nombre: t.home.name,
      logo:   t.home.logo || '',
    },
    equipo_visitante: {
      id:     `baseball-team-${t.away.id}`,
      nombre: t.away.name,
      logo:   t.away.logo || '',
    },
    fecha_hora:      new Date(r.date),
    estado:          _statusBaseball(r.status?.short),
    goles_local:     s?.home?.total ?? null,    // carreras
    goles_visitante: s?.away?.total ?? null,
    estadio:         r.venue?.name || null,
    liga:            l?.name || null,
    competencia:     l?.country || null,
    liga_logo:       null,
    temporada:       String(l?.season || ''),
    datos_json: {
      innings: s?.innings || {},
    },
    api_external_id: String(r.id),
  };
}

const _statusBaseball = (s) => ({
  'NS':'SCHEDULED','TBD':'SCHEDULED',
  'IN_PROGRESS':'LIVE','LIVE':'LIVE',
  'FT':'FINISHED','FINISHED':'FINISHED',
  'CANC':'CANCELLED','PST':'POSTPONED',
})[s] || 'SCHEDULED';

// ── 🏒 HOCKEY ─────────────────────────────────────────────────
function _normalizeHockey(r) {
  const t = r.teams;
  const s = r.scores;
  const l = r.league;

  if (!r.id || !t?.home?.id || !t?.away?.id) return null;

  return {
    id:           `hockey-${r.id}`,
    deporte:      'hockey',
    deporte_label: SPORT_LABELS.hockey,
    equipo_local: {
      id:     `hockey-team-${t.home.id}`,
      nombre: t.home.name,
      logo:   t.home.logo || '',
    },
    equipo_visitante: {
      id:     `hockey-team-${t.away.id}`,
      nombre: t.away.name,
      logo:   t.away.logo || '',
    },
    fecha_hora:      new Date(r.date),
    estado:          _statusHockey(r.status?.short),
    periodo:         r.status?.short || null,
    goles_local:     s?.home ?? null,
    goles_visitante: s?.away ?? null,
    estadio:         r.arena?.name || null,
    liga:            l?.name || null,
    competencia:     l?.country || null,
    liga_logo:       null,
    temporada:       String(l?.season || ''),
    datos_json: {
      periodos: s?.periods || {},
    },
    api_external_id: String(r.id),
  };
}

const _statusHockey = (s) => ({
  'NS':'SCHEDULED','TBD':'SCHEDULED',
  'P1':'LIVE','P2':'LIVE','P3':'LIVE','OT':'LIVE','PEN':'LIVE','BT':'LIVE',
  'FT':'FINISHED','AOT':'FINISHED','APN':'FINISHED',
  'CANC':'CANCELLED','PST':'POSTPONED',
})[s] || 'SCHEDULED';

// ─────────────────────────────────────────────────────────────
// UTILIDADES DE ID
// ─────────────────────────────────────────────────────────────

const getSportFromId = (id = '') => {
  if (id.startsWith('football-'))         return 'football';
  if (id.startsWith('basketball-'))       return 'basketball';
  if (id.startsWith('tennis-'))           return 'tennis';
  if (id.startsWith('nfl-'))              return 'american_football';
  if (id.startsWith('baseball-'))         return 'baseball';
  if (id.startsWith('hockey-'))           return 'hockey';
  return null;
};

const getExternalId = (id = '') => id.split('-').pop();

// ─────────────────────────────────────────────────────────────
module.exports = {
  ALL_SPORTS,
  SPORT_LABELS,
  SPORT_BASES,
  getTodayBogota,
  getDateBogota,
  getTodayMatches,
  getAllTodayMatches,
  getLiveMatches,
  getAllLiveMatches,
  getMatchDetail,
  getTeamStats,
  getHeadToHead,
  getTeamLastMatches,
  getLineups,
  getInjuries,
  normalizeMatch,
  getSportFromId,
  getExternalId,
};
