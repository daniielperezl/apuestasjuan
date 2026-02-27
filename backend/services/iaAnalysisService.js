const { callIA } = require('../config/ia-providers');
const { query } = require('../config/database');
const { getCache, setCache } = require('../config/redis');
const { logger } = require('../middleware/logger');

const SYSTEM_PROMPT = `Eres un experto analista de apuestas deportivas con 20 años de experiencia en análisis estadístico y predicciones deportivas. Tu objetivo es proporcionar análisis precisos y objetivos basados en datos históricos y estadísticas. SIEMPRE responde en formato JSON válido exactamente como se especifica.`;

const buildAnalysisPrompt = (matchData) => {
  const { local, visitante, encuentro, estadisticasLocal, estadisticasVisitante, h2h, alineaciones } = matchData;

  return `Analiza el siguiente partido deportivo y proporciona predicciones detalladas:

PARTIDO: ${local.nombre} vs ${visitante.nombre}
DEPORTE: ${encuentro.deporte}
LIGA: ${encuentro.liga}
FECHA/HORA: ${new Date(encuentro.fecha_hora).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
ESTADIO: ${encuentro.estadio || 'No especificado'}

ESTADÍSTICAS ${local.nombre.toUpperCase()} (LOCAL):
- Últimos 10 partidos: ${estadisticasLocal?.forma_reciente || 'N/D'}
- Partidos jugados: ${estadisticasLocal?.partidos_jugados || 'N/D'}
- W-L-D: ${estadisticasLocal?.partidos_ganados || 0}-${estadisticasLocal?.partidos_perdidos || 0}-${estadisticasLocal?.partidos_empatados || 0}
- Goles promedio marcados: ${estadisticasLocal?.goles_promedio || 'N/D'}
- Goles promedio concedidos: ${estadisticasLocal?.goles_concedidos_promedio || 'N/D'}
- Tiros a portería promedio: ${estadisticasLocal?.tiros_porteria_promedio || 'N/D'}
- Posesión promedio: ${estadisticasLocal?.posesion_promedio || 'N/D'}%
- Tarjetas amarillas promedio: ${estadisticasLocal?.tarjetas_amarillas_promedio || 'N/D'}
- Córneres promedio: ${estadisticasLocal?.corneres_promedio || 'N/D'}

ESTADÍSTICAS ${visitante.nombre.toUpperCase()} (VISITANTE):
- Últimos 10 partidos: ${estadisticasVisitante?.forma_reciente || 'N/D'}
- Partidos jugados: ${estadisticasVisitante?.partidos_jugados || 'N/D'}
- W-L-D: ${estadisticasVisitante?.partidos_ganados || 0}-${estadisticasVisitante?.partidos_perdidos || 0}-${estadisticasVisitante?.partidos_empatados || 0}
- Goles promedio marcados: ${estadisticasVisitante?.goles_promedio || 'N/D'}
- Goles promedio concedidos: ${estadisticasVisitante?.goles_concedidos_promedio || 'N/D'}
- Tiros a portería promedio: ${estadisticasVisitante?.tiros_porteria_promedio || 'N/D'}
- Posesión promedio: ${estadisticasVisitante?.posesion_promedio || 'N/D'}%
- Tarjetas amarillas promedio: ${estadisticasVisitante?.tarjetas_amarillas_promedio || 'N/D'}
- Córneres promedio: ${estadisticasVisitante?.corneres_promedio || 'N/D'}

HISTORIAL DIRECTO (H2H - últimos encuentros):
${h2h?.length ? h2h.map(m => `- ${new Date(m.fecha).toLocaleDateString('es-CO')}: ${local.nombre} ${m.goles_local} - ${m.goles_visitante} ${visitante.nombre}`).join('\n') : 'Sin historial disponible'}

ALINEACIONES ESPERADAS:
${alineaciones ? `Local: ${alineaciones.local || 'No disponible'}\nVisitante: ${alineaciones.visitante || 'No disponible'}` : 'No disponibles aún'}

Responde ÚNICAMENTE con el siguiente JSON (sin texto adicional, sin markdown):
{
  "probabilidades": {
    "local_gana": <número 0-100>,
    "empate": <número 0-100>,
    "visitante_gana": <número 0-100>
  },
  "goles_esperados": {
    "local": <número decimal>,
    "visitante": <número decimal>,
    "total": <número decimal>,
    "probabilidad_over_0_5": <número 0-100>,
    "probabilidad_over_1_5": <número 0-100>,
    "probabilidad_over_2_5": <número 0-100>,
    "probabilidad_over_3_5": <número 0-100>,
    "probabilidad_under_2_5": <número 0-100>,
    "probabilidad_btts": <número 0-100>
  },
  "apuestas_recomendadas": [
    {
      "tipo": "<RESULTADO|GOLES|BTTS|HANDICAP|TARJETAS|CORNERES|EXACTO|COMBINADA>",
      "descripcion": "<descripción clara>",
      "seleccion": "<selección específica>",
      "probabilidad_acierto": <número 0-100>,
      "cuota_esperada": <número decimal>,
      "riesgo": "<BAJO|MEDIO|ALTO>",
      "razon": "<explicación breve>"
    }
  ],
  "factores_clave": ["<factor1>", "<factor2>", "<factor3>"],
  "factores_riesgo": ["<riesgo1>", "<riesgo2>"],
  "confianza_analisis": <número 0-100>,
  "analisis_narrativo": "<párrafo explicativo del análisis>",
  "marcador_probable": "<ej: 2-1>",
  "forma_local": "<descripción>",
  "forma_visitante": "<descripción>"
}`;
};

const calcularProbabilidadesBase = (statsLocal, statsVisitante, h2h) => {
  // Peso histórico 40%
  const pjL = statsLocal?.partidos_jugados || 10;
  const pjV = statsVisitante?.partidos_jugados || 10;
  const winRateLocal = statsLocal ? (statsLocal.partidos_ganados / pjL) * 100 : 40;
  const winRateVisitante = statsVisitante ? (statsVisitante.partidos_ganados / pjV) * 100 : 35;
  const drawRateLocal = statsLocal ? (statsLocal.partidos_empatados / pjL) * 100 : 25;

  // Peso H2H 15%
  let h2hLocalWins = 0, h2hDraws = 0, h2hVisitanteWins = 0;
  if (h2h && h2h.length > 0) {
    h2h.forEach(m => {
      if (m.goles_local > m.goles_visitante) h2hLocalWins++;
      else if (m.goles_local === m.goles_visitante) h2hDraws++;
      else h2hVisitanteWins++;
    });
    h2hLocalWins = (h2hLocalWins / h2h.length) * 100;
    h2hDraws = (h2hDraws / h2h.length) * 100;
    h2hVisitanteWins = (h2hVisitanteWins / h2h.length) * 100;
  } else {
    h2hLocalWins = 40; h2hDraws = 25; h2hVisitanteWins = 35;
  }

  const localBase = (winRateLocal * 0.40 + h2hLocalWins * 0.15);
  const visitanteBase = (winRateVisitante * 0.40 + h2hVisitanteWins * 0.15);
  const drawBase = (drawRateLocal * 0.40 + h2hDraws * 0.15);

  const total = localBase + visitanteBase + drawBase;
  return {
    local_gana: Math.round((localBase / total) * 100),
    empate: Math.round((drawBase / total) * 100),
    visitante_gana: Math.round((visitanteBase / total) * 100)
  };
};

const analyzeMatch = async (encuentroId) => {
  // Check cache
  const cached = await getCache(`analysis:${encuentroId}`);
  if (cached) return cached;

  // Get match data
  const matchResult = await query(
    `SELECT e.*,
      el.nombre as local_nombre, el.logo_url as local_logo,
      ev.nombre as visitante_nombre, ev.logo_url as visitante_logo
     FROM encuentros e
     JOIN equipos el ON e.equipo_local_id = el.id
     JOIN equipos ev ON e.equipo_visitante_id = ev.id
     WHERE e.id = $1`,
    [encuentroId]
  );

  if (!matchResult.rows.length) throw new Error('Encuentro no encontrado');
  const encuentro = matchResult.rows[0];

  // Get team stats
  const [statsLocalRes, statsVisitanteRes] = await Promise.all([
    query('SELECT * FROM estadisticas_equipo WHERE equipo_id = $1 ORDER BY updated_at DESC LIMIT 1', [encuentro.equipo_local_id]),
    query('SELECT * FROM estadisticas_equipo WHERE equipo_id = $1 ORDER BY updated_at DESC LIMIT 1', [encuentro.equipo_visitante_id])
  ]);

  const statsLocal = statsLocalRes.rows[0] || null;
  const statsVisitante = statsVisitanteRes.rows[0] || null;

  // Get H2H
  const h2hRes = await query(
    `SELECT * FROM historial_directo
     WHERE (equipo_local_id = $1 AND equipo_visitante_id = $2)
        OR (equipo_local_id = $2 AND equipo_visitante_id = $1)
     ORDER BY fecha DESC LIMIT 10`,
    [encuentro.equipo_local_id, encuentro.equipo_visitante_id]
  );

  const matchData = {
    local: { id: encuentro.equipo_local_id, nombre: encuentro.local_nombre, logo: encuentro.local_logo },
    visitante: { id: encuentro.equipo_visitante_id, nombre: encuentro.visitante_nombre, logo: encuentro.visitante_logo },
    encuentro,
    estadisticasLocal: statsLocal,
    estadisticasVisitante: statsVisitante,
    h2h: h2hRes.rows,
    alineaciones: null
  };

  // Calculate base probabilities
  const probsBase = calcularProbabilidadesBase(statsLocal, statsVisitante, h2hRes.rows);

  let iaResult = null;
  let iaError = null;
  let tokensUsed = 0;

  try {
    const prompt = buildAnalysisPrompt(matchData);
    const rawResponse = await callIA(prompt, SYSTEM_PROMPT);

    // Parse JSON from response
    let jsonStr = rawResponse.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    iaResult = JSON.parse(jsonStr);
    tokensUsed = rawResponse.length;
  } catch (err) {
    logger.error('IA analysis failed:', err.message);
    iaError = err.message;
    // Use base calculations as fallback
    iaResult = {
      probabilidades: probsBase,
      goles_esperados: {
        local: 1.3, visitante: 1.0, total: 2.3,
        probabilidad_over_0_5: 92, probabilidad_over_1_5: 76,
        probabilidad_over_2_5: 52, probabilidad_over_3_5: 28,
        probabilidad_under_2_5: 48, probabilidad_btts: 55
      },
      apuestas_recomendadas: [
        { tipo: 'RESULTADO', descripcion: 'Victoria local', seleccion: '1', probabilidad_acierto: probsBase.local_gana, cuota_esperada: 1.85, riesgo: 'MEDIO', razon: 'Basado en estadísticas históricas' },
        { tipo: 'GOLES', descripcion: 'Más de 1.5 goles', seleccion: 'OVER_1.5', probabilidad_acierto: 76, cuota_esperada: 1.35, riesgo: 'BAJO', razon: 'Alta tendencia de goles en ambos equipos' },
        { tipo: 'BTTS', descripcion: 'Ambos equipos marcan', seleccion: 'SÍ', probabilidad_acierto: 55, cuota_esperada: 1.72, riesgo: 'MEDIO', razon: 'Ofensivas activas en ambos lados' }
      ],
      factores_clave: ['Estadísticas de forma reciente', 'Ventaja de local', 'Historial directo'],
      factores_riesgo: ['Datos limitados disponibles', 'Posibles cambios de alineación'],
      confianza_analisis: iaError ? 45 : 70,
      analisis_narrativo: 'Análisis generado con datos estadísticos disponibles.',
      marcador_probable: '1-1',
      forma_local: 'N/D',
      forma_visitante: 'N/D'
    };
  }

  // Blend IA result with base calculations (70% IA, 30% base)
  const finalProbs = {
    local_gana: Math.round(iaResult.probabilidades.local_gana * 0.7 + probsBase.local_gana * 0.3),
    empate: Math.round(iaResult.probabilidades.empate * 0.7 + probsBase.empate * 0.3),
    visitante_gana: Math.round(iaResult.probabilidades.visitante_gana * 0.7 + probsBase.visitante_gana * 0.3)
  };

  // Normalize to 100%
  const totalProb = finalProbs.local_gana + finalProbs.empate + finalProbs.visitante_gana;
  finalProbs.local_gana = Math.round((finalProbs.local_gana / totalProb) * 100);
  finalProbs.empate = Math.round((finalProbs.empate / totalProb) * 100);
  finalProbs.visitante_gana = 100 - finalProbs.local_gana - finalProbs.empate;

  iaResult.probabilidades = finalProbs;

  // Save to database
  await query(
    `INSERT INTO analisis_ia (encuentro_id, provider_ia, model_used, probabilidades, goles_esperados,
       apuestas_sugeridas, factores_clave, factores_riesgo, confianza_porcentaje, tokens_usados)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (encuentro_id) DO UPDATE SET
       probabilidades = EXCLUDED.probabilidades,
       goles_esperados = EXCLUDED.goles_esperados,
       apuestas_sugeridas = EXCLUDED.apuestas_sugeridas,
       factores_clave = EXCLUDED.factores_clave,
       factores_riesgo = EXCLUDED.factores_riesgo,
       confianza_porcentaje = EXCLUDED.confianza_porcentaje,
       updated_at = NOW()`,
    [
      encuentroId,
      process.env.IA_PROVIDER || 'claude',
      process.env.IA_MODEL || 'claude-sonnet-4-6',
      JSON.stringify(iaResult.probabilidades),
      JSON.stringify(iaResult.goles_esperados),
      JSON.stringify(iaResult.apuestas_recomendadas),
      JSON.stringify(iaResult.factores_clave),
      JSON.stringify(iaResult.factores_riesgo || []),
      iaResult.confianza_analisis,
      tokensUsed
    ]
  );

  const result = {
    encuentro_id: encuentroId,
    local: matchData.local,
    visitante: matchData.visitante,
    ...iaResult
  };

  // Cache for 10 minutes
  await setCache(`analysis:${encuentroId}`, result, 600);

  return result;
};

const getAnalysis = async (encuentroId) => {
  const result = await query(
    `SELECT a.*,
      el.nombre as local_nombre, el.logo_url as local_logo,
      ev.nombre as visitante_nombre, ev.logo_url as visitante_logo,
      e.fecha_hora, e.liga, e.estadio, e.estado
     FROM analisis_ia a
     JOIN encuentros e ON a.encuentro_id = e.id
     JOIN equipos el ON e.equipo_local_id = el.id
     JOIN equipos ev ON e.equipo_visitante_id = ev.id
     WHERE a.encuentro_id = $1`,
    [encuentroId]
  );
  return result.rows[0] || null;
};

module.exports = { analyzeMatch, getAnalysis, buildAnalysisPrompt };
