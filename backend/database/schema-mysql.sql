-- =============================================
-- SPORTBETS AI PORTAL - MySQL Schema
-- Compatible con cPanel
-- =============================================

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'USUARIO' CHECK (rol IN ('SUPERADMIN','ADMIN','USUARIO','ANALYST')),
  estado VARCHAR(50) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO','SUSPENDIDO')),
  verificado_email BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  moneda VARCHAR(10) DEFAULT 'USD' CHECK (moneda IN ('USD','COP','EUR')),
  preferencias_notificaciones JSON DEFAULT '{"email": true, "inapp": true, "sms": false}',
  apuestas_favoritas JSON DEFAULT '[]',
  ip_address VARCHAR(45),
  dispositivos JSON DEFAULT '[]',
  login_attempts INT DEFAULT 0,
  locked_until DATETIME,
  balance DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ultimo_acceso DATETIME,
  KEY idx_email (email),
  KEY idx_estado (estado),
  KEY idx_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_user (user_id),
  KEY idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipos (
  id VARCHAR(100) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  nombre_corto VARCHAR(50),
  deporte VARCHAR(50) NOT NULL,
  pais VARCHAR(100),
  logo_url TEXT,
  liga_principal VARCHAR(255),
  datos_json JSON DEFAULT '{}',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_deporte (deporte),
  KEY idx_pais (pais),
  KEY idx_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS encuentros (
  id VARCHAR(100) PRIMARY KEY,
  deporte VARCHAR(50) NOT NULL,
  equipo_local_id VARCHAR(100) NOT NULL,
  equipo_visitante_id VARCHAR(100) NOT NULL,
  fecha_hora DATETIME NOT NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (estado IN ('SCHEDULED','LIVE','FINISHED','CANCELLED','POSTPONED')),
  resultado_final VARCHAR(50),
  goles_local INT,
  goles_visitante INT,
  estadio VARCHAR(255),
  liga VARCHAR(255),
  competencia VARCHAR(255),
  temporada VARCHAR(50),
  jornada INT,
  datos_meteorologicos JSON DEFAULT '{}',
  datos_json JSON DEFAULT '{}',
  fuente_api VARCHAR(100),
  api_external_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (equipo_local_id) REFERENCES equipos(id),
  FOREIGN KEY (equipo_visitante_id) REFERENCES equipos(id),
  KEY idx_fecha (fecha_hora),
  KEY idx_estado (estado),
  KEY idx_deporte (deporte),
  KEY idx_local (equipo_local_id),
  KEY idx_visitante (equipo_visitante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analisis_ia (
  id CHAR(36) PRIMARY KEY,
  encuentro_id VARCHAR(100) NOT NULL UNIQUE,
  provider_ia VARCHAR(50) NOT NULL DEFAULT 'claude',
  model_used VARCHAR(100),
  probabilidades JSON NOT NULL DEFAULT '{}',
  goles_esperados JSON NOT NULL DEFAULT '{}',
  apuestas_sugeridas JSON NOT NULL DEFAULT '[]',
  factores_clave JSON NOT NULL DEFAULT '[]',
  factores_riesgo JSON DEFAULT '[]',
  confianza_porcentaje INT NOT NULL DEFAULT 0 CHECK (confianza_porcentaje BETWEEN 0 AND 100),
  prompt_enviado LONGTEXT,
  respuesta_raw LONGTEXT,
  costo_api DECIMAL(10,6) DEFAULT 0,
  tokens_usados INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (encuentro_id) REFERENCES encuentros(id),
  KEY idx_confianza (confianza_porcentaje DESC),
  KEY idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apuestas (
  id CHAR(36) PRIMARY KEY,
  usuario_id CHAR(36) NOT NULL,
  encuentro_id VARCHAR(100) NOT NULL,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resultado_timestamp DATETIME,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES users(id),
  FOREIGN KEY (encuentro_id) REFERENCES encuentros(id),
  KEY idx_usuario (usuario_id),
  KEY idx_estado (estado),
  KEY idx_encuentro (encuentro_id),
  KEY idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estadisticas_equipo (
  id CHAR(36) PRIMARY KEY,
  equipo_id VARCHAR(100) NOT NULL,
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
  ultimos_resultados JSON DEFAULT '[]',
  datos_json JSON DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (equipo_id) REFERENCES equipos(id),
  UNIQUE KEY unique_stats (equipo_id, temporada, periodo),
  KEY idx_equipo (equipo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historial_directo (
  id CHAR(36) PRIMARY KEY,
  equipo_local_id VARCHAR(100) NOT NULL,
  equipo_visitante_id VARCHAR(100) NOT NULL,
  fecha DATETIME NOT NULL,
  goles_local INT DEFAULT 0,
  goles_visitante INT DEFAULT 0,
  liga VARCHAR(255),
  resultado VARCHAR(10),
  datos_json JSON DEFAULT '{}',
  FOREIGN KEY (equipo_local_id) REFERENCES equipos(id),
  FOREIGN KEY (equipo_visitante_id) REFERENCES equipos(id),
  KEY idx_equipos (equipo_local_id, equipo_visitante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cuotas (
  id CHAR(36) PRIMARY KEY,
  encuentro_id VARCHAR(100) NOT NULL,
  bookmaker VARCHAR(100) NOT NULL,
  tipo_apuesta VARCHAR(100) NOT NULL,
  seleccion VARCHAR(255) NOT NULL,
  cuota DECIMAL(10,2) NOT NULL,
  timestamp_captura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activa BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (encuentro_id) REFERENCES encuentros(id),
  KEY idx_encuentro (encuentro_id),
  KEY idx_tipo (tipo_apuesta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id CHAR(36) PRIMARY KEY,
  usuario_id CHAR(36),
  accion VARCHAR(255) NOT NULL,
  entidad VARCHAR(100),
  entidad_id VARCHAR(255),
  datos_antes JSON,
  datos_despues JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  resultado VARCHAR(50) DEFAULT 'SUCCESS',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES users(id),
  KEY idx_usuario (usuario_id),
  KEY idx_accion (accion),
  KEY idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificaciones (
  id CHAR(36) PRIMARY KEY,
  usuario_id CHAR(36) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT NOT NULL,
  datos JSON DEFAULT '{}',
  leida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_usuario (usuario_id),
  KEY idx_leida (leida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS config_sistema (
  id INT PRIMARY KEY AUTO_INCREMENT,
  clave VARCHAR(255) UNIQUE NOT NULL,
  valor TEXT,
  tipo VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
