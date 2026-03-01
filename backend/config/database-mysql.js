/**
 * MySQL database adapter — compatible con cPanel hosting
 * Expone la misma interfaz que database.js (PostgreSQL)
 * pero traduce automáticamente la sintaxis de PostgreSQL a MySQL.
 */

const mysql  = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// ─── Pool ────────────────────────────────────────────────────

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT) || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD,
  database:         process.env.DB_NAME     || 'sportbets_db',
  waitForConnections: true,
  connectionLimit:  20,
  queueLimit:       0,
  enableKeepAlive:  true,
  keepAliveInitialDelayMs: 0,
  timezone: 'Z',
});

pool.on('error', (err) => logger.error('MySQL Pool error:', err));
logger.info('MySQL connection pool created');

// ─── Tables with UUID primary keys (no DB default) ───────────

const UUID_PK_TABLES = new Set([
  'users', 'refresh_tokens', 'analisis_ia', 'apuestas',
  'estadisticas_equipo', 'historial_directo', 'cuotas',
  'audit_log', 'notificaciones',
]);

// ─── SQL transformation: PostgreSQL → MySQL ──────────────────

/**
 * Replace FILTER aggregate syntax:
 *   COUNT(*) FILTER (WHERE cond)  →  SUM(CASE WHEN cond THEN 1 ELSE 0 END)
 *   SUM(col) FILTER (WHERE cond)  →  SUM(CASE WHEN cond THEN col ELSE NULL END)
 */
const replaceFilterAgg = (sql) => {
  let result = sql;
  const re = /(COUNT\(\*\)|SUM\([^)]+\)|AVG\([^)]+\)|MAX\([^)]+\)|MIN\([^)]+\))\s+FILTER\s+\(WHERE\s+/gi;
  let match;
  while ((match = re.exec(result)) !== null) {
    const aggExpr  = match[1];
    const condStart = match.index + match[0].length;

    let depth = 1, i = condStart;
    while (i < result.length && depth > 0) {
      if (result[i] === '(') depth++;
      else if (result[i] === ')') depth--;
      i++;
    }
    const condition = result.slice(condStart, i - 1);

    let replacement;
    if (/^COUNT/i.test(aggExpr)) {
      replacement = `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`;
    } else {
      const colMatch = aggExpr.match(/\w+\((.+)\)/);
      const inner = colMatch ? colMatch[1] : '*';
      const func  = aggExpr.match(/^(\w+)/)[1].toUpperCase();
      replacement = `${func}(CASE WHEN ${condition} THEN ${inner} ELSE NULL END)`;
    }

    result = result.slice(0, match.index) + replacement + result.slice(i);
    re.lastIndex = match.index + replacement.length;
  }
  return result;
};

const transformSQL = (sql) => {
  let s = sql.trim();

  // 1. $N → ?
  s = s.replace(/\$\d+/g, '?');

  // 2. ILIKE → LIKE  (utf8mb4_unicode_ci is already case-insensitive)
  s = s.replace(/\bILIKE\b/gi, 'LIKE');

  // 3. INTERVAL '30 days' → INTERVAL 30 DAY
  s = s.replace(/INTERVAL\s+'(\d+)\s+(\w+?)s?'/gi, (_, n, unit) =>
    `INTERVAL ${n} ${unit.toUpperCase()}`
  );

  // 4. FILTER aggregate
  s = replaceFilterAgg(s);

  // 5. PostgreSQL type casts  (::text, ::decimal, ::jsonb …)
  s = s.replace(/::(decimal|numeric|float|real|double|text|varchar|integer|bigint|boolean|json|jsonb)\b/gi, '');

  // 6. EXCLUDED.col → VALUES(col)
  s = s.replace(/\bEXCLUDED\.(\w+)/g, 'VALUES($1)');

  // 7. ON CONFLICT (...) DO UPDATE SET → ON DUPLICATE KEY UPDATE
  s = s.replace(/ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+UPDATE\s+SET/gi, 'ON DUPLICATE KEY UPDATE');

  // 8. ON CONFLICT (...) DO NOTHING → INSERT IGNORE
  let insertIgnore = false;
  if (/ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+NOTHING/i.test(s)) {
    insertIgnore = true;
    s = s.replace(/ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+NOTHING/gi, '');
  }
  if (insertIgnore && /^\s*INSERT\s+INTO/i.test(s)) {
    s = s.replace(/^\s*INSERT\s+INTO/i, 'INSERT IGNORE INTO');
  }

  // 9. val = ANY(ARRAY['a','b']) → val IN ('a','b')
  s = s.replace(/=\s*ANY\s*\(\s*ARRAY\s*\[([^\]]+)\]\s*\)/gi, 'IN ($1)');

  // 10. EXTRACT(EPOCH FROM …) → UNIX_TIMESTAMP(…)
  s = s.replace(/EXTRACT\s*\(\s*EPOCH\s+FROM\s+([^)]+)\)/gi, 'UNIX_TIMESTAMP($1)');

  // 11. Extract RETURNING clause (must be last transformation)
  let returningClause = null;
  const retMatch = s.match(/\bRETURNING\b\s+(.+?)(?:\s*;?\s*)$/i);
  if (retMatch) {
    returningClause = retMatch[1].trim();
    s = s.slice(0, retMatch.index).trim();
  }

  return { sql: s, returningClause };
};

// ─── UUID auto-injection for INSERTs ─────────────────────────

const injectUUID = (sql, params) => {
  const tableMatch = sql.match(/INSERT(?:\s+IGNORE)?\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
  if (!tableMatch) return { sql, params, injectedId: null };

  const tableName = tableMatch[1];
  if (!UUID_PK_TABLES.has(tableName)) return { sql, params, injectedId: null };

  const cols = tableMatch[2].split(',').map((c) => c.trim().replace(/`/g, ''));
  if (cols.includes('id')) {
    const idIdx = cols.indexOf('id');
    return { sql, params, injectedId: params[idIdx] || null };
  }

  const injectedId = uuidv4();
  const newSql = sql.replace(
    /(INSERT(?:\s+IGNORE)?\s+INTO\s+\w+\s*\()([^)]+)(\))/i,
    (_, pre, colList, post) => `${pre}id, ${colList}${post}`,
  );
  const fixedSql    = newSql.replace(/\bVALUES\s*\(/i, 'VALUES (?, ');
  const fixedParams = [injectedId, ...params];

  return { sql: fixedSql, params: fixedParams, injectedId };
};

// ─── RETURNING emulation ─────────────────────────────────────

const fetchById = async (tableName, id, cols) => {
  const [rows] = await pool.query(
    `SELECT ${cols} FROM \`${tableName}\` WHERE id = ?`,
    [id],
  );
  return rows || [];
};

const fetchAfterUpdate = async (sql, params, tableName, returningClause) => {
  await pool.query(sql, params);
  const whereMatch = sql.match(/\bWHERE\b\s+(.+?)(?:\s*;?\s*)$/i);
  if (!whereMatch || !tableName) return [];

  const beforeCount = (sql.slice(0, whereMatch.index).match(/\?/g) || []).length;
  const whereParams = params.slice(beforeCount);
  const cols = returningClause === '*' ? '*' : returningClause;
  const [rows] = await pool.query(
    `SELECT ${cols} FROM \`${tableName}\` WHERE ${whereMatch[1]}`,
    whereParams,
  );
  return rows || [];
};

// ─── Main query function ─────────────────────────────────────

const query = async (sql, params = []) => {
  const start = Date.now();
  const { sql: mysqlSQL, returningClause } = transformSQL(sql);
  const queryType = (mysqlSQL.match(/^\s*(\w+(?:\s+\w+)?)/i)?.[1] || '').toUpperCase().trim();

  try {
    let finalSQL    = mysqlSQL;
    let finalParams = [...params];
    let injectedId  = null;

    if (queryType.startsWith('INSERT')) {
      ({ sql: finalSQL, params: finalParams, injectedId } = injectUUID(mysqlSQL, finalParams));
    }

    if (queryType.startsWith('INSERT') && returningClause) {
      await pool.query(finalSQL, finalParams);
      const tableMatch = finalSQL.match(/INSERT(?:\s+IGNORE)?\s+INTO\s+(\w+)/i);
      const tableName  = tableMatch ? tableMatch[1] : null;
      const cols = returningClause === '*' ? '*' : returningClause;
      const rows = tableName && injectedId
        ? await fetchById(tableName, injectedId, cols)
        : [];
      return { rows, rowCount: rows.length };
    }

    if (queryType === 'UPDATE' && returningClause) {
      const tableMatch = finalSQL.match(/UPDATE\s+(\w+)/i);
      const tableName  = tableMatch ? tableMatch[1] : null;
      const rows = await fetchAfterUpdate(finalSQL, finalParams, tableName, returningClause);
      return { rows, rowCount: rows.length };
    }

    const [result] = await pool.query(finalSQL, finalParams);

    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow MySQL query', { sql: sql.substring(0, 100), duration });
    }

    if (Array.isArray(result)) {
      return { rows: result, rowCount: result.length };
    }

    return { rows: [], rowCount: result.affectedRows || 0 };
  } catch (err) {
    logger.error('MySQL query error:', { sql: sql.substring(0, 100), error: err.message });
    throw err;
  }
};

const getClient = () => pool.getConnection();

module.exports = { query, getClient, pool };
