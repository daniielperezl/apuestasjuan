import { create } from 'zustand';
import { User, CartItem, Notification } from '../types';
import { clearTokens, setTokens } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (tokens: { accessToken: string; refreshToken: string }, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),

  login: (tokens, user) => {
    setTokens(tokens.accessToken, tokens.refreshToken);
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    clearTokens();
    set({ user: null, isAuthenticated: false });
  }
}));

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  clearCart: () => void;
  totalOdds: () => number;
  totalStake: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => set((state) => {
    const exists = state.items.some(
      i => i.match.id === item.match.id && i.suggestion.seleccion === item.suggestion.seleccion
    );
    if (exists) return state;
    return { items: [...state.items, item] };
  }),

  removeItem: (index) => set((state) => ({
    items: state.items.filter((_, i) => i !== index)
  })),

  clearCart: () => set({ items: [] }),

  totalOdds: () => {
    const items = get().items;
    if (!items.length) return 0;
    return items.reduce((acc, item) => acc * item.suggestion.cuota_esperada, 1);
  },

  totalStake: () => {
    const items = get().items;
    return items.reduce((acc, item) => acc + item.cantidad, 0);
  }
}));

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  setNotifications: (ns: Notification[]) => void;
  markRead: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) => set((state) => ({
    notifications: [n, ...state.notifications],
    unreadCount: state.unreadCount + 1
  })),

  setNotifications: (ns) => set({ notifications: ns, unreadCount: ns.filter(n => !n.leida).length }),

  markRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, leida: true } : n),
    unreadCount: Math.max(0, state.unreadCount - 1)
  }))
}));

interface UIState {
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  toggleSidebar: () => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    return { theme: newTheme };
  })
}));
