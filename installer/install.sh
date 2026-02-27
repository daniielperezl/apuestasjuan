#!/bin/bash

# ============================================================
# SPORTBETS AI PORTAL - Auto-Installer
# Compatible: Ubuntu 20.04+, Debian 11+
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

print_header() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║   🚀 SPORTBETS AI PORTAL - INSTALADOR v1.0      ║${NC}"
  echo -e "${CYAN}║   Portal Profesional de Apuestas con IA          ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
}

check_root() {
  if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Este script requiere permisos de superusuario (root)${NC}"
    echo "   Ejecuta: sudo bash install.sh"
    exit 1
  fi
}

generate_password() {
  openssl rand -base64 32 | tr -d '/+=' | head -c 32
}

detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    OS_VER=$VERSION_ID
  else
    OS="Unknown"
  fi
  echo "Sistema detectado: $OS $OS_VER"
}

check_requirements() {
  echo -e "${BLUE}📋 Verificando requisitos del sistema...${NC}"

  # Check RAM
  RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
  if [ "$RAM_MB" -lt 2000 ]; then
    echo -e "${YELLOW}⚠️  RAM disponible: ${RAM_MB}MB (recomendado: 2048MB+)${NC}"
  else
    echo -e "${GREEN}✅ RAM: ${RAM_MB}MB${NC}"
  fi

  # Check disk space
  DISK_GB=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')
  if [ "$DISK_GB" -lt 5 ]; then
    echo -e "${RED}❌ Espacio en disco insuficiente: ${DISK_GB}GB (mínimo 5GB)${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ Disco: ${DISK_GB}GB disponibles${NC}"
}

install_dependencies() {
  echo -e "${BLUE}📦 Instalando dependencias del sistema...${NC}"

  apt-get update -qq

  # Node.js 20
  if ! command -v node &> /dev/null || [[ $(node -v) < "v18" ]]; then
    echo "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
  echo -e "${GREEN}✅ Node.js: $(node -v)${NC}"

  # PostgreSQL 15
  if ! command -v psql &> /dev/null; then
    echo "Instalando PostgreSQL 15..."
    apt-get install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
  fi
  echo -e "${GREEN}✅ PostgreSQL: $(psql --version | head -1)${NC}"

  # Redis
  if ! command -v redis-cli &> /dev/null; then
    echo "Instalando Redis..."
    apt-get install -y redis-server
    systemctl enable redis-server
    systemctl start redis-server
  fi
  echo -e "${GREEN}✅ Redis: $(redis-cli --version)${NC}"

  # Nginx
  if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
  fi
  echo -e "${GREEN}✅ Nginx instalado${NC}"

  # Certbot
  apt-get install -y certbot python3-certbot-nginx curl openssl
  echo -e "${GREEN}✅ Dependencias instaladas${NC}"
}

collect_config() {
  echo ""
  echo -e "${CYAN}⚙️  Configuración del Sistema${NC}"
  echo "─────────────────────────────────────"

  read -p "🌐 Dominio principal (ej: apuestas.tudominio.com): " DOMAIN
  read -p "📧 Email del administrador: " ADMIN_EMAIL

  echo ""
  echo "🤖 Selecciona proveedor de IA:"
  echo "   1) Claude (Anthropic) - Recomendado"
  echo "   2) OpenAI (GPT-4)"
  echo "   3) Google Gemini"
  read -p "Opción [1-3]: " IA_CHOICE

  case $IA_CHOICE in
    2) IA_PROVIDER="openai" ;;
    3) IA_PROVIDER="gemini" ;;
    *) IA_PROVIDER="claude" ;;
  esac

  read -p "🔑 API Key del proveedor IA: " IA_API_KEY
  read -p "🏈 API Key de deportes (RapidAPI): " SPORTS_API_KEY

  read -p "📨 SMTP Host (ej: smtp.gmail.com): " SMTP_HOST
  read -p "📨 SMTP Usuario: " SMTP_USER
  read -s -p "📨 SMTP Contraseña: " SMTP_PASS
  echo ""

  # Generate secure passwords
  DB_PASS=$(generate_password)
  REDIS_PASS=$(generate_password)
  JWT_SECRET=$(generate_password)
  ENCRYPT_KEY=$(generate_password)
  SESSION_SECRET=$(generate_password)
}

setup_database() {
  echo -e "${BLUE}🗄️  Configurando base de datos PostgreSQL...${NC}"

  sudo -u postgres psql -c "CREATE USER sportbets_user WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
  sudo -u postgres psql -c "CREATE DATABASE sportbets_db OWNER sportbets_user;" 2>/dev/null || true
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sportbets_db TO sportbets_user;" 2>/dev/null || true

  # Run schema
  PGPASSWORD="$DB_PASS" psql -h localhost -U sportbets_user -d sportbets_db \
    -f "$PROJECT_DIR/backend/database/schema.sql"

  PGPASSWORD="$DB_PASS" psql -h localhost -U sportbets_user -d sportbets_db \
    -f "$PROJECT_DIR/backend/database/seed.sql"

  echo -e "${GREEN}✅ Base de datos configurada${NC}"
}

setup_redis() {
  echo -e "${BLUE}🔴 Configurando Redis...${NC}"

  # Configure Redis password
  sed -i "s/# requirepass foobared/requirepass $REDIS_PASS/" /etc/redis/redis.conf
  systemctl restart redis-server

  echo -e "${GREEN}✅ Redis configurado${NC}"
}

create_env() {
  echo -e "${BLUE}📝 Creando archivo de configuración .env...${NC}"

  cat > "$PROJECT_DIR/.env" << EOF
# ============================================================
# SPORTBETS AI PORTAL - Configuración
# Generado: $(date)
# ============================================================

# Servidor
NODE_ENV=production
PORT=5000
DOMAIN=$DOMAIN
FRONTEND_URL=https://$DOMAIN
CORS_ORIGINS=https://$DOMAIN

# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_USER=sportbets_user
DB_PASSWORD=$DB_PASS
DB_NAME=sportbets_db
DB_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASS

# Autenticación
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES=15m
ENCRYPTION_KEY=$(openssl rand -hex 32)
SESSION_SECRET=$SESSION_SECRET

# IA
IA_PROVIDER=$IA_PROVIDER
IA_API_KEY=$IA_API_KEY
IA_MODEL=$([ "$IA_PROVIDER" = "claude" ] && echo "claude-sonnet-4-6" || echo "gpt-4o")

# APIs Deportivas
SPORTS_API_KEY=$SPORTS_API_KEY
SPORTS_API_URL=https://v3.football.api-sports.io

# Email
SMTP_HOST=$SMTP_HOST
SMTP_PORT=587
SMTP_USER=$SMTP_USER
SMTP_PASSWORD=$SMTP_PASS

# Zona Horaria
TIMEZONE=America/Bogota

# Cron Jobs
ENABLE_CRON=true

# Logging
LOG_LEVEL=info

# Admin
ADMIN_EMAIL=$ADMIN_EMAIL
EOF

  chmod 600 "$PROJECT_DIR/.env"
  echo -e "${GREEN}✅ .env creado${NC}"
}

install_node_deps() {
  echo -e "${BLUE}📦 Instalando dependencias Node.js...${NC}"

  cd "$PROJECT_DIR/backend"
  npm install --production
  echo -e "${GREEN}✅ Backend dependencies${NC}"

  cd "$PROJECT_DIR/frontend"
  npm install
  npm run build
  echo -e "${GREEN}✅ Frontend built${NC}"
}

setup_nginx() {
  echo -e "${BLUE}🌐 Configurando Nginx...${NC}"

  cat > "/etc/nginx/sites-available/sportbets" << EOF
server {
  listen 80;
  server_name $DOMAIN;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 301 https://\$host\$request_uri;
  }
}

server {
  listen 443 ssl http2;
  server_name $DOMAIN;

  ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;

  add_header X-Frame-Options DENY always;
  add_header X-Content-Type-Options nosniff always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  location /api/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }

  location /socket.io/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
  }

  location / {
    root $PROJECT_DIR/frontend/build;
    try_files \$uri \$uri/ /index.html;
    expires 1h;
    add_header Cache-Control "public, must-revalidate";
  }
}
EOF

  ln -sf /etc/nginx/sites-available/sportbets /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx

  echo -e "${GREEN}✅ Nginx configurado${NC}"
}

setup_ssl() {
  echo -e "${BLUE}🔒 Configurando certificado SSL (Let's Encrypt)...${NC}"

  mkdir -p /var/www/certbot
  nginx -t && systemctl reload nginx

  certbot certonly --webroot -w /var/www/certbot \
    -d "$DOMAIN" --email "$ADMIN_EMAIL" \
    --agree-tos --no-eff-email --quiet || {
    echo -e "${YELLOW}⚠️  SSL auto-config failed. Configure manually: certbot certonly -d $DOMAIN${NC}"
  }

  echo -e "${GREEN}✅ SSL configurado${NC}"
}

setup_systemd() {
  echo -e "${BLUE}⚙️  Configurando servicio systemd...${NC}"

  cat > /etc/systemd/system/sportbets.service << EOF
[Unit]
Description=SportBets AI Portal Backend
After=network.target postgresql.service redis-server.service
Requires=postgresql.service redis-server.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/sportbets/app.log
StandardError=append:/var/log/sportbets/error.log
EnvironmentFile=$PROJECT_DIR/.env

# Security
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=$PROJECT_DIR/backend/logs

[Install]
WantedBy=multi-user.target
EOF

  mkdir -p /var/log/sportbets
  chown www-data:www-data /var/log/sportbets

  systemctl daemon-reload
  systemctl enable sportbets
  systemctl start sportbets

  echo -e "${GREEN}✅ Servicio systemd configurado${NC}"
}

setup_backup() {
  echo -e "${BLUE}💾 Configurando backup automático...${NC}"

  cat > /usr/local/bin/sportbets-backup.sh << BACKUP_EOF
#!/bin/bash
BACKUP_DIR="/var/backups/sportbets"
DATE=\$(date +%Y%m%d_%H%M%S)
mkdir -p \$BACKUP_DIR

# Database backup
PGPASSWORD="$DB_PASS" pg_dump -h localhost -U sportbets_user sportbets_db | \
  gzip > "\$BACKUP_DIR/db_\$DATE.sql.gz"

# Keep only last 30 days
find \$BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completado: \$DATE"
BACKUP_EOF

  chmod +x /usr/local/bin/sportbets-backup.sh

  # Cron job at 2am daily
  (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/sportbets-backup.sh >> /var/log/sportbets/backup.log 2>&1") | crontab -

  echo -e "${GREEN}✅ Backup automático configurado (2am diario)${NC}"
}

create_admin() {
  echo -e "${BLUE}👤 Creando cuenta SUPERADMIN...${NC}"

  read -s -p "Contraseña para admin (mín. 12 chars): " ADMIN_PASS
  echo ""

  cd "$PROJECT_DIR/backend"
  ADMIN_EMAIL="$ADMIN_EMAIL" node -e "
    require('dotenv').config({ path: '$PROJECT_DIR/.env' });
    const { query } = require('./config/database');
    const { hashPassword } = require('./utils/helpers');

    async function main() {
      const hash = await hashPassword('$ADMIN_PASS');
      await query(
        \"INSERT INTO users (email, password_hash, nombre, rol, estado, verificado_email) VALUES (\$1, \$2, 'Administrador', 'SUPERADMIN', 'ACTIVO', TRUE) ON CONFLICT (email) DO UPDATE SET rol='SUPERADMIN'\",
        ['$ADMIN_EMAIL', hash]
      );
      console.log('Admin creado');
      process.exit(0);
    }
    main().catch(e => { console.error(e.message); process.exit(1); });
  " && echo -e "${GREEN}✅ Admin creado: $ADMIN_EMAIL${NC}"
}

print_summary() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║         ✅ INSTALACIÓN COMPLETADA               ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "🌐 URL: ${CYAN}https://$DOMAIN${NC}"
  echo -e "👤 Admin: ${CYAN}$ADMIN_EMAIL${NC}"
  echo -e "📁 Proyecto: ${CYAN}$PROJECT_DIR${NC}"
  echo -e "📋 Logs: ${CYAN}/var/log/sportbets/${NC}"
  echo ""
  echo -e "${YELLOW}Comandos útiles:${NC}"
  echo "  systemctl status sportbets    # Estado del servicio"
  echo "  systemctl restart sportbets   # Reiniciar"
  echo "  journalctl -u sportbets -f    # Ver logs en tiempo real"
  echo ""
}

# ===== MAIN =====
print_header
check_root
detect_os
check_requirements
collect_config
install_dependencies
setup_database
setup_redis
create_env
install_node_deps
setup_nginx
setup_ssl
setup_systemd
setup_backup
create_admin
print_summary
