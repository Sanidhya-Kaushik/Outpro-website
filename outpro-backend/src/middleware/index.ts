// src/middleware/index.ts
// All Express middleware — imported individually in app.ts and route files

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { query } from '../config/database';
import { AppError, errorResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { AdminRole, AuthenticatedRequest, JwtPayload } from '../types/api.types';

// ── Request ID ────────────────────────────────────────────────────────────────

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

// ── JWT Authentication ────────────────────────────────────────────────────────

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Accept token from HttpOnly cookie or Bearer header
    const token =
      (req.cookies as Record<string, string>)['session'] ??
      req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return next(AppError.unauthorized('Authentication token is required'));
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return next(AppError.unauthorized('Session has expired', 'SESSION_EXPIRED'));
      }
      return next(AppError.unauthorized('Invalid authentication token'));
    }

    // Check session revocation in DB
    const sessionResult = await query(
      `SELECT id, revoked, expires_at FROM admin_sessions
       WHERE jwt_jti = $1 AND admin_user_id = $2`,
      [payload.jti, payload.sub],
    );

    if (sessionResult.rowCount === 0) {
      return next(AppError.unauthorized('Session not found', 'SESSION_INVALID'));
    }

    const session = sessionResult.rows[0];
    if (session.revoked || new Date(session.expires_at) < new Date()) {
      return next(AppError.unauthorized('Session has been revoked', 'SESSION_REVOKED'));
    }

    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: session.id as string,
    };

    next();
  } catch (err) {
    next(err);
  }
}

// ── Role-Based Authorisation ──────────────────────────────────────────────────

export function authorise(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || !roles.includes(user.role)) {
      return next(AppError.forbidden('Insufficient permissions to access this resource'));
    }
    next();
  };
}

// ── Zod Schema Validation ─────────────────────────────────────────────────────

type ValidateTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidateTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const details = (result.error as ZodError).issues.map(issue => ({
        field: issue.path.join('.'),
        issue: issue.message,
      }));
      return next(AppError.validation(details));
    }
    // Replace raw input with parsed + coerced values
    req[target] = result.data as typeof req[typeof target];
    next();
  };
}

// ── Webhook Secret Validation ─────────────────────────────────────────────────

export function validateWebhookSecret(req: Request, _res: Response, next: NextFunction): void {
  const secret = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!secret || secret !== env.REVALIDATION_SECRET) {
    return next(AppError.forbidden('Invalid webhook secret'));
  }
  next();
}

// ── Global Error Handler ──────────────────────────────────────────────────────

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Already-handled AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Operational error', {
        requestId: res.locals.requestId,
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });
    } else {
      logger.warn('Client error', {
        requestId: res.locals.requestId,
        code: err.code,
        message: err.message,
        path: req.path,
        method: req.method,
      });
    }
    errorResponse(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // Postgres constraint violations
  if (isPostgresError(err)) {
    if (err.code === '23505') {
      // unique_violation
      errorResponse(res, 409, 'CONFLICT', 'A record with this value already exists');
      return;
    }
    if (err.code === '23503') {
      // foreign_key_violation
      errorResponse(res, 400, 'BAD_REQUEST', 'Referenced resource does not exist');
      return;
    }
  }

  // Unexpected errors — log full details, return generic message
  logger.error('Unhandled error', {
    requestId: res.locals.requestId,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  errorResponse(
    res,
    500,
    'INTERNAL_ERROR',
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : (err instanceof Error ? err.message : String(err)),
  );
}

// ── 404 Handler ───────────────────────────────────────────────────────────────

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
}

// ── Type guard ────────────────────────────────────────────────────────────────

interface PostgresError extends Error {
  code?: string;
}

function isPostgresError(err: unknown): err is PostgresError {
  return err instanceof Error && 'code' in err;
}
