import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken: newAccess, refreshToken: newRefresh } = res.data;
        setTokens(newAccess, newRefresh);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshErr) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Auth APIs
export const authAPI = {
  register: (data: { email: string; password: string; nombre: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  login2FA: (data: { userId: string; token: string }) =>
    api.post('/auth/login/2fa', data),
  refreshToken: () =>
    api.post('/auth/refresh-token', { refreshToken }),
  logout: () =>
    api.post('/auth/logout', { refreshToken }),
  getProfile: () =>
    api.get('/auth/profile'),
  updateProfile: (data: any) =>
    api.put('/auth/profile', data),
  setup2FA: () =>
    api.post('/auth/2fa/setup'),
  verify2FA: (token: string) =>
    api.post('/auth/2fa/verify', { token })
};

// Matches APIs
export const matchesAPI = {
  getToday: (params?: any) =>
    api.get('/encuentros/hoy', { params }),
  getUpcoming: (params?: any) =>
    api.get('/encuentros/proximos', { params }),
  getLive: () =>
    api.get('/encuentros/en-vivo'),
  getById: (id: string) =>
    api.get(`/encuentros/${id}`),
  getAnalysis: (id: string, refresh?: boolean) =>
    api.get(`/encuentros/${id}/analisis`, { params: { refresh } }),
  getSuggestedBets: (id: string) =>
    api.get(`/encuentros/${id}/apuestas-sugeridas`),
  getH2H: (team1: string, team2: string) =>
    api.get('/encuentros/h2h', { params: { team1, team2 } })
};

// Bets APIs
export const betsAPI = {
  create: (data: any) =>
    api.post('/apuestas/crear', data),
  getMyBets: (params?: any) =>
    api.get('/apuestas/mis-apuestas', { params }),
  getStats: () =>
    api.get('/apuestas/estadisticas'),
  getById: (id: string) =>
    api.get(`/apuestas/${id}`),
  cancel: (id: string) =>
    api.delete(`/apuestas/${id}/cancelar`),
  resolve: (id: string, data: any) =>
    api.put(`/apuestas/${id}/resolver`, data)
};

// Notifications APIs
export const notificationsAPI = {
  getUnread: () =>
    api.get('/notificaciones'),
  markAsRead: (id: string) =>
    api.put(`/notificaciones/${id}/leer`)
};

// Admin APIs
export const adminAPI = {
  getUsers: (params?: any) =>
    api.get('/admin/usuarios', { params }),
  getUserById: (id: string) =>
    api.get(`/admin/usuarios/${id}`),
  createUser: (data: any) =>
    api.post('/admin/usuarios', data),
  updateUser: (id: string, data: any) =>
    api.put(`/admin/usuarios/${id}`, data),
  deleteUser: (id: string) =>
    api.delete(`/admin/usuarios/${id}`),
  getReports: () =>
    api.get('/admin/reportes'),
  getAuditLogs: (params?: any) =>
    api.get('/admin/logs', { params }),
  syncMatches: (sport?: string) =>
    api.post('/admin/sincronizar', { sport })
};

export default api;
