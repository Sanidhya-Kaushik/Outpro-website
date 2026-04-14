// src/app.ts
// Express application factory — middleware stack, security headers, route mounting

import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { logger, httpLogStream } from './utils/logger';
import { requestId, errorHandler, notFoundHandler } from './middleware';
import apiRouter from './routes';

export function createApp(): Application {
  const app = express();

  // ── Trust proxy (Cloudflare / Vercel sit in front) ───────────────────────
  app.set('trust proxy', 1);

  // ── Request ID (must be first) ───────────────────────────────────────────
  app.use(requestId);

  // ── HTTP Security Headers (Helmet) ───────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://www.google.com', 'https://www.gstatic.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://cdn.sanity.io', 'https://maps.googleapis.com'],
          frameSrc: ['https://www.google.com', 'https://www.youtube.com', 'https://player.vimeo.com'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'sameorigin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      permittedCrossDomainPolicies: false,
    }),
  );

  // Permissions Policy header (not in Helmet by default)
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });

  // ── CORS ─────────────────────────────────────────────────────────────────
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn('CORS blocked request from origin', { origin });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    }),
  );

  // ── Global rate limits (Upstash Redis in prod, memory in dev) ────────────
  const authRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: env.RATE_LIMIT_AUTH_PER_MIN,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
    keyGenerator: req => req.ip ?? 'unknown',
  });

  const publicRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: env.RATE_LIMIT_PUBLIC_PER_MIN,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  });

  // Apply auth-specific limit to login/logout routes
  app.use(`/api/${env.API_VERSION}/auth/login`, authRateLimit);
  app.use(`/api/${env.API_VERSION}/auth/logout`, authRateLimit);
  app.use(`/api/${env.API_VERSION}/contact`, publicRateLimit);

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  // ── Compression ───────────────────────────────────────────────────────────
  app.use(compression());

  // ── HTTP request logging ──────────────────────────────────────────────────
  app.use(
    morgan(
      ':method :url :status :res[content-length] - :response-time ms :remote-addr',
      { stream: httpLogStream, skip: req => req.path === '/api/v1/health' },
    ),
  );

  // ── API routes ────────────────────────────────────────────────────────────
  app.use(`/api/${env.API_VERSION}`, apiRouter);

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandler);

  return app;
}
