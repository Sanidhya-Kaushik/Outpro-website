// src/server.ts
// Entry point — starts the HTTP server, connects to DB, handles graceful shutdown

import { createApp } from './app';
import { getPool, closePool, checkDatabaseHealth } from './config/database';
import { env } from './config/env';
import { logger } from './utils/logger';
import { startCronJobs } from './config/cron';

async function bootstrap(): Promise<void> {
  // Verify database connectivity before accepting traffic
  logger.info('Connecting to PostgreSQL...');
  getPool(); // Initialise pool
  const dbHealth = await checkDatabaseHealth();

  if (dbHealth.status !== 'ok') {
    logger.error('Database connection failed on startup. Exiting.');
    process.exit(1);
  }

  logger.info(`Database connected (${dbHealth.latencyMs}ms)`);

  startCronJobs();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Outpro.India API running`, {
      port: env.PORT,
      env: env.NODE_ENV,
      version: process.env.npm_package_version ?? '1.0.0',
      apiBase: `/api/${env.API_VERSION}`,
    });
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────

  async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed. Closing DB pool...');
      await closePool();
      logger.info('Shutdown complete.');
      process.exit(0);
    });

    // Force exit after 30s if something hangs
    setTimeout(() => {
      logger.error('Graceful shutdown timeout. Forcing exit.');
      process.exit(1);
    }, 30_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch unhandled rejections — log and exit in production
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise rejection', { reason });
    if (env.NODE_ENV === 'production') {
      shutdown('unhandledRejection').catch(() => process.exit(1));
    }
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException').catch(() => process.exit(1));
  });
}

bootstrap().catch(err => {
  logger.error('Fatal startup error', { error: err });
  process.exit(1);
});
