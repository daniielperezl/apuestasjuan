const axios = require('axios');
const { setCache, getCache } = require('../config/redis');
const { logger } = require('../middleware/logger');

const SPORTS_API_KEY = process.env.SPORTS_API_KEY;
const SPORTS_API_URL = process.env.SPORTS_API_URL || 'https://v3.football.api-sports.io';
const CACHE_TTL = 300; // 5 minutes

const apiCall = async (url, params = {}, cacheKey = null, cacheTTL = CACHE_TTL) => {
  if (cacheKey) {
    const cached = await getCache(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await axios.get(url, {
      params,
      headers: {
        'x-rapidapi-key': SPORTS_API_KEY,
        'x-rapidapi-host': new URL(SPORTS_API_URL).hostname
      },
      timeout: 10000
    });

    const data = response.data;
    if (cacheKey) await setCache(cacheKey, data, cacheTTL);
    return data;
  } catch (err) {
    logger.error('Sports API error:', { url, error: err.message });
    throw new Error(`Error al obtener datos deportivos: ${err.message}`);
  }
};

const getTodayMatches = async (sport = 'football') => {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `matches:today:${sport}:${today}`;

  if (sport === 'football') {
    return apiCall(`${SPORTS_API_URL}/fixtures`, { date: today, timezone: 'America/Bogota' }, cacheKey, 180);
  } else if (sport === 'basketball') {
    return apiCall(`https://v1.basketball.api-sports.io/games`, { date: today }, cacheKey, 180);
  }

  return { response: [] };
};

const getMatchDetails = async (fixtureId) => {
  const cacheKey = `match:${fixtureId}`;
  return apiCall(`${SPORTS_API_URL}/fixtures`, { id: fixtureId }, cacheKey, 60);
};

const getTeamStats = async (teamId, leagueId, season) => {
  const cacheKey = `team:stats:${teamId}:${leagueId}:${season}`;
  return apiCall(`${SPORTS_API_URL}/teams/statistics`, { team: teamId, league: leagueId, season }, cacheKey, 3600);
};

const getHeadToHead = async (team1Id, team2Id) => {
  const cacheKey = `h2h:${team1Id}:${team2Id}`;
  return apiCall(`${SPORTS_API_URL}/fixtures/headtohead`, { h2h: `${team1Id}-${team2Id}`, last: 10 }, cacheKey, 3600);
};

const getTeamLastMatches = async (teamId, count = 10) => {
  const cacheKey = `team:last:${teamId}:${count}`;
  return apiCall(`${SPORTS_API_URL}/fixtures`, { team: teamId, last: count }, cacheKey, 1800);
};

const getLineups = async (fixtureId) => {
  const cacheKey = `lineups:${fixtureId}`;
  return apiCall(`${SPORTS_API_URL}/fixtures/lineups`, { fixture: fixtureId }, cacheKey, 300);
};

const getInjuries = async (teamId, leagueId, season) => {
  const cacheKey = `injuries:${teamId}:${leagueId}:${season}`;
  return apiCall(`${SPORTS_API_URL}/injuries`, { team: teamId, league: leagueId, season }, cacheKey, 3600);
};

// Normalize match data for internal use
const normalizeMatch = (rawMatch, sport = 'football') => {
  if (sport === 'football') {
    const f = rawMatch.fixture;
    const teams = rawMatch.teams;
    const goals = rawMatch.goals;
    const league = rawMatch.league;
    return {
      id: `football-${f.id}`,
      deporte: 'football',
      equipo_local: {
        id: `football-team-${teams.home.id}`,
        nombre: teams.home.name,
        logo: teams.home.logo
      },
      equipo_visitante: {
        id: `football-team-${teams.away.id}`,
        nombre: teams.away.name,
        logo: teams.away.logo
      },
      fecha_hora: new Date(f.date),
      estado: normalizeStatus(f.status.short),
      goles_local: goals?.home,
      goles_visitante: goals?.away,
      estadio: f.venue?.name,
      liga: league?.name,
      competencia: league?.country,
      api_external_id: String(f.id)
    };
  }
  return null;
};

const normalizeStatus = (apiStatus) => {
  const map = {
    'NS': 'SCHEDULED', 'TBD': 'SCHEDULED',
    '1H': 'LIVE', 'HT': 'LIVE', '2H': 'LIVE', 'ET': 'LIVE', 'P': 'LIVE',
    'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED',
    'CANC': 'CANCELLED', 'PST': 'POSTPONED', 'ABD': 'CANCELLED'
  };
  return map[apiStatus] || 'SCHEDULED';
};

module.exports = {
  getTodayMatches,
  getMatchDetails,
  getTeamStats,
  getHeadToHead,
  getTeamLastMatches,
  getLineups,
  getInjuries,
  normalizeMatch
};
