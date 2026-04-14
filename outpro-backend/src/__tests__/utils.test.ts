// src/__tests__/utils.test.ts
// Unit tests for utility functions: sanitise, response helpers, recaptcha

import { describe, it, expect, vi } from 'vitest';

// ── Mock env for recaptcha tests ──────────────────────────────────────────────
vi.mock('../config/env', () => ({
  env: {
    NODE_ENV: 'development', // NOT 'test' — so recaptcha runs the real path in some tests
    RECAPTCHA_SECRET_KEY: 'test-secret',
    RECAPTCHA_MIN_SCORE: 0.5,
    LOG_LEVEL: 'error',
    LOG_DIR: '/tmp',
  },
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

import { sanitiseString, sanitiseObject, redactIp, timingSafeEqual } from '../utils/sanitise';
import { AppError, parsePagination } from '../utils/response';

// ── sanitiseString ────────────────────────────────────────────────────────────

describe('sanitiseString', () => {
  it('strips HTML tags', () => {
    expect(sanitiseString('<script>alert("xss")</script>Hello')).toBe('Hello');
  });

  it('strips anchor tags', () => {
    expect(sanitiseString('<a href="evil.com">Click</a>')).toBe('Click');
  });

  it('strips image tags', () => {
    expect(sanitiseString('Text<img src=x onerror=alert(1)>More')).toBe('TextMore');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitiseString('  hello world  ')).toBe('hello world');
  });

  it('collapses internal whitespace', () => {
    expect(sanitiseString('hello   world')).toBe('hello world');
  });

  it('preserves clean text unchanged', () => {
    expect(sanitiseString('Neha Kapoor')).toBe('Neha Kapoor');
  });

  it('preserves unicode characters', () => {
    expect(sanitiseString('नमस्ते')).toBe('नमस्ते');
  });

  it('handles empty string', () => {
    expect(sanitiseString('')).toBe('');
  });

  it('handles string with only tags', () => {
    expect(sanitiseString('<b><i></i></b>')).toBe('');
  });

  it('strips event handler attributes', () => {
    expect(sanitiseString('<div onclick="evil()">Text</div>')).toBe('Text');
  });
});

// ── sanitiseObject ────────────────────────────────────────────────────────────

describe('sanitiseObject', () => {
  it('sanitises all string fields', () => {
    const input = {
      name: '<script>alert(1)</script>Neha',
      email: 'neha@example.com',
      message: '  Hello   World  ',
    };
    const result = sanitiseObject(input);
    expect(result.name).toBe('Neha');
    expect(result.email).toBe('neha@example.com');
    expect(result.message).toBe('Hello World');
  });

  it('leaves non-string fields unchanged', () => {
    const input = { count: 42, active: true, tags: ['a', 'b'], nested: { x: 1 } };
    const result = sanitiseObject(input);
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.tags).toEqual(['a', 'b']);
    expect(result.nested).toEqual({ x: 1 });
  });

  it('does not mutate the original object', () => {
    const input = { name: '<b>bold</b>' };
    const original = { ...input };
    sanitiseObject(input);
    expect(input).toEqual(original);
  });

  it('handles empty object', () => {
    expect(sanitiseObject({})).toEqual({});
  });
});

// ── redactIp ──────────────────────────────────────────────────────────────────

describe('redactIp', () => {
  it('redacts last two octets of IPv4', () => {
    expect(redactIp('192.168.1.100')).toBe('192.168.x.x');
  });

  it('redacts last two octets of any IPv4', () => {
    expect(redactIp('10.0.0.1')).toBe('10.0.x.x');
  });

  it('returns null for null input', () => {
    expect(redactIp(null)).toBeNull();
  });

  it('handles IPv6 addresses', () => {
    const result = redactIp('2001:db8:85a3:0:0:8a2e:370:7334');
    expect(result).toContain('xxxx');
    expect(result).not.toContain('7334'); // Last segment must be redacted
  });

  it('handles empty string', () => {
    expect(redactIp('')).toBeNull();
  });
});

// ── timingSafeEqual ───────────────────────────────────────────────────────────

describe('timingSafeEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('secret123', 'secret123')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(timingSafeEqual('secret123', 'wrong456')).toBe(false);
  });

  it('returns false for different length strings', () => {
    expect(timingSafeEqual('short', 'much-longer-string')).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    expect(timingSafeEqual('', 'notempty')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('is case-sensitive', () => {
    expect(timingSafeEqual('SECRET', 'secret')).toBe(false);
  });
});

// ── parsePagination ───────────────────────────────────────────────────────────

describe('parsePagination', () => {
  it('returns defaults for empty query', () => {
    const result = parsePagination({});
    expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('parses page and limit from strings', () => {
    const result = parsePagination({ page: '3', limit: '10' });
    expect(result).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('clamps page to minimum 1', () => {
    const result = parsePagination({ page: '-5' });
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it('clamps limit to minimum 1', () => {
    const result = parsePagination({ limit: '0' });
    expect(result.limit).toBe(1);
  });

  it('clamps limit to maxLimit', () => {
    const result = parsePagination({ limit: '9999' }, 50);
    expect(result.limit).toBe(50);
  });

  it('handles non-numeric strings gracefully', () => {
    const result = parsePagination({ page: 'abc', limit: 'xyz' });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('calculates offset correctly for page 2 limit 10', () => {
    const result = parsePagination({ page: '2', limit: '10' });
    expect(result.offset).toBe(10);
  });

  it('calculates offset correctly for page 5 limit 20', () => {
    const result = parsePagination({ page: '5', limit: '20' });
    expect(result.offset).toBe(80);
  });
});

// ── AppError ──────────────────────────────────────────────────────────────────

describe('AppError', () => {
  describe('static factories', () => {
    it('badRequest returns 400', () => {
      const err = AppError.badRequest('Invalid input');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('BAD_REQUEST');
      expect(err.message).toBe('Invalid input');
      expect(err.isOperational).toBe(true);
    });

    it('unauthorized returns 401', () => {
      const err = AppError.unauthorized('No token');
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    });

    it('unauthorized accepts custom code', () => {
      const err = AppError.unauthorized('Expired', 'SESSION_EXPIRED');
      expect(err.code).toBe('SESSION_EXPIRED');
    });

    it('forbidden returns 403', () => {
      const err = AppError.forbidden('No access');
      expect(err.statusCode).toBe(403);
    });

    it('notFound returns 404', () => {
      const err = AppError.notFound('Resource missing');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    });

    it('conflict returns 409', () => {
      const err = AppError.conflict('Duplicate');
      expect(err.statusCode).toBe(409);
    });

    it('validation returns 422 with details', () => {
      const details = [{ field: 'email', issue: 'Required' }];
      const err = AppError.validation(details);
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details).toEqual(details);
    });

    it('rateLimited returns 429', () => {
      const err = AppError.rateLimited();
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('internal returns 500', () => {
      const err = AppError.internal();
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
    });

    it('internal accepts custom message', () => {
      const err = AppError.internal('DB is down');
      expect(err.message).toBe('DB is down');
    });
  });

  describe('constructor', () => {
    it('creates error with all properties', () => {
      const err = new AppError('test error', 422, 'MY_CODE', [{ field: 'f', issue: 'i' }]);
      expect(err.message).toBe('test error');
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('MY_CODE');
      expect(err.details).toEqual([{ field: 'f', issue: 'i' }]);
      expect(err.isOperational).toBe(true);
      expect(err instanceof Error).toBe(true);
      expect(err instanceof AppError).toBe(true);
    });

    it('has stack trace', () => {
      const err = new AppError('test');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('AppError');
    });
  });
});
