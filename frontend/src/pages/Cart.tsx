import React, { useState } from 'react';
import { useCartStore, useAuthStore } from '../store';
import { betsAPI } from '../services/api';
import { FaTrash, FaShoppingCart, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Cart: React.FC = () => {
  const { items, removeItem, clearCart, totalOdds, totalStake } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stakes, setStakes] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [betMode, setBetMode] = useState<'individual' | 'combinada'>('individual');

  const getStake = (idx: number) => stakes[idx] ?? 10;
  const setStake = (idx: number, val: number) => setStakes(prev => ({ ...prev, [idx]: val }));

  const placeBets = async () => {
    if (!user) { navigate('/login'); return; }
    if (items.length === 0) { toast.error('El carrito está vacío'); return; }

    setLoading(true);
    try {
      if (betMode === 'individual') {
        let successCount = 0;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const stake = getStake(i);
          try {
            await betsAPI.create({
              encuentro_id: item.match.id,
              tipo_apuesta: item.suggestion.tipo,
              descripcion: item.suggestion.descripcion,
              seleccion: item.suggestion.seleccion,
              cantidad_apostada: stake,
              cuota_bloqueada: item.suggestion.cuota_esperada
            });
            successCount++;
          } catch (err: any) {
            toast.error(`Error en apuesta ${i+1}: ${err.response?.data?.error}`);
          }
        }
        if (successCount > 0) {
          toast.success(`${successCount} apuesta(s) creada(s)`);
          clearCart();
          navigate('/mis-apuestas');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al procesar apuestas');
    } finally {
      setLoading(false);
    }
  };

  const totalPotentialWin = items.reduce((acc, item, idx) => {
    return acc + getStake(idx) * item.suggestion.cuota_esperada;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-950 pt-20 px-4 pb-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <FaShoppingCart className="text-indigo-400" size={24} />
          <h1 className="text-2xl font-bold text-white">Carrito de Apuestas</h1>
          {items.length > 0 && (
            <span className="bg-indigo-600 text-white text-xs rounded-full px-2 py-0.5">{items.length}</span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <FaShoppingCart className="text-slate-600 mx-auto mb-4" size={48} />
            <p className="text-slate-400">Tu carrito está vacío</p>
            <button onClick={() => navigate('/apuestas-sugeridas')} className="btn-primary mt-4">
              Ver Apuestas Sugeridas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Items */}
            <div className="lg:col-span-2 space-y-3">
              {/* Mode Toggle */}
              <div className="card flex gap-2">
                <button
                  onClick={() => setBetMode('individual')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${betMode === 'individual' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                >
                  Apuestas Individuales
                </button>
                <button
                  onClick={() => setBetMode('combinada')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${betMode === 'combinada' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                >
                  Combinada ({totalOdds().toFixed(2)}x)
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-xs text-slate-400 mb-1">{item.match.local_nombre} vs {item.match.visitante_nombre}</div>
                      <div className="font-medium text-white text-sm">{item.suggestion.descripcion}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">{item.suggestion.tipo}</span>
                        <span className={`risk-${item.suggestion.riesgo.toLowerCase()} text-xs`}>{item.suggestion.riesgo}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-yellow-400 font-mono font-bold">{item.suggestion.cuota_esperada?.toFixed(2)}</div>
                        <div className="text-xs text-emerald-400">{item.suggestion.probabilidad_acierto}%</div>
                      </div>
                      <button onClick={() => removeItem(idx)} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                        <FaTimes size={14} />
                      </button>
                    </div>
                  </div>

                  {betMode === 'individual' && (
                    <div className="mt-3 flex items-center gap-3">
                      <label className="text-xs text-slate-400">Monto ($):</label>
                      <input
                        type="number"
                        min={1}
                        value={getStake(idx)}
                        onChange={(e) => setStake(idx, parseFloat(e.target.value) || 0)}
                        className="input-field w-24 text-sm py-1.5"
                      />
                      <span className="text-xs text-emerald-400">
                        Posible: ${(getStake(idx) * item.suggestion.cuota_esperada).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <div className="card">
                <h3 className="font-semibold text-white mb-4">Resumen</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Apuestas:</span>
                    <span className="text-white">{items.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total apostado:</span>
                    <span className="text-white">${betMode === 'individual' ? items.reduce((a, _, i) => a + getStake(i), 0).toFixed(2) : getStake(0).toFixed(2)}</span>
                  </div>
                  {betMode === 'combinada' && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cuota total:</span>
                      <span className="text-yellow-400 font-mono">{totalOdds().toFixed(2)}x</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
                    <span className="text-slate-400">Ganancia posible:</span>
                    <span className="text-emerald-400 font-bold">${totalPotentialWin.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <button onClick={placeBets} disabled={loading} className="btn-success w-full">
                    {loading ? 'Procesando...' : 'Confirmar Apuestas'}
                  </button>
                  <button onClick={clearCart} className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
                    <FaTrash size={12} />
                    Limpiar Carrito
                  </button>
                </div>
              </div>

              <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3 text-xs text-yellow-300">
                ⚠️ Las apuestas son solo para entretenimiento. Juega responsablemente.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
