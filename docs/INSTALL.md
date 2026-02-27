# Guía de Instalación - SportBets AI Portal

## Requisitos del Sistema

| Componente | Versión Mínima | Recomendado |
|-----------|----------------|-------------|
| Node.js | 18.x | 20.x LTS |
| PostgreSQL | 13 | 15 |
| Redis | 6 | 7 |
| RAM | 2 GB | 4 GB+ |
| Disco | 5 GB | 20 GB+ |
| OS | Ubuntu 20.04 | Ubuntu 22.04 LTS |

---

## Instalación Automática (Recomendado)

```bash
# 1. Clonar repositorio
git clone <repo-url> /var/www/sportbets
cd /var/www/sportbets

# 2. Ejecutar instalador (como root)
sudo bash installer/install.sh
```

El instalador configura automáticamente:
- PostgreSQL + base de datos
- Redis con contraseña
- Nginx + SSL (Let's Encrypt)
- Servicio systemd (auto-inicio)
- Backup diario automático
- Cuenta de administrador

---

## Instalación Manual

### 1. Instalar dependencias del sistema

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs postgresql redis-server nginx certbot

# Verificar versiones
node -v && npm -v && psql --version
```

### 2. Configurar PostgreSQL

```bash
sudo -u postgres psql
```
```sql
CREATE USER sportbets_user WITH PASSWORD 'tu_contraseña_segura';
CREATE DATABASE sportbets_db OWNER sportbets_user;
GRANT ALL PRIVILEGES ON DATABASE sportbets_db TO sportbets_user;
\q
```

```bash
# Aplicar schema
PGPASSWORD=tu_contraseña psql -U sportbets_user -d sportbets_db \
  -f backend/database/schema.sql
PGPASSWORD=tu_contraseña psql -U sportbets_user -d sportbets_db \
  -f backend/database/seed.sql
```

### 3. Configurar archivo .env

```bash
cp installer/config-template.env .env
nano .env  # Completar todos los valores
```

Valores críticos a cambiar:
- `DB_PASSWORD`: contraseña PostgreSQL
- `REDIS_PASSWORD`: contraseña Redis
- `JWT_SECRET`: cadena aleatoria de 64+ caracteres
- `ENCRYPTION_KEY`: hex de 64 caracteres (`openssl rand -hex 32`)
- `IA_API_KEY`: tu API key de Claude/OpenAI
- `SPORTS_API_KEY`: tu key de RapidAPI
- `DOMAIN`: tu dominio real

### 4. Instalar dependencias Node.js

```bash
# Backend
cd backend && npm install --production && cd ..

# Frontend
cd frontend && npm install && npm run build && cd ..
```

### 5. Crear cuenta de administrador

```bash
cd backend && node utils/createAdmin.js
```

### 6. Configurar Nginx

```bash
# Copiar configuración
sudo cp docker/nginx.conf /etc/nginx/sites-available/sportbets
# Editar y reemplazar ${DOMAIN} con tu dominio
sudo nano /etc/nginx/sites-available/sportbets

sudo ln -s /etc/nginx/sites-available/sportbets /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 7. Configurar SSL

```bash
sudo certbot certonly --nginx -d tudominio.com
# Certificados en: /etc/letsencrypt/live/tudominio.com/
```

### 8. Configurar servicio systemd

```bash
sudo cat > /etc/systemd/system/sportbets.service << EOF
[Unit]
Description=SportBets AI Portal
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/sportbets/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
EnvironmentFile=/var/www/sportbets/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable sportbets
sudo systemctl start sportbets
```

---

## Instalación con Docker

```bash
# Copiar y editar configuración
cp installer/config-template.env .env
# Editar .env con tus valores...

# Levantar servicios
cd docker && docker-compose up -d

# Ver logs
docker-compose logs -f backend
```

---

## Verificación de Instalación

```bash
# Verificar servicio
systemctl status sportbets

# Health check
curl https://tudominio.com/api/v1/health

# Ver logs
journalctl -u sportbets -f
```

---

## Comandos de Mantenimiento

```bash
# Reiniciar servicio
sudo systemctl restart sportbets

# Ver logs en tiempo real
sudo journalctl -u sportbets -f

# Backup manual
sudo /usr/local/bin/sportbets-backup.sh

# Sincronizar partidos manualmente
curl -X POST https://tudominio.com/api/v1/admin/sincronizar \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"sport": "football"}'

# Actualizar aplicación
cd /var/www/sportbets
git pull origin main
cd backend && npm install --production
cd ../frontend && npm install && npm run build
sudo systemctl restart sportbets
```

---

## Obtener APIs

### API de IA (Claude - Recomendado)
1. Ir a [console.anthropic.com](https://console.anthropic.com)
2. Crear cuenta y obtener API key
3. Modelo recomendado: `claude-sonnet-4-6`

### API Deportes (RapidAPI)
1. Ir a [rapidapi.com](https://rapidapi.com)
2. Buscar "API-Football" o "API-Sports"
3. Suscribirse al plan gratuito (100 requests/día)
4. Obtener X-RapidAPI-Key

---

## Solución de Problemas

**El servicio no inicia:**
```bash
journalctl -u sportbets -n 50  # Ver últimos 50 líneas de logs
node backend/server.js          # Probar manualmente
```

**Error de base de datos:**
```bash
# Verificar conexión
PGPASSWORD=pass psql -h localhost -U sportbets_user -d sportbets_db -c "SELECT 1;"
```

**Error de Redis:**
```bash
redis-cli -a tu_password ping  # Debe responder PONG
```

**Certificado SSL no se renueva:**
```bash
sudo certbot renew --dry-run
```
