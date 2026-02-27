import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { FaUsers, FaChartBar, FaSync, FaList, FaUserPlus, FaEdit, FaBan } from 'react-icons/fa';
import toast from 'react-hot-toast';

const TABS = ['Dashboard', 'Usuarios', 'Logs', 'Sincronizar'];

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [reports, setReports] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 0) {
        const res = await adminAPI.getReports();
        setReports(res.data);
      } else if (activeTab === 1) {
        const res = await adminAPI.getUsers({ search });
        setUsers(res.data.users || []);
      } else if (activeTab === 2) {
        const res = await adminAPI.getAuditLogs();
        setLogs(res.data || []);
      }
    } catch (err) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (sport: string) => {
    try {
      setLoading(true);
      const res = await adminAPI.syncMatches(sport);
      toast.success(res.data.message);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al sincronizar');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = async (id: string, currentEstado: string) => {
    const newEstado = currentEstado === 'ACTIVO' ? 'SUSPENDIDO' : 'ACTIVO';
    try {
      await adminAPI.updateUser(id, { estado: newEstado });
      toast.success(`Usuario ${newEstado.toLowerCase()}`);
      loadData();
    } catch (err) {
      toast.error('Error al actualizar usuario');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pt-20 px-4 pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">A</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
            <p className="text-slate-400 text-sm">Gestión del sistema SportBets AI</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-800 pb-2">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === i ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {i === 0 && <FaChartBar size={12} />}
              {i === 1 && <FaUsers size={12} />}
              {i === 2 && <FaList size={12} />}
              {i === 3 && <FaSync size={12} />}
              {tab}
            </button>
          ))}
        </div>

        {/* Tab 0: Dashboard */}
        {activeTab === 0 && reports && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <FaUsers className="text-indigo-400" /> Usuarios
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="text-white font-bold">{reports.usuarios?.total}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Activos</span><span className="text-emerald-400">{reports.usuarios?.activos}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Nuevos (30d)</span><span className="text-indigo-400">{reports.usuarios?.nuevos_mes}</span></div>
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Apuestas</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="text-white font-bold">{reports.apuestas?.total}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Ganadas</span><span className="text-emerald-400">{reports.apuestas?.ganadas}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Perdidas</span><span className="text-red-400">{reports.apuestas?.perdidas}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Activas</span><span className="text-yellow-400">{reports.apuestas?.activas}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Volumen</span><span className="text-white">${parseFloat(reports.apuestas?.volumen_total || 0).toFixed(2)}</span></div>
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Encuentros</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="text-white font-bold">{reports.encuentros?.total}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Finalizados</span><span className="text-slate-400">{reports.encuentros?.finalizados}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">En Vivo</span><span className="text-red-400 flex items-center gap-1"><div className="live-dot w-2 h-2" />{reports.encuentros?.en_vivo}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Próximos</span><span className="text-emerald-400">{reports.encuentros?.proximos}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Users */}
        {activeTab === 1 && (
          <div>
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="Buscar usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field max-w-xs text-sm"
              />
              <button onClick={loadData} className="btn-secondary text-sm flex items-center gap-2">
                <FaSync size={12} />
                Buscar
              </button>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Email', 'Nombre', 'Rol', 'Estado', 'Balance', 'Últ. Acceso', 'Acciones'].map(h => (
                      <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-3 px-3 text-slate-300">{user.email}</td>
                      <td className="py-3 px-3 text-white">{user.nombre}</td>
                      <td className="py-3 px-3">
                        <span className="text-xs bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded">{user.rol}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${user.estado === 'ACTIVO' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
                          {user.estado}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">${parseFloat(user.balance || 0).toFixed(2)}</td>
                      <td className="py-3 px-3 text-slate-500 text-xs">
                        {user.ultimo_acceso ? new Date(user.ultimo_acceso).toLocaleDateString('es-CO') : 'Nunca'}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleToggleUser(user.id, user.estado)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${user.estado === 'ACTIVO' ? 'text-red-400 hover:bg-red-400/10' : 'text-emerald-400 hover:bg-emerald-400/10'}`}
                        >
                          {user.estado === 'ACTIVO' ? 'Suspender' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Logs */}
        {activeTab === 2 && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Fecha', 'Usuario', 'Acción', 'Entidad', 'Resultado'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-slate-800">
                    <td className="py-2 px-3 text-slate-500 text-xs">{new Date(log.created_at).toLocaleString('es-CO')}</td>
                    <td className="py-2 px-3 text-slate-300 text-xs">{log.usuario_email || 'Sistema'}</td>
                    <td className="py-2 px-3"><span className="text-xs font-mono text-indigo-400">{log.accion}</span></td>
                    <td className="py-2 px-3 text-slate-400 text-xs">{log.entidad}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs ${log.resultado === 'SUCCESS' ? 'text-emerald-400' : 'text-red-400'}`}>{log.resultado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Sync */}
        {activeTab === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { sport: 'football', icon: '⚽', label: 'Sincronizar Fútbol', desc: 'Importar partidos de fútbol del día' },
              { sport: 'basketball', icon: '🏀', label: 'Sincronizar Baloncesto', desc: 'Importar partidos de NBA y ligas' },
              { sport: 'tennis', icon: '🎾', label: 'Sincronizar Tenis', desc: 'Importar torneos ATP/WTA' },
              { sport: 'american_football', icon: '🏈', label: 'Sincronizar NFL', desc: 'Importar partidos de NFL' }
            ].map(s => (
              <div key={s.sport} className="card">
                <div className="text-3xl mb-2">{s.icon}</div>
                <h3 className="font-semibold text-white">{s.label}</h3>
                <p className="text-xs text-slate-400 mb-4">{s.desc}</p>
                <button
                  onClick={() => handleSync(s.sport)}
                  disabled={loading}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <FaSync size={12} className={loading ? 'animate-spin' : ''} />
                  Sincronizar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
