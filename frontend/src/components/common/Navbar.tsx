import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaBell, FaUserCircle, FaShoppingCart, FaBars, FaTimes, FaSignOutAlt, FaCog, FaChartBar } from 'react-icons/fa';
import Clock from './Clock';
import { useAuthStore, useNotificationStore, useCartStore, useUIStore } from '../../store';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const { items } = useCartStore();
  const { toggleSidebar } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {}
    logout();
    navigate('/login');
    toast.success('Sesión cerrada');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button onClick={toggleSidebar} className="text-slate-400 hover:text-white transition-colors">
            <FaBars size={20} />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SB</span>
            </div>
            <span className="font-bold text-white hidden sm:block">SportBets<span className="text-indigo-400">AI</span></span>
          </Link>
        </div>

        {/* Center - Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/apuestas-sugeridas', label: 'Sugeridas' },
            { to: '/mis-apuestas', label: 'Mis Apuestas' },
          ].map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {(user?.rol === 'ADMIN' || user?.rol === 'SUPERADMIN') && (
            <Link to="/admin" className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname.startsWith('/admin') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              Admin
            </Link>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <Clock />

          {/* Notifications */}
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative text-slate-400 hover:text-white transition-colors p-2"
          >
            <FaBell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Cart */}
          <Link to="/carrito" className="relative text-slate-400 hover:text-white transition-colors p-2">
            <FaShoppingCart size={18} />
            {items.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {items.length}
              </span>
            )}
          </Link>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            >
              <FaUserCircle size={28} />
              <span className="hidden sm:block text-sm font-medium">{user?.nombre?.split(' ')[0]}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700">
                  <div className="text-sm font-medium text-white">{user?.nombre}</div>
                  <div className="text-xs text-slate-400">{user?.email}</div>
                  <div className="text-xs text-indigo-400 mt-1">{user?.rol}</div>
                </div>
                <Link to="/perfil" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                  <FaCog size={14} />
                  Configuración
                </Link>
                <Link to="/mis-apuestas" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                  <FaChartBar size={14} />
                  Mis Apuestas
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                  <FaSignOutAlt size={14} />
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
