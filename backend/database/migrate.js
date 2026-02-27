require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

async function migrate() {
  console.log('🗄️  Running database migrations...');
  try {
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await query(schemaSQL);
    console.log('✅ Schema applied successfully');

    const seedSQL = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await query(seedSQL);
    console.log('✅ Seed data applied successfully');

    console.log('✅ Migration complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
