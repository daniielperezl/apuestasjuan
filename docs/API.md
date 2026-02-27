# SportBets AI Portal - Documentación API

## Base URL
```
https://tudominio.com/api/v1
```

## Autenticación
La API usa JWT (Bearer tokens). Incluye el token en el header:
```
Authorization: Bearer <access_token>
```

Los access tokens expiran en **15 minutos**. Usa el refresh token para obtener nuevos.

---

## Endpoints de Autenticación

### POST /auth/register
Registrar nuevo usuario.

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "MiContraseña123!",
  "nombre": "Juan Pérez"
}
```

**Respuesta (201):**
```json
{
  "message": "Usuario registrado exitosamente",
  "user": { "id": "uuid", "email": "...", "nombre": "...", "rol": "USUARIO" }
}
```

### POST /auth/login
Iniciar sesión.

**Body:**
```json
{ "email": "usuario@email.com", "password": "MiContraseña123!" }
```

**Respuesta (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "uuid-...",
  "user": { "id": "...", "email": "...", "nombre": "...", "rol": "USUARIO" }
}
```

### POST /auth/refresh-token
Renovar access token.

**Body:**
```json
{ "refreshToken": "uuid-..." }
```

### POST /auth/logout
Cerrar sesión (requiere auth).

### GET /auth/profile
Obtener perfil del usuario autenticado.

### PUT /auth/profile
Actualizar perfil.

### POST /auth/2fa/setup
Configurar autenticación de dos factores (devuelve QR).

### POST /auth/2fa/verify
Verificar y activar 2FA.

---

## Endpoints de Encuentros

### GET /encuentros/hoy
Obtener todos los partidos del día.

**Query Params:**
- `deporte`: football | basketball | tennis | american_football
- `liga`: filtrar por liga (búsqueda parcial)
- `estado`: SCHEDULED | LIVE | FINISHED
- `page`: número de página (default: 1)
- `limit`: resultados por página (default: 50, max: 100)

**Respuesta:**
```json
{
  "total": 25,
  "page": 1,
  "limit": 50,
  "matches": [
    {
      "id": "football-12345",
      "deporte": "football",
      "local_nombre": "Barcelona",
      "visitante_nombre": "Real Madrid",
      "fecha_hora": "2026-02-27T18:00:00Z",
      "estado": "SCHEDULED",
      "liga": "La Liga",
      "confianza_porcentaje": 82,
      "probabilidades": {
        "local_gana": 52,
        "empate": 23,
        "visitante_gana": 25
      }
    }
  ]
}
```

### GET /encuentros/proximos
Próximos partidos (hasta 7 días).

**Query Params:**
- `days`: días a futuro (default: 3)
- `deporte`: filtrar por deporte
- `limit`: resultados (default: 20)

### GET /encuentros/en-vivo
Partidos actualmente en vivo.

### GET /encuentros/:id
Detalles de un encuentro específico.

### GET /encuentros/:id/analisis
**Requiere autenticación**

Análisis completo de IA para el encuentro.

**Query Params:**
- `refresh`: `true` para forzar nuevo análisis

**Respuesta:**
```json
{
  "encuentro_id": "football-12345",
  "probabilidades": {
    "local_gana": 52,
    "empate": 23,
    "visitante_gana": 25
  },
  "goles_esperados": {
    "local": 1.8,
    "visitante": 1.1,
    "total": 2.9,
    "probabilidad_over_1_5": 88,
    "probabilidad_over_2_5": 65,
    "probabilidad_btts": 62
  },
  "apuestas_recomendadas": [
    {
      "tipo": "RESULTADO",
      "descripcion": "Victoria Local",
      "seleccion": "1",
      "probabilidad_acierto": 52,
      "cuota_esperada": 1.85,
      "riesgo": "MEDIO",
      "razon": "Fuerte rendimiento local reciente"
    }
  ],
  "factores_clave": ["Ventaja de local", "Excelente forma reciente"],
  "factores_riesgo": ["Jugadores lesionados clave"],
  "confianza_analisis": 82,
  "analisis_narrativo": "...",
  "marcador_probable": "2-1"
}
```

### GET /encuentros/:id/apuestas-sugeridas
**Requiere autenticación**

Top apuestas sugeridas para el encuentro.

### GET /encuentros/h2h
Historial directo entre dos equipos.

**Query Params:**
- `team1`: ID equipo local
- `team2`: ID equipo visitante

---

## Endpoints de Apuestas

### POST /apuestas/crear
**Requiere autenticación**

Crear nueva apuesta.

**Body:**
```json
{
  "encuentro_id": "football-12345",
  "tipo_apuesta": "RESULTADO",
  "descripcion": "Victoria Local",
  "seleccion": "1",
  "cantidad_apostada": 25.00,
  "cuota_bloqueada": 1.85,
  "notas": "Opcional"
}
```

### GET /apuestas/mis-apuestas
**Requiere autenticación**

Historial de apuestas del usuario.

**Query Params:**
- `estado`: ACTIVA | GANADA | PERDIDA | CANCELADA
- `page`, `limit`

### GET /apuestas/estadisticas
**Requiere autenticación**

Estadísticas personales del usuario.

**Respuesta:**
```json
{
  "ganadas": 12,
  "perdidas": 8,
  "activas": 3,
  "total": 23,
  "total_apostado": 450.00,
  "total_ganado": 380.00,
  "ratio_acierto": 60.00,
  "roi": 12.50,
  "balance": 580.00,
  "moneda": "USD"
}
```

### GET /apuestas/:id
Detalle de una apuesta.

### DELETE /apuestas/:id/cancelar
Cancelar apuesta activa (reintegra el monto).

---

## Endpoints Administrador
**Requieren rol ADMIN o SUPERADMIN**

### GET /admin/usuarios
Lista de usuarios con filtros.

### POST /admin/usuarios
Crear usuario.

### PUT /admin/usuarios/:id
Actualizar usuario (rol, estado, balance).

### DELETE /admin/usuarios/:id
Desactivar usuario.

### GET /admin/reportes
Estadísticas generales del sistema.

### GET /admin/logs
Logs de auditoría.

### POST /admin/sincronizar
Sincronizar partidos de la API deportiva.

---

## WebSocket Events

Conectar: `wss://tudominio.com/socket.io`

**Auth:**
```js
const socket = io('https://tudominio.com', {
  auth: { token: 'eyJ...' }
});
```

**Eventos del servidor:**
```js
socket.on('notification', (data) => { /* nueva notificación */ });
socket.on('match.status.updated', ({ matchId, status, score }) => {});
socket.on('bet.result.decided', ({ betId, resultado, ganancia }) => {});
```

**Eventos del cliente:**
```js
socket.emit('subscribe:match', matchId);   // Suscribirse a updates de un partido
socket.emit('unsubscribe:match', matchId); // Desuscribirse
```

---

## Códigos de Error

| Código | Significado |
|--------|-------------|
| 400 | Datos inválidos |
| 401 | No autenticado / Token expirado |
| 403 | Sin permisos |
| 404 | Recurso no encontrado |
| 429 | Rate limit excedido |
| 500 | Error interno del servidor |

**Formato de error:**
```json
{
  "error": "Descripción del error",
  "code": "TOKEN_EXPIRED",
  "details": [{ "field": "email", "message": "Email inválido" }]
}
```
