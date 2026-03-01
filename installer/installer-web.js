#!/usr/bin/env node

/**
 * ============================================================
 * SPORTBETS AI PORTAL — Web Installer
 * Asistente de instalación con interfaz gráfica
 * ============================================================
 */

const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const { spawn } = require('child_process');

const app        = express();
const PROJECT    = path.resolve(__dirname, '..');
const STATE_FILE = path.join(PROJECT, '.installer-state.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ────────────────────────────────────────────────

const secret  = (n = 32) => crypto.randomBytes(n).toString('hex');
const randPwd = ()        => crypto.randomBytes(16).toString('base64url');

const loadState = () => {
  try {
    return fs.existsSync(STATE_FILE)
      ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
      : {};
  } catch { return {}; }
};

const saveState = (patch) =>
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...loadState(), ...patch }, null, 2));

// ─── Server-Sent Events for install log ─────────────────────

const sseClients = new Set();
const logBuffer  = [];           // circular — last 300 lines
const MAX_LINES  = 300;

const pushLog = (line) => {
  const entry = String(line).replace(/\r/g, '');
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LINES) logBuffer.shift();
  for (const res of sseClients) {
    try { res.write(`data: ${JSON.stringify(entry)}\n\n`); }
    catch { sseClients.delete(res); }
  }
};

app.get('/api/install-log', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // Replay buffered output for late-joining clients
  for (const line of logBuffer) {
    res.write(`data: ${JSON.stringify(line)}\n\n`);
  }

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// ─── Step 1 — Verificar requisitos ──────────────────────────

app.post('/api/check-requirements', async (req, res) => {
  const { dbHost = 'localhost', dbUser, dbPass, dbName } = req.body;

  // Node version
  const major = parseInt(process.version.replace('v', ''));
  if (major < 18) {
    return res.status(400).json({ error: `Node.js 18+ requerido. Tienes ${process.version}` });
  }

  // MySQL connectivity (without selecting DB — it may not exist yet)
  try {
    const conn = await mysql.createConnection({
      host: dbHost || 'localhost',
      user: dbUser,
      password: dbPass,
      connectTimeout: 8000,
    });
    await conn.ping();
    await conn.end();
  } catch (err) {
    return res.status(400).json({ error: `MySQL no accesible: ${err.message}` });
  }

  // Project structure
  if (!fs.existsSync(path.join(PROJECT, 'backend', 'server.js'))) {
    return res.status(400).json({
      error: 'Estructura de proyecto inválida — no se encontró backend/server.js',
    });
  }

  saveState({ step1: true, db: { dbHost, dbUser, dbPass, dbName } });
  res.json({ success: true, nodeVersion: process.version, message: 'Todos los requisitos cumplidos' });
});

// ─── Step 2 — Generar .env + archivos de configuración ──────

app.post('/api/generate-env', (req, res) => {
  const {
    domain      = '',
    adminEmail  = '',
    iaProvider  = 'claude',
    iaApiKey    = '',
    sportsApiKey = '',
    smtpHost    = 'smtp.gmail.com',
    smtpUser    = '',
    smtpPass    = '',
  } = req.body;

  if (!domain.trim() || !adminEmail.trim()) {
    return res.status(400).json({ error: 'El dominio y el email son obligatorios' });
  }

  const state = loadState();
  const { dbHost = 'localhost', dbUser = '', dbPass = '', dbName = '' } = state.db || {};

  const jwtSecret       = secret(64);
  const encryptionKey   = secret(32);
  const sessionSecret   = secret(64);
  const redisPass       = randPwd();

  const iaModel =
    iaProvider === 'claude'  ? 'claude-sonnet-4-6' :
    iaProvider === 'openai'  ? 'gpt-4o'            :
    /* gemini */               'gemini-1.5-pro';

  // ── .env ──
  const envContent = `# SportBets AI Portal — generado el ${new Date().toISOString()}
# NO compartas este archivo

# ─── Servidor ─────────────────────────────────────────────
NODE_ENV=production
PORT=3000
DOMAIN=${domain}
FRONTEND_URL=https://${domain}
CORS_ORIGINS=https://${domain}

# ─── Base de datos (MySQL) ─────────────────────────────────
DB_TYPE=mysql
DB_HOST=${dbHost}
DB_PORT=3306
DB_USER=${dbUser}
DB_PASSWORD=${dbPass}
DB_NAME=${dbName}
DB_SSL=false

# ─── Redis (deshabilitar si no disponible en tu hosting) ───
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${redisPass}
REDIS_DISABLED=true

# ─── Autenticación ─────────────────────────────────────────
JWT_SECRET=${jwtSecret}
JWT_EXPIRES=15m
ENCRYPTION_KEY=${encryptionKey}
SESSION_SECRET=${sessionSecret}

# ─── Inteligencia Artificial ───────────────────────────────
IA_PROVIDER=${iaProvider}
IA_API_KEY=${iaApiKey}
IA_MODEL=${iaModel}

# ─── API Deportes (RapidAPI / API-Sports) ──────────────────
SPORTS_API_KEY=${sportsApiKey}

# ─── Email (SMTP) ──────────────────────────────────────────
SMTP_HOST=${smtpHost}
SMTP_PORT=587
SMTP_USER=${smtpUser}
SMTP_PASSWORD=${smtpPass}

# ─── Regional ──────────────────────────────────────────────
TIMEZONE=America/Bogota

# ─── Cron / Logs ───────────────────────────────────────────
ENABLE_CRON=true
LOG_LEVEL=info
ADMIN_EMAIL=${adminEmail}
`;

  fs.writeFileSync(path.join(PROJECT, '.env'), envContent);

  // ── app.js — entry point para cPanel Node.js App ──
  const appJs = `// SportBets AI Portal — cPanel entry point
require('dotenv').config({ path: __dirname + '/.env' });
// Use MySQL on cPanel shared hosting
process.env.DB_TYPE = process.env.DB_TYPE || 'mysql';
require('./backend/server.js');
`;
  fs.writeFileSync(path.join(PROJECT, 'app.js'), appJs);

  // ── htaccess.txt — guía para cPanel proxy ──
  const htaccess = `# Coloca este contenido en tu public_html/.htaccess
# para que Apache reenvíe las peticiones a la app Node.js

Options -MultiViews
RewriteEngine On

# No redirigir archivos/carpetas que existen
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d

# Redirigir todo al servidor Node.js en puerto 3000
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]

# Seguridad
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
`;
  fs.writeFileSync(path.join(PROJECT, 'htaccess.txt'), htaccess);

  saveState({ step2: true, config: { domain, adminEmail, iaProvider } });
  res.json({ success: true, message: '.env, app.js y htaccess.txt generados' });
});

// ─── Step 3 — Crear base de datos y tablas ──────────────────

app.post('/api/setup-database', async (req, res) => {
  const state = loadState();
  const {
    dbHost = 'localhost',
    dbUser, dbPass, dbName
  } = { ...state.db, ...req.body };

  try {
    // multipleStatements lets us run the whole schema in one call
    const conn = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPass,
      multipleStatements: true,
      connectTimeout: 10000,
    });

    await conn.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.changeUser({ database: dbName });

    // Schema
    const schemaFile = path.join(PROJECT, 'backend/database/schema-mysql.sql');
    const schema = fs.readFileSync(schemaFile, 'utf8');
    await conn.query(schema);

    // Seed data (ignore duplicate errors)
    const seedFile = path.join(PROJECT, 'backend/database/seed-mysql.sql');
    if (fs.existsSync(seedFile)) {
      try { await conn.query(fs.readFileSync(seedFile, 'utf8')); } catch {}
    }

    await conn.end();
    saveState({ step3: true });
    res.json({ success: true, message: 'Base de datos creada y tablas inicializadas' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Step 4a — Crear usuario administrador ──────────────────

app.post('/api/create-admin', async (req, res) => {
  const { adminEmail, adminPassword } = req.body;

  if (!adminPassword || adminPassword.length < 12) {
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 12 caracteres' });
  }

  const state  = loadState();
  const { dbHost = 'localhost', dbUser, dbPass, dbName } = state.db || {};
  const email  = adminEmail || state.config?.adminEmail;

  try {
    const hash = await bcrypt.hash(adminPassword, 12);
    const conn = await mysql.createConnection({
      host: dbHost, user: dbUser, password: dbPass, database: dbName,
    });

    await conn.execute(
      `INSERT INTO users (id, email, password_hash, nombre, rol, estado, verificado_email)
       VALUES (?, ?, ?, 'Administrador', 'SUPERADMIN', 'ACTIVO', TRUE)
       ON DUPLICATE KEY UPDATE
         rol           = 'SUPERADMIN',
         password_hash = VALUES(password_hash)`,
      [uuidv4(), email, hash]
    );

    // Config flags in sistema table
    await conn.execute(
      `INSERT INTO config_sistema (clave, valor, tipo)
       VALUES ('installed_at', ?, 'string'),
              ('version',      '1.0.0', 'string')
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [new Date().toISOString()]
    ).catch(() => {}); // table might not have config_sistema yet — safe to skip

    await conn.end();
    saveState({ adminCreated: true });
    res.json({ success: true, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Step 4b — Instalar dependencias (streamed via SSE) ─────

app.post('/api/install-deps', (req, res) => {
  // Respond immediately — progress arrives via /api/install-log
  res.json({ success: true, message: 'Instalación iniciada' });

  const steps = [
    {
      label: 'Dependencias del backend',
      cwd:   path.join(PROJECT, 'backend'),
      cmd:   'npm',
      args:  ['install', '--production', '--no-fund', '--no-audit', '--legacy-peer-deps'],
    },
    {
      label: 'Dependencias del frontend',
      cwd:   path.join(PROJECT, 'frontend'),
      cmd:   'npm',
      args:  ['install', '--no-fund', '--no-audit', '--legacy-peer-deps', '--prefer-offline'],
    },
    {
      label: 'Compilar frontend (build)',
      cwd:   path.join(PROJECT, 'frontend'),
      // Use node + direct script path to avoid PATH/shell issues on CloudLinux
      cmd:   'node',
      args:  ['./node_modules/.bin/react-scripts', 'build'],
    },
  ];

  setImmediate(async () => {
    let allOk = true;
    for (const step of steps) {
      pushLog(`\n▶ ${step.label}…`);
      const ok = await new Promise((resolve) => {
        const proc = spawn(step.cmd, step.args, {
          cwd:   step.cwd,
          shell: true,   // required on cPanel/CloudLinux to resolve PATH correctly
          env: {
            ...process.env,
            CI: 'false',
            FORCE_COLOR: '0',
            // Ensure local node_modules/.bin is always first in PATH
            PATH: `${path.join(step.cwd, 'node_modules', '.bin')}:${process.env.PATH}`,
          },
        });
        proc.stdout.on('data', (d) => d.toString().split('\n').forEach(pushLog));
        proc.stderr.on('data', (d) => d.toString().split('\n').forEach(pushLog));
        proc.on('close', (code) => {
          if (code === 0) { pushLog(`✓ ${step.label} completado`); resolve(true); }
          else            { pushLog(`✗ ${step.label} falló (código ${code})`); resolve(false); }
        });
      });
      if (!ok) { allOk = false; break; }
    }

    if (allOk) {
      saveState({ depsInstalled: true });
      pushLog('\n__DONE__');
    } else {
      pushLog('\n__ERROR__');
    }
  });
});

// ─── Estado de instalación ───────────────────────────────────

app.get('/api/installation-status', (req, res) => res.json(loadState()));

// ─── Finalizar (auto-eliminación del instalador) ─────────────

app.post('/api/finalize-installation', (req, res) => {
  res.json({ success: true, message: 'Instalador eliminado' });

  setTimeout(() => {
    const targets = [
      __filename,                            // installer-web.js
      path.join(__dirname, 'public'),        // installer UI
      path.join(__dirname, 'package.json'),  // installer package.json
      path.join(__dirname, 'node_modules'),  // installer deps
      STATE_FILE,                            // state file
    ];
    for (const t of targets) {
      try {
        if (!fs.existsSync(t)) continue;
        const stat = fs.statSync(t);
        if (stat.isDirectory()) fs.rmSync(t, { recursive: true, force: true });
        else fs.unlinkSync(t);
      } catch (e) {
        console.error(`Error eliminando ${t}:`, e.message);
      }
    }
    console.log('Instalador eliminado correctamente.');
  }, 3000);
});

// ─── Iniciar servidor ────────────────────────────────────────

const PORT = process.env.PORT || process.env.INSTALLER_PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log(`║  SportBets AI — Instalador Web             ║`);
  console.log(`║  http://localhost:${PORT}                    ║`);
  console.log('╚═══════════════════════════════════════════╝\n');
  console.log('Abre esa URL en tu navegador para continuar.\n');
});
