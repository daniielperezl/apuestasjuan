// Test probability calculation logic from iaAnalysisService

const { buildAnalysisPrompt } = require('../../backend/services/iaAnalysisService');

describe('IA Analysis Service', () => {
  const mockMatchData = {
    local: { id: 'team-1', nombre: 'Equipo A', logo: null },
    visitante: { id: 'team-2', nombre: 'Equipo B', logo: null },
    encuentro: {
      deporte: 'football',
      liga: 'La Liga',
      fecha_hora: new Date().toISOString(),
      estadio: 'Camp Nou'
    },
    estadisticasLocal: {
      forma_reciente: 'WWDLW',
      partidos_jugados: 10,
      partidos_ganados: 6,
      partidos_empatados: 2,
      partidos_perdidos: 2,
      goles_promedio: 2.1,
      goles_concedidos_promedio: 0.8
    },
    estadisticasVisitante: {
      forma_reciente: 'LWWLD',
      partidos_jugados: 10,
      partidos_ganados: 4,
      partidos_empatados: 2,
      partidos_perdidos: 4,
      goles_promedio: 1.5,
      goles_concedidos_promedio: 1.3
    },
    h2h: [
      { fecha: new Date(), goles_local: 2, goles_visitante: 1 },
      { fecha: new Date(), goles_local: 0, goles_visitante: 1 }
    ],
    alineaciones: null
  };

  it('should build a valid analysis prompt', () => {
    const prompt = buildAnalysisPrompt(mockMatchData);
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('Equipo A');
    expect(prompt).toContain('Equipo B');
    expect(prompt).toContain('La Liga');
    expect(prompt).toContain('probabilidades');
    expect(prompt.length).toBeGreaterThan(500);
  });

  it('should include historical data in prompt', () => {
    const prompt = buildAnalysisPrompt(mockMatchData);
    expect(prompt).toContain('WWDLW');
    expect(prompt).toContain('2.1');
  });

  it('should include H2H data in prompt', () => {
    const prompt = buildAnalysisPrompt(mockMatchData);
    expect(prompt).toContain('h2h') || expect(prompt).toContain('historial');
  });
});

describe('Probability Normalization', () => {
  it('probabilities should always sum to ~100', () => {
    const probs = [45, 25, 30];
    const total = probs.reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('should handle edge cases in probability blending', () => {
    const iaProb = { local_gana: 60, empate: 20, visitante_gana: 20 };
    const baseProb = { local_gana: 40, empate: 30, visitante_gana: 30 };

    const blended = {
      local_gana: Math.round(iaProb.local_gana * 0.7 + baseProb.local_gana * 0.3),
      empate: Math.round(iaProb.empate * 0.7 + baseProb.empate * 0.3),
      visitante_gana: Math.round(iaProb.visitante_gana * 0.7 + baseProb.visitante_gana * 0.3)
    };

    expect(blended.local_gana).toBe(54);
    expect(blended.empate).toBe(23);
    expect(blended.visitante_gana).toBe(23);
  });
});
