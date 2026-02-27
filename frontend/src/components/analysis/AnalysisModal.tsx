import React, { useState, useEffect } from 'react';
import { Analysis, Match, BetSuggestion } from '../../types';
import { matchesAPI } from '../../services/api';
import { useCartStore } from '../../store';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { FaTimes, FaShoppingCart, FaSpinner, FaExclamationTriangle, FaCheckCircle, FaBolt } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface Props {
  match: Match;
  onClose: () => void;
}

const RISK_COLORS = { BAJO: '#10b981', MEDIO: '#f59e0b', ALTO: '#ef4444' };
const PIE_COLORS = ['#6366f1', '#475569', '#10b981'];

const RiskBadge: React.FC<{ riesgo: string }> = ({ riesgo }) => (
  <span className={`risk-${riesgo.toLowerCase()} text-xs`}>{riesgo}</span>
);

const BetCard: React.FC<{ bet: BetSuggestion; match: Match; onAdd: () => void }> = ({ bet, match, onAdd }) => (
  <div className="border border-slate-700 rounded-lg p-3 hover:border-indigo-500/50 transition-all">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-slate-500 uppercase">{bet.tipo}</span>
          <RiskBadge riesgo={bet.riesgo} />
        </div>
        <div className="font-medium text-white text-sm">{bet.descripcion}</div>
        {bet.razon && <div className="text-xs text-slate-400 mt-1">{bet.razon}</div>}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-yellow-400 font-mono font-bold">{bet.cuota_esperada?.toFixed(2)}</div>
        <div className="text-emerald-400 text-xs">{bet.probabilidad_acierto}%</div>
      </div>
    </div>
    <div className="mt-2 flex items-center justify-between">
      <div className="flex-1 bg-slate-700 rounded-full h-1 mr-2">
        <div
          className={`h-1 rounded-full ${bet.probabilidad_acierto >= 70 ? 'bg-emerald-500' : bet.probabilidad_acierto >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${bet.probabilidad_acierto}%` }}
        />
      </div>
      <button onClick={onAdd} className="btn-primary text-xs py-1 px-2 flex items-center gap-1">
        <FaShoppingCart size={10} />
        Agregar
      </button>
    </div>
  </div>
);

const TABS = ['Probabilidades', 'Apuestas', 'Factores', 'Análisis IA'];

const AnalysisModal: React.FC<Props> = ({ match, onClose }) => {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const { addItem } = useCartStore();

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        setLoading(true);
        const res = await matchesAPI.getAnalysis(match.id);
        setAnalysis(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar el análisis');
      } finally {
        setLoading(false);
      }
    };
    loadAnalysis();
  }, [match.id]);

  const handleAddBet = (bet: BetSuggestion) => {
    addItem({ match, suggestion: bet, cantidad: 10 });
    toast.success(`Apuesta agregada al carrito`);
  };

  const pieData = analysis ? [
    { name: match.local_nombre, value: analysis.probabilidades.local_gana },
    { name: 'Empate', value: analysis.probabilidades.empate },
    { name: match.visitante_nombre, value: analysis.probabilidades.visitante_gana }
  ] : [];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {match.local_nombre} <span className="text-slate-500">vs</span> {match.visitante_nombre}
              </h2>
              <p className="text-sm text-slate-400">{match.liga} · {new Date(match.fecha_hora).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2">
              <FaTimes size={20} />
            </button>
          </div>

          {analysis && (
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <FaBolt className="text-yellow-400" size={14} />
                <span className="text-sm text-slate-300">Confianza: <strong className="text-white">{analysis.confianza_analisis}%</strong></span>
              </div>
              {analysis.marcador_probable && (
                <span className="text-sm text-slate-400">Marcador probable: <strong className="text-white">{analysis.marcador_probable}</strong></span>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 px-6">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center py-12 gap-4">
              <FaSpinner className="animate-spin text-indigo-400" size={32} />
              <p className="text-slate-400">Generando análisis con IA...</p>
              <p className="text-xs text-slate-500">Procesando datos históricos y estadísticas</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <FaExclamationTriangle className="text-red-400" />
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {analysis && !loading && (
            <>
              {/* Tab 0: Probabilidades */}
              {activeTab === 0 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-300 mb-4">Probabilidades</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                            {pieData.map((_, index) => <Cell key={index} fill={PIE_COLORS[index]} />)}
                          </Pie>
                          <Tooltip formatter={(value: any) => [`${value}%`, '']} contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center gap-4 mt-2">
                        {pieData.map((d, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i] }} />
                            <span className="text-xs text-slate-400">{d.name}: {d.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-300">Goles Esperados</h3>
                      {[
                        { label: `${match.local_nombre}`, value: analysis.goles_esperados.local },
                        { label: `${match.visitante_nombre}`, value: analysis.goles_esperados.visitante },
                        { label: 'Total', value: analysis.goles_esperados.total },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">{label}</span>
                          <span className="font-bold text-white">{value?.toFixed(1)}</span>
                        </div>
                      ))}
                      <div className="border-t border-slate-700 pt-3 space-y-2">
                        {[
                          { label: 'Over 1.5', value: analysis.goles_esperados.probabilidad_over_1_5 },
                          { label: 'Over 2.5', value: analysis.goles_esperados.probabilidad_over_2_5 },
                          { label: 'Over 3.5', value: analysis.goles_esperados.probabilidad_over_3_5 },
                          { label: 'BTTS', value: analysis.goles_esperados.probabilidad_btts },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-16">{label}</span>
                            <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${value}%` }} />
                            </div>
                            <span className="text-xs text-white w-8 text-right">{value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 1: Apuestas */}
              {activeTab === 1 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">
                    {analysis.apuestas_recomendadas?.length || 0} Apuestas Recomendadas
                  </h3>
                  {analysis.apuestas_recomendadas?.map((bet, i) => (
                    <BetCard key={i} bet={bet} match={match} onAdd={() => handleAddBet(bet)} />
                  ))}
                </div>
              )}

              {/* Tab 2: Factores */}
              {activeTab === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                      <FaCheckCircle /> Factores Clave
                    </h3>
                    <ul className="space-y-2">
                      {analysis.factores_clave?.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                      <FaExclamationTriangle /> Factores de Riesgo
                    </h3>
                    <ul className="space-y-2">
                      {analysis.factores_riesgo?.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-red-400 mt-0.5">•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Tab 3: Análisis IA */}
              {activeTab === 3 && (
                <div className="space-y-4">
                  <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-indigo-400 mb-3">Análisis Narrativo</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {analysis.analisis_narrativo || 'Análisis generado basado en datos históricos y estadísticas disponibles.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="stat-card">
                      <div className="text-xs text-slate-400 mb-1">Forma Local</div>
                      <div className="text-sm font-medium text-white">{analysis.forma_local || 'N/D'}</div>
                    </div>
                    <div className="stat-card">
                      <div className="text-xs text-slate-400 mb-1">Forma Visitante</div>
                      <div className="text-sm font-medium text-white">{analysis.forma_visitante || 'N/D'}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
