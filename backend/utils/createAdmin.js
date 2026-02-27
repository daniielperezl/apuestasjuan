require('dotenv').config();
const readline = require('readline');
const { query } = require('../config/database');
const { hashPassword } = require('./helpers');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise(resolve => rl.question(question, resolve));

async function createAdmin() {
  console.log('🔐 Creando cuenta SUPERADMIN...');
  try {
    const email = process.env.ADMIN_EMAIL || await ask('Email: ');
    const nombre = await ask('Nombre: ');
    const password = await ask('Contraseña (mín. 12 chars, mayúsculas, números, símbolos): ');

    if (password.length < 12) { console.error('❌ Contraseña muy corta'); process.exit(1); }

    const hash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (email, password_hash, nombre, rol, estado, verificado_email)
       VALUES ($1, $2, $3, 'SUPERADMIN', 'ACTIVO', TRUE)
       ON CONFLICT (email) DO UPDATE SET rol = 'SUPERADMIN', estado = 'ACTIVO'
       RETURNING id, email, nombre, rol`,
      [email.toLowerCase().trim(), hash, nombre]
    );

    console.log('✅ SUPERADMIN creado:', result.rows[0]);
    rl.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    rl.close();
    process.exit(1);
  }
}

createAdmin();
