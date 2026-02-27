export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: 'SUPERADMIN' | 'ADMIN' | 'USUARIO' | 'ANALYST';
  estado: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
  moneda: 'USD' | 'COP' | 'EUR';
  balance: number;
  two_factor_enabled: boolean;
  preferencias_notificaciones: {
    email: boolean;
    inapp: boolean;
    sms: boolean;
  };
}

export interface Team {
  id: string;
  nombre: string;
  nombre_corto?: string;
  logo_url?: string;
  deporte: string;
  pais?: string;
}

export interface Match {
  id: string;
  deporte: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  local_nombre: string;
  local_logo?: string;
  local_corto?: string;
  visitante_nombre: string;
  visitante_logo?: string;
  visitante_corto?: string;
  fecha_hora: string;
  estado: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED' | 'POSTPONED';
  goles_local?: number;
  goles_visitante?: number;
  estadio?: string;
  liga?: string;
  competencia?: string;
  confianza_porcentaje?: number;
  probabilidades?: {
    local_gana: number;
    empate: number;
    visitante_gana: number;
  };
  apuestas_sugeridas?: BetSuggestion[];
}

export interface Analysis {
  encuentro_id: string;
  local: { id: string; nombre: string; logo?: string };
  visitante: { id: string; nombre: string; logo?: string };
  probabilidades: {
    local_gana: number;
    empate: number;
    visitante_gana: number;
  };
  goles_esperados: {
    local: number;
    visitante: number;
    total: number;
    probabilidad_over_0_5: number;
    probabilidad_over_1_5: number;
    probabilidad_over_2_5: number;
    probabilidad_over_3_5: number;
    probabilidad_under_2_5: number;
    probabilidad_btts: number;
  };
  apuestas_recomendadas: BetSuggestion[];
  factores_clave: string[];
  factores_riesgo: string[];
  confianza_analisis: number;
  analisis_narrativo: string;
  marcador_probable: string;
  forma_local: string;
  forma_visitante: string;
}

export interface BetSuggestion {
  tipo: string;
  descripcion: string;
  seleccion: string;
  probabilidad_acierto: number;
  cuota_esperada: number;
  riesgo: 'BAJO' | 'MEDIO' | 'ALTO';
  razon?: string;
}

export interface Bet {
  id: string;
  usuario_id: string;
  encuentro_id: string;
  tipo_apuesta: string;
  descripcion: string;
  seleccion: string;
  cantidad_apostada: number;
  cuota_bloqueada: number;
  ganancia_potencial: number;
  estado: 'ACTIVA' | 'GANADA' | 'PERDIDA' | 'CANCELADA' | 'PENDIENTE';
  resultado?: string;
  ganancia_perdida?: number;
  notas?: string;
  created_at: string;
  resultado_timestamp?: string;
  fecha_hora?: string;
  liga?: string;
  deporte?: string;
  local_nombre?: string;
  visitante_nombre?: string;
}

export interface UserStats {
  ganadas: number;
  perdidas: number;
  activas: number;
  canceladas: number;
  total: number;
  total_apostado: number;
  total_ganado: number;
  total_perdido: number;
  ratio_acierto: number;
  roi: number;
  balance: number;
  moneda: string;
}

export interface Notification {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  datos: Record<string, any>;
  leida: boolean;
  created_at: string;
}

export interface CartItem {
  match: Match;
  suggestion: BetSuggestion;
  cantidad: number;
}
