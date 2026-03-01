// SportBets AI Portal — cPanel / Node.js Selector entry point
// Este archivo es generado por el instalador web. No editar manualmente.
require('dotenv').config({ path: __dirname + '/.env' });

// Use MySQL on cPanel (shared hosting default)
process.env.DB_TYPE = process.env.DB_TYPE || 'mysql';

require('./backend/server.js');
