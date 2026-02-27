import React, { useState, useEffect } from 'react';
import { matchesAPI } from '../services/api';
import { Match } from '../types';
import MatchCard from '../components/common/MatchCard';
import AnalysisModal from '../components/analysis/AnalysisModal';
import { useAuthStore } from '../store';
import { FaFutbol, FaBasketballBall, FaSync, FaFilter } from 'react-icons/fa';
import toast from 'react-hot-toast';

const SPORTS = [
  { id: '', label: 'Todos', icon: '🏆' },
  { id: 'football', label: 'Fútbol', icon: '⚽' },
  { id: 'basketball', label: 'Baloncesto', icon: '🏀' },
  { id: 'american_football', label: 'NFL', icon: '🏈' },
  { id: 'tennis', label: 'Tenis', icon: '🎾' },
];

const ESTADOS = [
  { id: '', label: 'Todos' },
  { id: 'LIVE', label: 'En Vivo' },
  { id: 'SCHEDULED', label: 'Próximos' },
  { id: 'FINISHED', label: 'Finalizados' },
];

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = async () => {
    try {
      const params: any = {};
      if (selectedSport) params.deporte = selectedSport;
      if (selectedEstado) params.estado = selectedEstado;
      const res = await matchesAPI.getToday(params);
      setMatches(res.data.matches || []);
    } catch (err: any) {
      toast.error('Error al cargar partidos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadMatches(); }, [selectedSport, selectedEstado]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMatches();
    toast.success('Partidos actualizados');
  };

  const filteredMatches = matches.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.local_nombre?.toLowerCase().includes(q) ||
      m.visitante_nombre?.toLowerCase().includes(q) ||
      m.liga?.toLowerCase().includes(q);
  });

  const liveCount = matches.filter(m => m.estado === 'LIVE').length;
  const scheduledCount = matches.filter(m => m.estado === 'SCHEDULED').length;

  return (
    <div className="min-h-screen bg-slate-950 pt-20 px-4 pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            Buen día, <span className="text-indigo-400">{user?.nombre?.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Hoy hay <strong className="text-white">{matches.length}</strong> partidos disponibles
            {liveCount > 0 && <span className="ml-2 text-red-400">· {liveCount} en vivo</span>}
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <div className="text-2xl font-bold text-white">{matches.length}</div>
            <div className="text-xs text-slate-400">Partidos Hoy</div>
          </div>
          <div className="stat-card">
            <div className="text-2xl font-bold text-red-400 flex items-center gap-2">
              {liveCount}
              {liveCount > 0 && <div className="live-dot" />}
            </div>
            <div className="text-xs text-slate-400">En Vivo</div>
          </div>
          <div className="stat-card">
            <div className="text-2xl font-bold text-emerald-400">{scheduledCount}</div>
            <div className="text-xs text-slate-400">Próximos</div>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="flex-1 min-w-48">
              <input
                type="text"
                placeholder="Buscar equipo o liga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field text-sm"
              />
            </div>

            {/* Sport filter */}
            <div className="flex gap-2 flex-wrap">
              {SPORTS.map(sport => (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSport(sport.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedSport === sport.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{sport.icon}</span>
                  <span className="hidden sm:inline">{sport.label}</span>
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex gap-2">
              {ESTADOS.map(estado => (
                <button
                  key={estado.id}
                  onClick={() => setSelectedEstado(estado.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedEstado === estado.id
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-800 text-slate-500 hover:text-white'
                  }`}
                >
                  {estado.label}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <FaSync className={refreshing ? 'animate-spin' : ''} size={12} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Matches Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-slate-700 rounded mb-3 w-3/4" />
                <div className="flex justify-between py-3">
                  <div className="h-10 w-10 bg-slate-700 rounded-full" />
                  <div className="h-8 w-12 bg-slate-700 rounded" />
                  <div className="h-10 w-10 bg-slate-700 rounded-full" />
                </div>
                <div className="h-2 bg-slate-700 rounded mt-3" />
              </div>
            ))}
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">⚽</div>
            <h3 className="text-xl font-semibold text-slate-300">No hay partidos disponibles</h3>
            <p className="text-slate-500 mt-2">
              {searchQuery ? 'No se encontraron partidos con ese criterio' : 'No hay partidos programados para hoy con los filtros seleccionados'}
            </p>
          </div>
        ) : (
          <>
            {/* Live Section */}
            {filteredMatches.some(m => m.estado === 'LIVE') && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
                  <div className="live-dot" />
                  EN VIVO ({filteredMatches.filter(m => m.estado === 'LIVE').length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredMatches.filter(m => m.estado === 'LIVE').map(match => (
                    <MatchCard key={match.id} match={match} onAnalyze={setSelectedMatch} />
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled/Other Section */}
            <div>
              {filteredMatches.some(m => m.estado !== 'LIVE') && (
                <h2 className="text-sm font-semibold text-slate-400 mb-3">
                  TODOS LOS PARTIDOS ({filteredMatches.filter(m => m.estado !== 'LIVE').length})
                </h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMatches.filter(m => m.estado !== 'LIVE').map(match => (
                  <MatchCard key={match.id} match={match} onAnalyze={setSelectedMatch} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {selectedMatch && (
        <AnalysisModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </div>
  );
};

export default Dashboard;
