// src/utils/logger.ts

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from '../config/env';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

// ── Formats ───────────────────────────────────────────────────────────────────

const jsonFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  json(),
);

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  simple(),
);

// ── Detect serverless (Vercel) ────────────────────────────────────────────────

const isServerless = process.env.VERCEL === '1';

// ── Transports ────────────────────────────────────────────────────────────────

const transports: winston.transport[] = [];

// ✅ Always log to console
transports.push(
  new winston.transports.Console({
    format: env.NODE_ENV === 'production' ? jsonFormat : consoleFormat,
  }),
);

// ✅ File logging ONLY for non-serverless environments
if (!isServerless && env.NODE_ENV !== 'test') {
  transports.push(
    new DailyRotateFile({
      filename: `${env.LOG_DIR}/app-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
      zippedArchive: true,
    }),
  );

  transports.push(
    new DailyRotateFile({
      level: 'error',
      filename: `${env.LOG_DIR}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: jsonFormat,
      zippedArchive: true,
    }),
  );
}

// ── Logger instance ───────────────────────────────────────────────────────────

export const logger = winston.createLogger({
  level: env.LOG_LEVEL || 'info', // fallback safety
  transports,
  exitOnError: false,
});

// ── HTTP request logger stream (Morgan integration) ───────────────────────────

export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};