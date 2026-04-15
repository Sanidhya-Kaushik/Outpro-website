// src/server.ts
// Serverless entry for Vercel

import serverless from 'serverless-http';
import { createApp } from './app';
import { getPool, checkDatabaseHealth } from './config/database';
import { logger } from './utils/logger';
import { startCronJobs } from './config/cron';

let isInitialized = false;

async function init() {
  if (isInitialized) return;

  logger.info('Initializing serverless app...');

  // Initialize DB pool
  getPool();

  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.status !== 'ok') {
    logger.error('Database connection failed');
    throw new Error('Database not connected');
  }

  logger.info(`Database connected (${dbHealth.latencyMs}ms)`);

  // Start cron (⚠️ not ideal in serverless, but okay for now)
  startCronJobs();

  isInitialized = true;
}

const app = createApp();

export const handler = async (req: any, res: any) => {
  await init();
  return serverless(app)(req, res);
};