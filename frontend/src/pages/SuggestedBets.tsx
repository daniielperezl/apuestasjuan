import React, { useState, useEffect } from 'react';
import { matchesAPI } from '../services/api';
import { Match, BetSuggestion } from '../types';
import AnalysisModal from '../components/analysis/AnalysisModal';
import { useCartStore } from '../store';
import { FaChartLine, FaShoppingCart, FaFilter, FaSortAmountDown } from 'react-icons/fa';
import toast from 'react-hot-toast';

const RISK_COLORS = {
  BAJO: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  MEDIO: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  ALTO: 'text-red-400 bg-red-400/10 border-red-400/30'
};

interface BetWithMatch {
  match: Match;
  bet: BetSuggestion;
  confianza: number;
}

const SuggestedBets: React.FC = () => {
  const [allBets, setAllBets] = useState<BetWithMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>('');
  const [filterSport, setFilterSport] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('confianza');
  const [expandedBet, setExpandedBet] = useState<string | null>(null);
  const { addItem } = useCartStore();

  useEffect(() => {
    loadSuggestedBets();
  }, []);

  const loadSuggestedBets = async () => {
    try {
      setLoading(true);
      // Get today's matches that have analysis
      const matchRes = await matchesAPI.getToday({ limit: 50 });
      const matches: Match[] = matchRes.data.matches || [];

      const betsWithMatches: BetWithMatch[] = [];

      for (const match of matches) {
        if (match.apuestas_sugeridas && match.apuestas_sugeridas.length > 0) {
          match.apuestas_sugeridas.slice(0, 3).forEach(bet => {
            betsWithMatches.push({
              match,
              bet,
              confianza: match.confianza_porcentaje || 0
            });
          });
        }
      }

      setAllBets(betsWithMatches);
    } catch (err) {
      toast.error('Error al cargar apuestas sugeridas');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (item: BetWithMatch) => {
    addItem({ match: item.match, suggestion: item.bet, cantidad: 10 });
    toast.success('Agregado al carrito');
  };

  const filtered = allBets
    .filter(b => {
      if (filterRisk && b.bet.riesgo !== filterRisk) return false;
      if (filterSport && b.match.deporte !== filterSport) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'confianza') return b.confianza - a.confianza;
      if (sortBy === 'probabilidad') return b.bet.probabilidad_acierto - a.bet.probabilidad_acierto;
      if (sortBy === 'cuota') return b.bet.cuota_esperada - a.bet.cuota_esperada;
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-950 pt-20 px-4 pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FaChartLine className="text-indigo-400" />
            Apuestas Sugeridas por IA
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {filtered.length} apuestas encontradas basadas en análisis de IA
          </p>
        </div>

        {/* Filters */}
        <div className="card mb-6 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <FaFilter size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400">Riesgo:</span>
            {['', 'BAJO', 'MEDIO', 'ALTO'].map(r => (
              <button
                key={r}
                onClick={() => setFilterRisk(r)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${filterRisk === r ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                {r || 'Todos'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-4">
            <FaSortAmountDown size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400">Ordenar:</span>
            {[
              { value: 'confianza', label: 'Confianza' },
              { value: 'probabilidad', label: 'Probabilidad' },
              { value: 'cuota', label: 'Cuota' }
            ].map(s => (
              <button
                key={s.value}
                onClick={() => setSortBy(s.value)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${sortBy === s.value ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bets List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/2 mb-3" />
                <div className="h-8 bg-slate-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-700 rounded w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-slate-400">No hay apuestas sugeridas disponibles con los filtros actuales</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item, idx) => (
              <div key={`${item.match.id}-${idx}`} className="card hover:border-indigo-500/30 transition-all animate-fade-in">
                {/* Match Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-bold text-white">
                      {item.match.local_nombre} <span className="text-slate-500">vs</span> {item.match.visitante_nombre}
                    </span>
                    <div className="text-xs text-slate-400">
                      {item.match.liga} · {new Date(item.match.fecha_hora).toLocaleString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {item.confianza > 0 && (
                    <div className="text-xs text-slate-400">
                      Confianza: <span className="text-yellow-400 font-bold">{item.confianza}%</span>
                    </div>
                  )}
                </div>

                {/* Bet Info */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{item.bet.tipo}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${RISK_COLORS[item.bet.riesgo] || RISK_COLORS.MEDIO}`}>
                        {item.bet.riesgo}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white">{item.bet.descripcion}</h3>
                    {item.bet.razon && (
                      <p className="text-xs text-slate-400 mt-1">{item.bet.razon}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${item.bet.probabilidad_acierto >= 70 ? 'bg-emerald-500' : item.bet.probabilidad_acierto >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${item.bet.probabilidad_acierto}%` }}
                        />
                      </div>
                      <span className="text-xs text-emerald-400 font-medium">{item.bet.probabilidad_acierto}% prob.</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold font-mono text-yellow-400">{item.bet.cuota_esperada?.toFixed(2)}</div>
                    <div className="text-xs text-slate-400">cuota esperada</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                  <button
                    onClick={() => setSelectedMatch(item.match)}
                    className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2"
                  >
                    <FaChartLine size={12} />
                    Ver Análisis
                  </button>
                  <button
                    onClick={() => handleAddToCart(item)}
                    className="flex-1 btn-primary text-sm flex items-center justify-center gap-2"
                  >
                    <FaShoppingCart size={12} />
                    Agregar al Carrito
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMatch && (
        <AnalysisModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </div>
  );
};

export default SuggestedBets;
