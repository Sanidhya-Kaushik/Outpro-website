// src/__tests__/middleware.test.ts
// Unit tests for Express middleware

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// ── Mock dependencies before importing middleware ─────────────────────────────
vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-that-is-at-least-64-characters-long-for-vitest-testing-12345',
    NODE_ENV: 'test',
    SESSION_MAX_AGE_SECONDS: 28800,
    BCRYPT_ROUNDS: 12,
    RATE_LIMIT_AUTH_PER_MIN: 10,
    RATE_LIMIT_PUBLIC_PER_MIN: 100,
    RATE_LIMIT_AUTHED_PER_MIN: 1000,
    LOG_LEVEL: 'error',
    LOG_DIR: '/tmp/test-logs',
    JWT_EXPIRY: '8h',
  },
}));

vi.mock('../config/database', () => ({
  query: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), http: vi.fn() },
}));

import { validate, authorise, requestId, errorHandler } from '../middleware';
import { AppError } from '../utils/response';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    cookies: {},
    ip: '127.0.0.1',
    method: 'GET',
    path: '/test',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response & { locals: Record<string, unknown> } {
  const res = {
    locals: {},
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    clearCookie: vi.fn(),
  };
  return res as unknown as Response & { locals: Record<string, unknown> };
}

function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ── requestId ─────────────────────────────────────────────────────────────────

describe('requestId middleware', () => {
  it('generates a UUID and sets X-Request-Id header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    requestId(req, res as unknown as Response, next);

    expect(res.locals.requestId).toBeDefined();
    expect(typeof res.locals.requestId).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', res.locals.requestId);
    expect(next).toHaveBeenCalledOnce();
  });

  it('uses existing X-Request-Id header if provided', () => {
    const req = mockReq({ headers: { 'x-request-id': 'existing-id-123' } });
    const res = mockRes();
    const next = mockNext();

    requestId(req, res as unknown as Response, next);

    expect(res.locals.requestId).toBe('existing-id-123');
  });
});

// ── validate ──────────────────────────────────────────────────────────────────

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().positive(),
  });

  it('passes valid body to next and replaces req.body with parsed data', () => {
    const req = mockReq({ body: { name: 'Alice', age: 30 } });
    const res = mockRes();
    const next = mockNext();

    validate(schema)(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(); // called with no args
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('calls next with AppError on validation failure', () => {
    const req = mockReq({ body: { name: 'A', age: -1 } });
    const res = mockRes();
    const next = mockNext();

    validate(schema)(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toBeDefined();
    expect(err.details.length).toBeGreaterThan(0);
  });

  it('validates query params when target is "query"', () => {
    const qSchema = z.object({ page: z.string().transform(Number) });
    const req = mockReq({ query: { page: '2' } as Record<string, string> });
    const res = mockRes();
    const next = mockNext();

    validate(qSchema, 'query')(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect((req.query as Record<string, unknown>).page).toBe(2); // Coerced
  });

  it('returns multiple field errors for multiple failures', () => {
    const req = mockReq({ body: { name: 'A', age: 'not-a-number' } });
    const res = mockRes();
    const next = mockNext();

    validate(schema)(req, res as unknown as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.details!.length).toBeGreaterThanOrEqual(1);
  });
});

// ── authorise ─────────────────────────────────────────────────────────────────

describe('authorise middleware', () => {
  function reqWithRole(role: string): Request {
    return {
      ...mockReq(),
      user: { id: 'user-1', email: 'a@b.com', role, sessionId: 'sess-1' },
    } as unknown as Request;
  }

  it('allows super_admin to access super_admin-only routes', () => {
    const req = reqWithRole('super_admin');
    const res = mockRes();
    const next = mockNext();

    authorise('super_admin')(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(); // No error arg
  });

  it('allows editor to access editor+ routes', () => {
    const req = reqWithRole('editor');
    const res = mockRes();
    const next = mockNext();

    authorise('super_admin', 'editor')(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks viewer from super_admin routes', () => {
    const req = reqWithRole('viewer');
    const res = mockRes();
    const next = mockNext();

    authorise('super_admin')(req, res as unknown as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it('blocks editor from super_admin-only routes', () => {
    const req = reqWithRole('editor');
    const res = mockRes();
    const next = mockNext();

    authorise('super_admin')(req, res as unknown as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('blocks request with no user', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    authorise('viewer')(req, res as unknown as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });
});

// ── errorHandler ──────────────────────────────────────────────────────────────

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 422 VALIDATION_ERROR for AppError.validation()', () => {
    const err = AppError.validation([{ field: 'email', issue: 'Invalid email' }]);
    const req = mockReq();
    const res = mockRes();
    res.locals.requestId = 'req-123';
    const next = mockNext();

    errorHandler(err, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(422);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('returns 404 NOT_FOUND for AppError.notFound()', () => {
    const err = AppError.notFound('Lead not found');
    const req = mockReq();
    const res = mockRes();
    res.locals.requestId = 'req-456';
    const next = mockNext();

    errorHandler(err, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Lead not found');
  });

  it('returns 500 INTERNAL_ERROR for unknown errors', () => {
    const err = new Error('Unexpected failure');
    const req = mockReq();
    const res = mockRes();
    res.locals.requestId = 'req-789';
    const next = mockNext();

    errorHandler(err, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 409 CONFLICT for Postgres unique_violation (23505)', () => {
    const pgErr = Object.assign(new Error('duplicate key'), { code: '23505' });
    const req = mockReq();
    const res = mockRes();
    res.locals.requestId = 'req-000';
    const next = mockNext();

    errorHandler(pgErr, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(409);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error.code).toBe('CONFLICT');
  });

  it('includes requestId in error envelope', () => {
    const err = AppError.badRequest('Bad input');
    const req = mockReq();
    const res = mockRes();
    res.locals.requestId = 'my-trace-id';
    const next = mockNext();

    errorHandler(err, req, res as unknown as Response, next);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error.requestId).toBe('my-trace-id');
  });
});

// ── AppError factory ──────────────────────────────────────────────────────────

describe('AppError factories', () => {
  it('creates correct status codes', () => {
    expect(AppError.badRequest('x').statusCode).toBe(400);
    expect(AppError.unauthorized('x').statusCode).toBe(401);
    expect(AppError.forbidden('x').statusCode).toBe(403);
    expect(AppError.notFound('x').statusCode).toBe(404);
    expect(AppError.conflict('x').statusCode).toBe(409);
    expect(AppError.validation([]).statusCode).toBe(422);
    expect(AppError.rateLimited().statusCode).toBe(429);
    expect(AppError.internal().statusCode).toBe(500);
  });

  it('marks operational errors correctly', () => {
    expect(AppError.badRequest('x').isOperational).toBe(true);
    expect(AppError.internal('x').isOperational).toBe(true);
  });
});
