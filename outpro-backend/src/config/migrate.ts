// src/config/migrate.ts
// Lightweight migration runner — applies SQL files in order.
// Usage: pnpm migrate
// Or:    NODE_ENV=production pnpm migrate

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env['DB_SSL'] === 'true' ? { rejectUnauthorized: false } : false,
});

async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    // ── Create migrations tracking table if absent ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Read migration files ─────────────────────────────────────────────────
    const migrationsDir = path.resolve(process.cwd(), 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.error(`Migrations directory not found: ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Alphabetical order — filenames must be prefixed: 001_, 002_, ...

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    // ── Determine which migrations have already run ──────────────────────────
    const { rows: applied } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    const appliedSet = new Set(applied.map(r => r.version));

    // ── Apply pending migrations ─────────────────────────────────────────────
    let appliedCount = 0;

    for (const file of files) {
      const version = path.basename(file, '.sql');

      if (appliedSet.has(version)) {
        console.log(`  ✓ ${version} (already applied)`);
        continue;
      }

      console.log(`  → Applying ${version}...`);

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version],
        );
        await client.query('COMMIT');
        console.log(`  ✓ ${version} applied`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${version} FAILED:`);
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }

    if (appliedCount === 0) {
      console.log('Database is already up to date.');
    } else {
      console.log(`\nMigration complete. Applied ${appliedCount} migration(s).`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration runner error:', err);
  process.exit(1);
});
