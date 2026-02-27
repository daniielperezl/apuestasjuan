#!/usr/bin/env node

/**
 * ============================================================
 * SPORTBETS AI PORTAL - Web Installer for cPanel
 * Auto-Setup Wizard - Genera todo automáticamente
 * ============================================================
 */

const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PROJECT_DIR = path.join(__dirname, '..');
const INSTALLER_STATE_FILE = path.join(PROJECT_DIR, '.installer-state.json');

// ============================================================
// Utilidades
// ============================================================

const generateSecret = (length = 32) => crypto.randomBytes(length).toString('hex');
const generatePassword = () => crypto.randomBytes(16).toString('base64').replace(/[/+=]/g, '');

const loadState = () => {
  try {
    if (fs.existsSync(INSTALLER_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(INSTALLER_STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
};

const saveState = (data) => {
  fs.writeFileSync(INSTALLER_STATE_FILE, JSON.stringify(data, null, 2));
};

const runCommand = (cmd, args, cwd = PROJECT_DIR) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: 'pipe' });
    let stdout = '', stderr = '';
    proc.stdout?.on('data', (d) => { stdout += d; });
    proc.stderr?.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `${cmd} exited with code ${code}`));
    });
  });
};

// ============================================================
// API Endpoints
// ============================================================

// Verificar requisitos del sistema
app.post('/api/check-requirements', async (req, res) => {
  try {
    const { dbHost, dbUser, dbPass, dbName } = req.body;

    // Verificar Node version
    const nodeVersion = process.version.match(/v(\d+)/)[1];
    if (parseInt(nodeVersion) < 18) {
      return res.status(400).json({ error: `Node.js 18+ requerido, tienes v${nodeVersion}` });
    }

    // Verificar MySQL
    try {
      const conn = await mysql.createConnection({
        host: dbHost || 'localhost',
        user: dbUser,
        password: dbPass,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
      });
      await conn.end();
    } catch (err) {
      return res.status(400).json({ error: `MySQL no accessible: ${err.message}` });
    }

    // Verificar proyecto
    const backendPath = path.join(PROJECT_DIR, 'backend');
    const frontendPath = path.join(PROJECT_DIR, 'frontend');

    if (!fs.existsSync(backendPath) || !fs.existsSync(frontendPath)) {
      return res.status(400).json({ error: 'Estructura de proyecto inválida' });
    }

    res.json({
      success: true,
      message: 'Todos los requisitos cumplidos',
      nodeVersion: process.version
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear base de datos y tablas
app.post('/api/setup-database', async (req, res) => {
  try {
    const { dbHost, dbUser, dbPass, dbName } = req.body;

    const conn = await mysql.createConnection({
      host: dbHost || 'localhost',
      user: dbUser,
      password: dbPass
    });

    // Crear BD
    await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.changeUser({ database: dbName });

    // Cargar schema
    const schemaPath = path.join(PROJECT_DIR, 'backend/database/schema-mysql.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Ejecutar línea por línea (MySQL puede tener problemas con múltiples statements)
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await conn.execute(stmt + ';');
      }
    }

    // Cargar datos seed
    const seedPath = path.join(PROJECT_DIR, 'backend/database/seed-mysql.sql');
    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf8');
      const seedStmts = seed.split(';').filter(s => s.trim());
      for (const stmt of seedStmts) {
        if (stmt.trim()) {
          try {
            await conn.execute(stmt + ';');
          } catch (e) {
            // Ignorar errores en seed (duplicados, etc)
          }
        }
      }
    }

    await conn.end();

    res.json({
      success: true,
      message: 'Base de datos creada y configurada'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generar archivo .env
app.post('/api/generate-env', async (req, res) => {
  try {
    const {
      domain,
      adminEmail,
      iaProvider,
      iaApiKey,
      sportsApiKey,
      smtpHost,
      smtpUser,
      smtpPass,
      dbHost,
      dbUser,
      dbPass,
      dbName
    } = req.body;

    // Generar secretos
    const jwtSecret = generateSecret(64);
    const encryptionKey = generateSecret(32);
    const sessionSecret = generateSecret(64);

    const envContent = `# ============================================================
# SPORTBETS AI PORTAL - Configuración Generada
# Instalación cPanel - ${new Date().toISOString()}
# ============================================================

# === SERVIDOR ===
NODE_ENV=production
PORT=3000
DOMAIN=${domain}
FRONTEND_URL=https://${domain}
CORS_ORIGINS=https://${domain}

# === BASE DE DATOS (MySQL) ===
DB_HOST=${dbHost || 'localhost'}
DB_PORT=3306
DB_USER=${dbUser}
DB_PASSWORD=${dbPass}
DB_NAME=${dbName}
DB_SSL=false

# === REDIS (opcional en cPanel) ===
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${generatePassword()}

# === AUTENTICACIÓN ===
JWT_SECRET=${jwtSecret}
JWT_EXPIRES=15m
ENCRYPTION_KEY=${encryptionKey}
SESSION_SECRET=${sessionSecret}

# === INTELIGENCIA ARTIFICIAL ===
IA_PROVIDER=${iaProvider}
IA_API_KEY=${iaApiKey}
IA_MODEL=${iaProvider === 'claude' ? 'claude-sonnet-4-6' : iaProvider === 'openai' ? 'gpt-4o' : 'gemini-1.5-pro'}

# === API DEPORTES (RapidAPI) ===
SPORTS_API_KEY=${sportsApiKey}
SPORTS_API_URL=https://v3.football.api-sports.io

# === EMAIL ===
SMTP_HOST=${smtpHost}
SMTP_PORT=587
SMTP_USER=${smtpUser}
SMTP_PASSWORD=${smtpPass}

# === CONFIGURACIÓN REGIONAL ===
TIMEZONE=America/Bogota

# === CRON JOBS ===
ENABLE_CRON=true

# === LOGGING ===
LOG_LEVEL=info

# === ADMIN ===
ADMIN_EMAIL=${adminEmail}
`;

    const envPath = path.join(PROJECT_DIR, '.env');
    fs.writeFileSync(envPath, envContent);

    // Guardar estado
    const state = loadState();
    state.env = { domain, adminEmail, iaProvider };
    saveState(state);

    res.json({
      success: true,
      message: '.env generado correctamente',
      keys: { jwtSecret, encryptionKey, sessionSecret }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Instalar dependencias Node.js
app.post('/api/install-deps', async (req, res) => {
  try {
    res.json({ success: true, message: 'Instalando dependencias...' });

    setImmediate(async () => {
      try {
        // Backend
        await runCommand('npm', ['install', '--production'], path.join(PROJECT_DIR, 'backend'));

        // Frontend
        await runCommand('npm', ['install'], path.join(PROJECT_DIR, 'frontend'));
        await runCommand('npm', ['run', 'build'], path.join(PROJECT_DIR, 'frontend'));

        const state = loadState();
        state.depsInstalled = true;
        saveState(state);
      } catch (err) {
        console.error('Error instalando deps:', err);
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear usuario admin
app.post('/api/create-admin', async (req, res) => {
  try {
    const { adminEmail, adminPassword } = req.body;

    if (adminPassword.length < 12) {
      return res.status(400).json({ error: 'Contraseña mínimo 12 caracteres' });
    }

    // Usar bcryptjs para hashear
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(adminPassword, 12);

    const { query } = require('../backend/config/database');
    require('dotenv').config({ path: path.join(PROJECT_DIR, '.env') });

    await query(
      `INSERT INTO users (id, email, password_hash, nombre, rol, estado, verificado_email)
       VALUES (?, ?, ?, 'Administrador', 'SUPERADMIN', 'ACTIVO', TRUE)
       ON DUPLICATE KEY UPDATE rol='SUPERADMIN'`,
      [uuidv4(), adminEmail, hash]
    );

    const state = loadState();
    state.adminCreated = true;
    saveState(state);

    res.json({
      success: true,
      message: 'Usuario admin creado correctamente',
      email: adminEmail
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener estado de instalación
app.get('/api/installation-status', (req, res) => {
  const state = loadState();
  res.json(state);
});

// Finalizar instalación (elimina el instalador)
app.post('/api/finalize-installation', async (req, res) => {
  try {
    const installerPath = __filename;
    const publicPath = path.join(__dirname, 'public');

    // Dar 2 segundos para cerrar conexión
    setTimeout(() => {
      try {
        // Eliminar instalador
        if (fs.existsSync(installerPath)) {
          fs.unlinkSync(installerPath);
        }
        // Eliminar carpeta public del installer
        if (fs.existsSync(publicPath)) {
          fs.rmSync(publicPath, { recursive: true });
        }
        // Eliminar archivos de estado
        if (fs.existsSync(INSTALLER_STATE_FILE)) {
          fs.unlinkSync(INSTALLER_STATE_FILE);
        }
      } catch (e) {
        console.error('Error eliminando instalador:', e);
      }
    }, 2000);

    res.json({
      success: true,
      message: 'Instalación completada. El instalador se ha eliminado.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Servidor
// ============================================================

const PORT = process.env.INSTALLER_PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🚀 SportBets Installer disponible en http://localhost:${PORT}`);
  console.log(`📍 En tu cPanel accede a tu dominio en la ruta: /installer\n`);
});
