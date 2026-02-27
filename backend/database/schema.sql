-- =============================================
-- SPORTBETS AI PORTAL - Database Schema
-- PostgreSQL 13+
-- =============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'USUARIO' CHECK (rol IN ('SUPERADMIN','ADMIN','USUARIO','ANALYST')),
  estado VARCHAR(50) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO','SUSPENDIDO')),
  verificado_email BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  moneda VARCHAR(10) DEFAULT 'USD' CHECK (moneda IN ('USD','COP','EUR')),
  preferencias_notificaciones JSONB DEFAULT '{"email": true, "inapp": true, "sms": false}'::JSONB,
  apuestas_favoritas TEXT[] DEFAULT '{}',
  ip_address VARCHAR(45),
  dispositivos JSONB DEFAULT '[]'::JSONB,
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP,
  balance DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_estado ON users(estado);
CREATE INDEX IF NOT EXISTS idx_users_rol ON users(rol);

-- =============================================
-- REFRESH TOKENS
-- =============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- =============================================
-- EQUIPOS / TEAMS
-- =============================================
CREATE TABLE IF NOT EXISTS equipos (
  id VARCHAR(100) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  nombre_corto VARCHAR(50),
  deporte VARCHAR(50) NOT NULL,
  pais VARCHAR(100),
  logo_url TEXT,
  liga_principal VARCHAR(255),
  datos_json JSONB DEFAULT '{}'::JSONB,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipos_deporte ON equipos(deporte);
CREATE INDEX IF NOT EXISTS idx_equipos_pais ON equipos(pais);
CREATE INDEX IF NOT EXISTS idx_equipos_nombre ON equipos(nombre);

-- =============================================
-- ENCUENTROS / MATCHES
-- =============================================
CREATE TABLE IF NOT EXISTS encuentros (
  id VARCHAR(100) PRIMARY KEY,
  deporte VARCHAR(50) NOT NULL,
  equipo_local_id VARCHAR(100) NOT NULL REFERENCES equipos(id),
  equipo_visitante_id VARCHAR(100) NOT NULL REFERENCES equipos(id),
  fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (estado IN ('SCHEDULED','LIVE','FINISHED','CANCELLED','POSTPONED')),
  resultado_final VARCHAR(50),
  goles_local INT,
  goles_visitante INT,
  estadio VARCHAR(255),
  liga VARCHAR(255),
  competencia VARCHAR(255),
  temporada VARCHAR(50),
  jornada INT,
  datos_meteorologicos JSONB DEFAULT '{}'::JSONB,
  datos_json JSONB DEFAULT '{}'::JSONB,
  fuente_api VARCHAR(100),
  api_external_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_encuentros_fecha ON encuentros(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_encuentros_estado ON encuentros(estado);
CREATE INDEX IF NOT EXISTS idx_encuentros_deporte ON encuentros(deporte);
CREATE INDEX IF NOT EXISTS idx_encuentros_local ON encuentros(equipo_local_id);
CREATE INDEX IF NOT EXISTS idx_encuentros_visitante ON encuentros(equipo_visitante_id);

-- =============================================
-- ANALISIS IA
-- =============================================
CREATE TABLE IF NOT EXISTS analisis_ia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  encuentro_id VARCHAR(100) NOT NULL REFERENCES encuentros(id),
  provider_ia VARCHAR(50) NOT NULL DEFAULT 'claude',
  model_used VARCHAR(100),
  probabilidades JSONB NOT NULL DEFAULT '{}'::JSONB,
  goles_esperados JSONB NOT NULL DEFAULT '{}'::JSONB,
  apuestas_sugeridas JSONB NOT NULL DEFAULT '[]'::JSONB,
  factores_clave JSONB NOT NULL DEFAULT '[]'::JSONB,
  factores_riesgo JSONB DEFAULT '[]'::JSONB,
  confianza_porcentaje INT NOT NULL DEFAULT 0 CHECK (confianza_porcentaje BETWEEN 0 AND 100),
  prompt_enviado TEXT,
  respuesta_raw TEXT,
  costo_api DECIMAL(10,6) DEFAULT 0,
  tokens_usados INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analisis_encuentro ON analisis_ia(encuentro_id);
CREATE INDEX IF NOT EXISTS idx_analisis_confianza ON analisis_ia(confianza_porcentaje DESC);
CREATE INDEX IF NOT EXISTS idx_analisis_created ON analisis_ia(created_at DESC);

-- =============================================
-- APUESTAS DE USUARIOS
-- =============================================
CREATE TABLE IF NOT EXISTS apuestas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES users(id),
  encuentro_id VARCHAR(100) NOT NULL REFERENCES encuentros(id),
  tipo_apuesta VARCHAR(100) NOT NULL,
  descripcion TEXT NOT NULL,
  seleccion VARCHAR(255) NOT NULL,
  cantidad_apostada DECIMAL(15,2) NOT NULL CHECK (cantidad_apostada > 0),
  cuota_bloqueada DECIMAL(10,2) NOT NULL,
  ganancia_potencial DECIMAL(15,2),
  estado VARCHAR(50) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','GANADA','PERDIDA','CANCELADA','PENDIENTE')),
  resultado VARCHAR(50),
  ganancia_perdida DECIMAL(15,2),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resultado_timestamp TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_apuestas_usuario ON apuestas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_apuestas_estado ON apuestas(estado);
CREATE INDEX IF NOT EXISTS idx_apuestas_encuentro ON apuestas(encuentro_id);
CREATE INDEX IF NOT EXISTS idx_apuestas_created ON apuestas(created_at DESC);

-- =============================================
-- ESTADISTICAS EQUIPO
-- =============================================
CREATE TABLE IF NOT EXISTS estadisticas_equipo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipo_id VARCHAR(100) NOT NULL REFERENCES equipos(id),
  temporada VARCHAR(50) NOT NULL,
  periodo VARCHAR(50) NOT NULL DEFAULT 'SEASON',
  partidos_jugados INT DEFAULT 0,
  partidos_ganados INT DEFAULT 0,
  partidos_empatados INT DEFAULT 0,
  partidos_perdidos INT DEFAULT 0,
  goles_favor INT DEFAULT 0,
  goles_contra INT DEFAULT 0,
  goles_promedio DECIMAL(5,2) DEFAULT 0,
  goles_concedidos_promedio DECIMAL(5,2) DEFAULT 0,
  tarjetas_amarillas_promedio DECIMAL(5,2) DEFAULT 0,
  tarjetas_rojas_promedio DECIMAL(5,2) DEFAULT 0,
  corneres_promedio DECIMAL(5,2) DEFAULT 0,
  posesion_promedio DECIMAL(5,2) DEFAULT 0,
  tiros_porteria_promedio DECIMAL(5,2) DEFAULT 0,
  forma_reciente VARCHAR(20),
  ultimos_resultados JSONB DEFAULT '[]'::JSONB,
  datos_json JSONB DEFAULT '{}'::JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(equipo_id, temporada, periodo)
);

CREATE INDEX IF NOT EXISTS idx_stats_equipo ON estadisticas_equipo(equipo_id);

-- =============================================
-- HISTORIAL DIRECTO (H2H)
-- =============================================
CREATE TABLE IF NOT EXISTS historial_directo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipo_local_id VARCHAR(100) NOT NULL REFERENCES equipos(id),
  equipo_visitante_id VARCHAR(100) NOT NULL REFERENCES equipos(id),
  fecha TIMESTAMP WITH TIME ZONE NOT NULL,
  goles_local INT DEFAULT 0,
  goles_visitante INT DEFAULT 0,
  liga VARCHAR(255),
  resultado VARCHAR(10),
  datos_json JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_h2h_equipos ON historial_directo(equipo_local_id, equipo_visitante_id);

-- =============================================
-- CUOTAS
-- =============================================
CREATE TABLE IF NOT EXISTS cuotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  encuentro_id VARCHAR(100) NOT NULL REFERENCES encuentros(id),
  bookmaker VARCHAR(100) NOT NULL,
  tipo_apuesta VARCHAR(100) NOT NULL,
  seleccion VARCHAR(255) NOT NULL,
  cuota DECIMAL(10,2) NOT NULL,
  timestamp_captura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  activa BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_cuotas_encuentro ON cuotas(encuentro_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_tipo ON cuotas(tipo_apuesta);

-- =============================================
-- AUDIT LOG
-- =============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES users(id),
  accion VARCHAR(255) NOT NULL,
  entidad VARCHAR(100),
  entidad_id VARCHAR(255),
  datos_antes JSONB,
  datos_despues JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  resultado VARCHAR(50) DEFAULT 'SUCCESS',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_usuario ON audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_accion ON audit_log(accion);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- =============================================
-- NOTIFICACIONES
-- =============================================
CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo VARCHAR(100) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT NOT NULL,
  datos JSONB DEFAULT '{}'::JSONB,
  leida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_leida ON notificaciones(leida);

-- =============================================
-- TRIGGERS - auto-update timestamps
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_encuentros_updated_at BEFORE UPDATE ON encuentros
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_apuestas_updated_at BEFORE UPDATE ON apuestas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analisis_updated_at BEFORE UPDATE ON analisis_ia
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
