import React, { useState, useEffect } from 'react';
import { betsAPI } from '../services/api';
import { Bet, UserStats } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FaTrophy, FaTimesCircle, FaClock, FaBan, FaChartLine, FaWallet, FaPercent } from 'react-icons/fa';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  GANADA: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: FaTrophy, label: 'Ganada' },
  PERDIDA: { color: 'text-red-400', bg: 'bg-red-400/10', icon: FaTimesCircle, label: 'Perdida' },
  ACTIVA: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: FaClock, label: 'Activa' },
  CANCELADA: { color: 'text-slate-400', bg: 'bg-slate-400/10', icon: FaBan, label: 'Cancelada' },
  PENDIENTE: { color: 'text-blue-400', bg: 'bg-blue-400/10', icon: FaClock, label: 'Pendiente' }
};

const BetRow: React.FC<{ bet: Bet; onCancel: (id: string) => void }> = ({ bet, onCancel }) => {
  const config = STATUS_CONFIG[bet.estado] || STATUS_CONFIG.ACTIVA;
  const Icon = config.icon;

  return (
    <div className="card mb-3 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${config.color} ${config.bg}`}>
              <Icon size={10} />
              {config.label}
            </span>
            <span className="text-xs text-slate-500">{bet.tipo_apuesta}</span>
            {bet.deporte && <span className="text-xs text-slate-600">{bet.deporte}</span>}
          </div>
          <h3 className="font-medium text-white text-sm">
            {bet.local_nombre} vs {bet.visitante_nombre}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{bet.descripcion}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            <span>Selección: <strong className="text-slate-200">{bet.seleccion}</strong></span>
            <span>Cuota: <strong className="text-yellow-400">{bet.cuota_bloqueada?.toFixed(2)}</strong></span>
            {bet.fecha_hora && (
              <span>{new Date(bet.fecha_hora).toLocaleDateString('es-CO')}</span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold text-white">${parseFloat(String(bet.cantidad_apostada)).toFixed(2)}</div>
          <div className="text-xs text-slate-400">apostado</div>
          {bet.estado === 'ACTIVA' && (
            <div className="text-xs text-emerald-400 mt-1">+${parseFloat(String(bet.ganancia_potencial)).toFixed(2)} posible</div>
          )}
          {bet.estado === 'GANADA' && bet.ganancia_perdida && (
            <div className="text-xs text-emerald-400 font-bold mt-1">+${parseFloat(String(bet.ganancia_perdida)).toFixed(2)} ganado</div>
          )}
          {bet.estado === 'PERDIDA' && bet.ganancia_perdida && (
            <div className="text-xs text-red-400 font-bold mt-1">${parseFloat(String(bet.ganancia_perdida)).toFixed(2)}</div>
          )}
        </div>
      </div>

      {bet.estado === 'ACTIVA' && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <button
            onClick={() => onCancel(bet.id)}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Cancelar apuesta
          </button>
        </div>
      )}
    </div>
  );
};

const MyBets: React.FC = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const TABS = [
    { value: '', label: 'Todas' },
    { value: 'ACTIVA', label: 'Activas' },
    { value: 'GANADA', label: 'Ganadas' },
    { value: 'PERDIDA', label: 'Perdidas' },
    { value: 'CANCELADA', label: 'Canceladas' }
  ];

  useEffect(() => {
    loadData();
  }, [activeTab, page]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [betsRes, statsRes] = await Promise.all([
        betsAPI.getMyBets({ estado: activeTab || undefined, page, limit: 20 }),
        betsAPI.getStats()
      ]);
      setBets(betsRes.data.bets || []);
      setTotal(betsRes.data.total || 0);
      setStats(statsRes.data);
    } catch (err) {
      toast.error('Error al cargar apuestas');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('¿Cancelar esta apuesta?')) return;
    try {
      await betsAPI.cancel(id);
      toast.success('Apuesta cancelada');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al cancelar');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pt-20 px-4 pb-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Mis Apuestas</h1>
          <p className="text-slate-400 text-sm">Historial y estadísticas de tus apuestas</p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="stat-card">
              <FaWallet className="text-indigo-400 mx-auto mb-2" size={20} />
              <div className="text-xl font-bold text-white">${stats.balance?.toFixed(2)}</div>
              <div className="text-xs text-slate-400">Balance</div>
            </div>
            <div className="stat-card">
              <FaPercent className="text-yellow-400 mx-auto mb-2" size={20} />
              <div className="text-xl font-bold text-white">{stats.ratio_acierto?.toFixed(1)}%</div>
              <div className="text-xs text-slate-400">Aciertos</div>
            </div>
            <div className="stat-card">
              <FaChartLine className={`mx-auto mb-2 ${parseFloat(String(stats.roi)) >= 0 ? 'text-emerald-400' : 'text-red-400'}`} size={20} />
              <div className={`text-xl font-bold ${parseFloat(String(stats.roi)) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.roi >= 0 ? '+' : ''}{stats.roi?.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-400">ROI</div>
            </div>
            <div className="stat-card">
              <FaTrophy className="text-emerald-400 mx-auto mb-2" size={20} />
              <div className="text-xl font-bold text-white">{stats.ganadas}/{stats.total}</div>
              <div className="text-xs text-slate-400">Ganadas/Total</div>
            </div>
          </div>
        )}

        {/* Extended Stats */}
        {stats && (
          <div className="card mb-6 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-400 text-xs mb-1">Total Apostado</div>
              <div className="font-semibold text-white">${parseFloat(String(stats.total_apostado)).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs mb-1">Total Ganado</div>
              <div className="font-semibold text-emerald-400">${parseFloat(String(stats.total_ganado)).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs mb-1">Total Perdido</div>
              <div className="font-semibold text-red-400">${Math.abs(parseFloat(String(stats.total_perdido))).toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-800 pb-2">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => { setActiveTab(tab.value); setPage(1); }}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === tab.value ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bets List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/3 mb-2" />
                <div className="h-5 bg-slate-700 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-700 rounded w-full" />
              </div>
            ))}
          </div>
        ) : bets.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-slate-400">No hay apuestas en esta categoría</p>
          </div>
        ) : (
          <>
            {bets.map(bet => <BetRow key={bet.id} bet={bet} onCancel={handleCancel} />)}
            {total > bets.length && (
              <div className="text-center mt-4">
                <button onClick={() => setPage(p => p + 1)} className="btn-secondary">
                  Cargar más ({bets.length}/{total})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MyBets;
