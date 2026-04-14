// src/config/env.ts
// Zod-validated environment configuration — fails fast on startup if any required var is missing

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  API_VERSION: z.string().default('v1'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  DB_POOL_MIN: z.string().default('2').transform(Number),
  DB_POOL_MAX: z.string().default('10').transform(Number),
  DB_SSL: z.string().default('true').transform(v => v === 'true'),

  // JWT
  JWT_SECRET: z.string().min(64, 'JWT_SECRET must be at least 64 characters'),
  JWT_EXPIRY: z.string().default('8h'),

  // Cookie
  SESSION_MAX_AGE_SECONDS: z.string().default('28800').transform(Number), // 8h

  // reCAPTCHA
  RECAPTCHA_SECRET_KEY: z.string().min(1, 'RECAPTCHA_SECRET_KEY is required'),
  RECAPTCHA_MIN_SCORE: z.string().default('0.5').transform(Number),

  // CMS ISR
  REVALIDATION_SECRET: z.string().min(32, 'REVALIDATION_SECRET must be at least 32 characters'),

  // Email — Resend
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  EMAIL_FROM: z.string().email().default('noreply@outpro.india'),
  EMAIL_ADMIN_NOTIFY: z.string().email().default('leads@outpro.india'),

  // CRM (optional — non-fatal if missing in dev)
  HUBSPOT_API_KEY: z.string().optional(),
  ZOHO_CLIENT_ID: z.string().optional(),
  ZOHO_CLIENT_SECRET: z.string().optional(),

  // Upstash Redis (rate limiting)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Storage — Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_STORAGE_BUCKET_PRIVATE: z.string().default('media-private'),
  SUPABASE_STORAGE_BUCKET_PUBLIC: z.string().default('media-public'),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Bcrypt
  BCRYPT_ROUNDS: z.string().default('12').transform(Number),

  // Rate limits
  RATE_LIMIT_AUTH_PER_MIN: z.string().default('10').transform(Number),
  RATE_LIMIT_PUBLIC_PER_MIN: z.string().default('100').transform(Number),
  RATE_LIMIT_AUTHED_PER_MIN: z.string().default('1000').transform(Number),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_DIR: z.string().default('logs'),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    result.error.issues.forEach(issue => {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
