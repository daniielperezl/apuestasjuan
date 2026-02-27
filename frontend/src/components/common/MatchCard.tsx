import React from 'react';
import { Match } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaFutbol, FaBasketballBall, FaFootballBall, FaTrophy, FaStar, FaChartLine } from 'react-icons/fa';
import { useCartStore } from '../../store';

interface MatchCardProps {
  match: Match;
  onAnalyze?: (match: Match) => void;
  onAddToFavorites?: (matchId: string) => void;
}

const sportIcon = (deporte: string) => {
  switch (deporte) {
    case 'football': return <FaFutbol className="text-emerald-400" />;
    case 'basketball': return <FaBasketballBall className="text-orange-400" />;
    case 'american_football': return <FaFootballBall className="text-yellow-400" />;
    default: return <FaTrophy className="text-indigo-400" />;
  }
};

const StatusBadge: React.FC<{ estado: string }> = ({ estado }) => {
  if (estado === 'LIVE') return <span className="badge-live">EN VIVO</span>;
  if (estado === 'FINISHED') return <span className="badge-finished">FINALIZADO</span>;
  if (estado === 'CANCELLED') return <span className="bg-gray-600 text-gray-300 text-xs px-2 py-0.5 rounded-full">CANCELADO</span>;
  return <span className="badge-scheduled">PRÓXIMO</span>;
};

const ConfidenceMeter: React.FC<{ value?: number }> = ({ value }) => {
  if (!value) return null;
  const color = value >= 70 ? 'bg-emerald-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="confidence-bar flex-1">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-400">{value}% confianza</span>
    </div>
  );
};

const MatchCard: React.FC<MatchCardProps> = ({ match, onAnalyze, onAddToFavorites }) => {
  const { addItem } = useCartStore();

  const matchDate = new Date(match.fecha_hora);
  const timeStr = matchDate.toLocaleString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false });

  const topSuggestion = match.apuestas_sugeridas?.[0];

  return (
    <div className="card hover:border-indigo-500/50 cursor-pointer group animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {sportIcon(match.deporte)}
          <span className="text-xs text-slate-400 font-medium">{timeStr} · {match.liga || 'Liga'}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge estado={match.estado} />
          {onAddToFavorites && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToFavorites(match.id); }}
              className="text-slate-500 hover:text-yellow-400 transition-colors"
            >
              <FaStar size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3 flex-1">
          {match.local_logo ? (
            <img src={match.local_logo} alt={match.local_nombre} className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-slate-300">
              {match.local_corto || match.local_nombre?.charAt(0)}
            </div>
          )}
          <div>
            <div className="font-semibold text-white">{match.local_nombre}</div>
            {match.probabilidades && (
              <div className="text-xs text-slate-400">{match.probabilidades.local_gana}%</div>
            )}
          </div>
        </div>

        <div className="text-center px-4">
          {match.estado === 'LIVE' || match.estado === 'FINISHED' ? (
            <div className="text-2xl font-bold text-white">
              {match.goles_local ?? '-'} - {match.goles_visitante ?? '-'}
            </div>
          ) : (
            <div>
              <div className="text-slate-500 text-xs">VS</div>
              {match.probabilidades && (
                <div className="text-xs text-slate-400 mt-1">{match.probabilidades.empate}%</div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 justify-end">
          <div className="text-right">
            <div className="font-semibold text-white">{match.visitante_nombre}</div>
            {match.probabilidades && (
              <div className="text-xs text-slate-400">{match.probabilidades.visitante_gana}%</div>
            )}
          </div>
          {match.visitante_logo ? (
            <img src={match.visitante_logo} alt={match.visitante_nombre} className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-slate-300">
              {match.visitante_corto || match.visitante_nombre?.charAt(0)}
            </div>
          )}
        </div>
      </div>

      <ConfidenceMeter value={match.confianza_porcentaje} />

      {/* Top Suggestion Preview */}
      {topSuggestion && (
        <div className="mt-3 p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-300">
              <span className="text-emerald-400 font-medium">↑ {topSuggestion.descripcion}</span>
              <span className={`ml-2 risk-${topSuggestion.riesgo.toLowerCase()}`}>{topSuggestion.riesgo}</span>
            </div>
            <div className="text-xs font-mono text-yellow-400">{topSuggestion.cuota_esperada?.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onAnalyze?.(match)}
          className="flex-1 flex items-center justify-center gap-2 btn-primary text-sm py-1.5"
        >
          <FaChartLine size={12} />
          Ver Análisis
        </button>
        {topSuggestion && (
          <button
            onClick={() => addItem({ match, suggestion: topSuggestion, cantidad: 10 })}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            + Carrito
          </button>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
