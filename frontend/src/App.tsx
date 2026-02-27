import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

import { useAuthStore, useNotificationStore } from './store';
import { authAPI } from './services/api';

import Navbar from './components/common/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SuggestedBets from './pages/SuggestedBets';
import MyBets from './pages/MyBets';
import Cart from './pages/Cart';
import Admin from './pages/Admin';

import './styles/globals.css';

let socket: Socket | null = null;

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.rol)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-950">
    <Navbar />
    {children}
  </div>
);

const App: React.FC = () => {
  const { isAuthenticated, setUser, logout } = useAuthStore();
  const { setNotifications, addNotification } = useNotificationStore();

  // Load user profile on app start
  useEffect(() => {
    const initAuth = async () => {
      if (localStorage.getItem('accessToken')) {
        try {
          const res = await authAPI.getProfile();
          setUser(res.data);
        } catch {
          logout();
        }
      } else {
        setUser(null);
      }
    };
    initAuth();
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) { socket.disconnect(); socket = null; }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    socket = io(process.env.REACT_APP_WS_URL || '', {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('notification', (n) => {
      addNotification(n);
    });

    socket.on('match.status.updated', (data) => {
      console.log('Match update:', data);
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AppLayout><Dashboard /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/apuestas-sugeridas" element={
          <ProtectedRoute>
            <AppLayout><SuggestedBets /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/mis-apuestas" element={
          <ProtectedRoute>
            <AppLayout><MyBets /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/carrito" element={
          <ProtectedRoute>
            <AppLayout><Cart /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute roles={['ADMIN', 'SUPERADMIN']}>
            <AppLayout><Admin /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' },
          duration: 4000
        }}
      />
    </BrowserRouter>
  );
};

export default App;
