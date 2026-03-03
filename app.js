/**
 * SportBets AI Portal — Unified cPanel entry point
 *
 * Behaviour:
 *   • First run (no .env / incomplete config) → starts the web installer
 *     accessible at  domain.com/install
 *   • After installation completes, the installer calls process.exit(0).
 *     cPanel Node.js Selector restarts the process automatically.
 *   • On restart, installation is detected and the main backend starts.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── 1. Load .env if it exists ────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// ── 2. Always default to MySQL on cPanel ─────────────────────
process.env.DB_TYPE = process.env.DB_TYPE || 'mysql';

// ── 3. Check installation state ──────────────────────────────
const isInstalled = () => {
  if (!fs.existsSync(envPath)) return false;
  // Require the three most essential variables
  return !!(
    process.env.JWT_SECRET  && process.env.JWT_SECRET.length  > 10 &&
    process.env.DB_HOST     && process.env.DB_HOST.trim()           &&
    process.env.DB_NAME     && process.env.DB_NAME.trim()
  );
};

// ── 4. Route to installer or main backend ────────────────────
if (isInstalled()) {
  console.log('\n✅  Installation detected — starting SportBets AI Portal...\n');
  require('./backend/server.js');
} else {
  console.log('\n⚙️   No installation found — starting web installer at /install ...\n');
  require('./installer/installer-web.js');
}
