// src/utils/response.ts
// Standard envelope builders and typed custom error class

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiSuccess, ApiError as ApiErrorType } from '../types/api.types';

// ── Envelope builders ─────────────────────────────────────────────────────────

export function successResponse<T>(
  res: Response,
  data: T,
  statusCode = 200,
): Response {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    meta: {
      requestId: (res.locals.requestId as string) ?? uuidv4(),
      timestamp: new Date().toISOString(),
    },
  };
  return res.status(statusCode).json(body);
}

export function errorResponse(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Array<{ field: string; issue: string }>,
): Response {
  const body: ApiErrorType = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId: (res.locals.requestId as string) ?? uuidv4(),
      timestamp: new Date().toISOString(),
    },
  };
  return res.status(statusCode).json(body);
}

// ── Custom error class ────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Array<{ field: string; issue: string }>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: Array<{ field: string; issue: string }>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Expected, handled errors
    Error.captureStackTrace(this, this.constructor);
  }

  // Factory helpers for common cases
  static badRequest(message: string, details?: Array<{ field: string; issue: string }>) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string, code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  static forbidden(message: string, code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }

  static notFound(message: string) {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }

  static validation(details: Array<{ field: string; issue: string }>) {
    return new AppError('Validation failed', 422, 'VALIDATION_ERROR', details);
  }

  static rateLimited() {
    return new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
  }

  static internal(message = 'An unexpected error occurred') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}

// ── Pagination helper ─────────────────────────────────────────────────────────

export function parsePagination(
  query: Record<string, unknown>,
  maxLimit = 100,
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(String(query.page ?? 1), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}
