// src/config/cron.ts
// Scheduled maintenance jobs — run inside the API process.
// For high-scale deployments, move to a dedicated worker or Cloud Scheduler job.

import cron from 'node-cron';
import { query } from './database';
import { logger } from '../utils/logger';

/**
 * Purge expired and revoked sessions from admin_sessions.
 * Runs nightly at 02:00 UTC to keep the table lean and reduce auth lookup time.
 */
function scheduleSessionCleanup(): void {
  // "0 2 * * *" = 02:00 UTC every day
  cron.schedule('0 2 * * *', async () => {
    logger.info('Session cleanup cron started');
    try {
      const result = await query(
        `DELETE FROM admin_sessions
         WHERE revoked = TRUE
            OR expires_at < NOW() - INTERVAL '1 day'`,
      );
      logger.info('Session cleanup complete', { deleted: result.rowCount ?? 0 });
    } catch (err) {
      logger.error('Session cleanup failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

/**
 * Purge audit_log entries older than 2 years.
 * Regulatory note: adjust retention period to match your compliance requirements.
 * Runs at 03:00 UTC on the first day of each month.
 */
function scheduleAuditLogPurge(): void {
  // "0 3 1 * *" = 03:00 UTC on the 1st of every month
  cron.schedule('0 3 1 * *', async () => {
    logger.info('Audit log purge cron started');
    try {
      const result = await query(
        `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '2 years'`,
      );
      logger.info('Audit log purge complete', { deleted: result.rowCount ?? 0 });
    } catch (err) {
      logger.error('Audit log purge failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

/**
 * Mark stale media assets whose scan has been pending > 24 hours as 'error'.
 * This catches cases where the ClamAV Lambda failed to callback.
 * Runs every 6 hours.
 */
function scheduleStuckScanRecovery(): void {
  // "0 */6 * * *" = every 6 hours at :00
  cron.schedule('0 */6 * * *', async () => {
    try {
      const result = await query(
        `UPDATE media_assets
         SET scan_status = 'error', updated_at = NOW()
         WHERE scan_status = 'pending'
           AND created_at < NOW() - INTERVAL '24 hours'`,
      );
      if ((result.rowCount ?? 0) > 0) {
        logger.warn('Marked stuck media scans as error', { count: result.rowCount });
      }
    } catch (err) {
      logger.error('Stuck scan recovery failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

/**
 * Start all cron jobs. Call this once from server.ts after DB connection is verified.
 */
export function startCronJobs(): void {
  if (process.env['NODE_ENV'] === 'test') return; // Never run crons in test

  scheduleSessionCleanup();
  scheduleAuditLogPurge();
  scheduleStuckScanRecovery();

  logger.info('Cron jobs scheduled', {
    jobs: ['session-cleanup (02:00 UTC daily)', 'audit-purge (03:00 UTC monthly)', 'scan-recovery (every 6h)'],
  });
}
