import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (go up from src/config to root)
dotenv.config({ path: join(__dirname, '../../../..', '.env') });

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // INFRA-DOS-01: cap any single query so a slow/pathological statement cannot
  // hold a pooled connection indefinitely and exhaust the pool.
  statement_timeout: 10000,
  query_timeout: 10000,
});

// INFRA-DB-01: a transient error on an *idle* pooled client (e.g. the DB
// dropped a keep-alive connection) must NOT take down the whole server. The
// pool will discard the bad client and create a fresh one on the next query.
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client (connection will be recycled):', err);
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true') {
      const duration = Date.now() - start;
      console.log('Executed query', { duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function testConnection() {
  try {
    const result = await query('SELECT NOW()');
    console.log('✓ Database connected successfully at:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  }
}
