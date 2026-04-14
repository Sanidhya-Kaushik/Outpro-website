// src/config/database.ts
// PostgreSQL connection pool via pg — with connection health check and graceful shutdown

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from './env';
import { logger } from '../utils/logger';

// ── Pool singleton ────────────────────────────────────────────────────────────

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', { error: err.message, stack: err.stack });
    });

    pool.on('connect', () => {
      logger.debug('New PostgreSQL client connected to pool');
    });
  }
  return pool;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Execute a single parameterised query.
 * Values are always passed separately — never interpolated — preventing SQL injection.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, values);
  const duration = Date.now() - start;

  logger.debug('Executed query', {
    query: text.substring(0, 100),
    rows: result.rowCount,
    duration: `${duration}ms`,
  });

  return result;
}

/**
 * Execute multiple queries atomically within a transaction.
 * Automatically rolls back on any error.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkDatabaseHealth(): Promise<{ status: 'ok' | 'error'; latencyMs?: number }> {
  try {
    const start = Date.now();
    await query('SELECT 1');
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error' };
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

export async function closePool(): Promise<void> {
  if (pool) {
    logger.info('Closing PostgreSQL connection pool...');
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed.');
  }
}
