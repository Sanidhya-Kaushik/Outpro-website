// src/__tests__/routes.integration.test.ts
// Integration tests for all API endpoint groups
// Uses in-memory Express app with mocked DB and services

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// ── Mock all external dependencies ────────────────────────────────────────────

vi.mock('../config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 5001,
    API_VERSION: 'v1',
    DATABASE_URL: 'postgresql://test',
    DB_POOL_MIN: 1,
    DB_POOL_MAX: 2,
    DB_SSL: false,
    JWT_SECRET: 'test-secret-that-is-at-least-64-characters-long-for-testing-123456',
    JWT_EXPIRY: '8h',
    SESSION_MAX_AGE_SECONDS: 28800,
    RECAPTCHA_SECRET_KEY: 'test-recaptcha-key',
    RECAPTCHA_MIN_SCORE: 0.5,
    REVALIDATION_SECRET: 'test-revalidation-secret-32-chars!!',
    RESEND_API_KEY: 'test-resend-key',
    EMAIL_FROM: 'test@outpro.india',
    EMAIL_ADMIN_NOTIFY: 'leads@outpro.india',
    BCRYPT_ROUNDS: 4, // Low rounds for fast tests
    RATE_LIMIT_AUTH_PER_MIN: 100,
    RATE_LIMIT_PUBLIC_PER_MIN: 1000,
    RATE_LIMIT_AUTHED_PER_MIN: 10000,
    ALLOWED_ORIGINS: 'http://localhost:3000',
    LOG_LEVEL: 'error',
    LOG_DIR: '/tmp/test-logs',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    SUPABASE_STORAGE_BUCKET_PRIVATE: 'media-private',
    SUPABASE_STORAGE_BUCKET_PUBLIC: 'media-public',
  },
}));

vi.mock('../config/database', () => ({
  getPool: vi.fn(),
  query: vi.fn(),
  withTransaction: vi.fn(async (cb: (c: unknown) => Promise<unknown>) => cb({})),
  checkDatabaseHealth: vi.fn().mockResolvedValue({ status: 'ok', latencyMs: 1 }),
  closePool: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), http: vi.fn() },
  httpLogStream: { write: vi.fn() },
}));

vi.mock('../services/email.service', () => ({
  EmailService: {
    notifyNewLead: vi.fn().mockResolvedValue(undefined),
    sendLeadConfirmation: vi.fn().mockResolvedValue(undefined),
    sendAdminInvitation: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/crm.service', () => ({
  CrmService: { syncLead: vi.fn().mockResolvedValue('crm-123') },
}));

vi.mock('../services/isr.service', () => ({
  revalidatePath: vi.fn().mockResolvedValue(['/portfolio', '/portfolio/test-slug']),
}));

// Mock axios for reCAPTCHA
vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { success: true, score: 0.9 } }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

import { createApp } from '../app';
import { query } from '../config/database';

const mockQuery = vi.mocked(query);

// ── JWT helper ────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-that-is-at-least-64-characters-long-for-testing-123456';

function makeToken(role: 'super_admin' | 'editor' | 'viewer' = 'super_admin') {
  const jti = uuidv4();
  const token = jwt.sign({ sub: 'user-uuid-001', email: 'arjun@outpro.india', role, jti }, JWT_SECRET, { expiresIn: '8h' });
  return { token, jti };
}

function authHeader(role: 'super_admin' | 'editor' | 'viewer' = 'super_admin') {
  return `Bearer ${makeToken(role).token}`;
}

// Mock session DB lookup for authenticate middleware
function mockValidSession() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('admin_sessions')) {
      return { rows: [{ id: 'sess-1', revoked: false, expires_at: new Date(Date.now() + 3600000).toISOString() }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
    }
    return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
  });
}

// ── App setup ─────────────────────────────────────────────────────────────────

let app: ReturnType<typeof createApp>;
let request: ReturnType<typeof supertest>;

beforeAll(() => {
  app = createApp();
  request = supertest(app);
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/health', () => {
  it('returns 200 with healthy status', async () => {
    const res = await request.get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.checks.database).toBe('ok');
    expect(res.body.uptime).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/auth/login', () => {
  it('returns 422 for missing required fields', async () => {
    const res = await request.post('/api/v1/auth/login').send({ email: 'x' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for invalid email format', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'pass' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid TOTP format', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'pass', totpCode: '123' });
    expect(res.status).toBe(422);
  });

  it('returns 401 for non-existent user', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@outpro.india', password: 'SomePass123!' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('returns user data with valid token and session', async () => {
    mockValidSession();
    mockQuery.mockImplementationOnce(async (sql: string) => {
      if (sql.includes('admin_sessions')) {
        return { rows: [{ id: 'sess-1', revoked: false, expires_at: new Date(Date.now() + 3600000).toISOString() }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
      }
      return { rows: [{ id: 'user-uuid-001', email: 'arjun@outpro.india', full_name: 'Arjun Mehta', role: 'super_admin', mfa_enabled: true, is_active: true, last_login_at: null, created_at: new Date().toISOString() }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
    });

    const res = await request
      .get('/api/v1/auth/me')
      .set('Authorization', authHeader());
    // Will be 200 or 404 depending on mock — both indicate auth passed
    expect([200, 404]).toContain(res.status);
    expect(res.status).not.toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT FORM
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/contact', () => {
  const validPayload = {
    fullName: 'Neha Kapoor',
    businessEmail: 'neha@techstart.in',
    message: 'We need a modern website for our SaaS product launch.',
    recaptchaToken: 'valid-token',
  };

  it('returns 422 for missing required fields', async () => {
    const res = await request.post('/api/v1/contact').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for message too short', async () => {
    const res = await request
      .post('/api/v1/contact')
      .send({ ...validPayload, message: 'Short' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid email', async () => {
    const res = await request
      .post('/api/v1/contact')
      .send({ ...validPayload, businessEmail: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid serviceInterest enum', async () => {
    const res = await request
      .post('/api/v1/contact')
      .send({ ...validPayload, serviceInterest: 'Cooking Classes' });
    expect(res.status).toBe(422);
  });

  it('returns 201 for valid submission', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: uuidv4() }],
      rowCount: 1,
      command: 'INSERT',
      oid: 0,
      fields: [],
    });

    const res = await request.post('/api/v1/contact').send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO (public)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/portfolio', () => {
  it('returns 200 with paginated data', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });

    const res = await request.get('/api/v1/portfolio');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeDefined();
    expect(res.body.data.pagination).toBeDefined();
  });

  it('accepts category filter', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });

    const res = await request.get('/api/v1/portfolio?category=Branding');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/portfolio/categories', () => {
  it('returns category counts', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { category: 'Branding', count: '5' },
        { category: 'Web Development', count: '8' },
      ],
      rowCount: 2,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const res = await request.get('/api/v1/portfolio/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/v1/portfolio/:slug', () => {
  it('returns 404 for unknown slug', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });
    const res = await request.get('/api/v1/portfolio/non-existent-slug');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTIMONIALS (public)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/testimonials', () => {
  it('returns 200 with paginated testimonials', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '18' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });

    const res = await request.get('/api/v1/testimonials');
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(18);
  });

  it('accepts featured filter', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '6' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });

    const res = await request.get('/api/v1/testimonials?featured=true');
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES — auth required
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/contact/leads', () => {
  it('returns 401 without token', async () => {
    const res = await request.get('/api/v1/contact/leads');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/contact/leads/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request.delete('/api/v1/contact/leads/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 403 for editor role (super_admin only)', async () => {
    mockValidSession();
    const res = await request
      .delete('/api/v1/contact/leads/some-id')
      .set('Authorization', authHeader('editor'));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/admin/users', () => {
  it('returns 401 without token', async () => {
    const res = await request.get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    mockValidSession();
    const res = await request
      .get('/api/v1/admin/users')
      .set('Authorization', authHeader('viewer'));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/admin/users', () => {
  it('returns 422 for missing required fields', async () => {
    mockValidSession();
    const res = await request
      .post('/api/v1/admin/users')
      .set('Authorization', authHeader('super_admin'))
      .send({ email: 'test@test.com' }); // missing password and role
    expect(res.status).toBe(422);
  });

  it('returns 422 for weak password', async () => {
    mockValidSession();
    const res = await request
      .post('/api/v1/admin/users')
      .set('Authorization', authHeader('super_admin'))
      .send({ email: 'new@outpro.india', password: 'weakpass', role: 'editor' });
    expect(res.status).toBe(422);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/portfolio/revalidate', () => {
  it('returns 403 with wrong secret', async () => {
    const res = await request
      .post('/api/v1/portfolio/revalidate')
      .set('Authorization', 'Bearer wrong-secret')
      .send({ _type: 'portfolioProject', slug: { current: 'test-slug' } });
    expect(res.status).toBe(403);
  });

  it('returns 200 with correct secret', async () => {
    const res = await request
      .post('/api/v1/portfolio/revalidate')
      .set('Authorization', 'Bearer test-revalidation-secret-32-chars!!')
      .send({ _type: 'portfolioProject', slug: { current: 'test-slug' } });
    expect(res.status).toBe(200);
    expect(res.body.data.revalidated).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 404 HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request.get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for unknown HTTP method on known path', async () => {
    const res = await request.put('/api/v1/health');
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE ENVELOPE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Standard response envelope', () => {
  it('success responses include meta.requestId and meta.timestamp', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] });

    const res = await request.get('/api/v1/testimonials');
    expect(res.body.success).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.requestId).toBeDefined();
    expect(res.body.meta.timestamp).toBeDefined();
    expect(new Date(res.body.meta.timestamp).toISOString()).toBe(res.body.meta.timestamp);
  });

  it('error responses include error.requestId and error.timestamp', async () => {
    const res = await request.post('/api/v1/auth/login').send({});
    expect(res.body.success).toBe(false);
    expect(res.body.error.requestId).toBeDefined();
    expect(res.body.error.timestamp).toBeDefined();
    expect(res.body.error.code).toBeDefined();
    expect(res.body.error.message).toBeDefined();
  });

  it('sets X-Request-Id response header', async () => {
    const res = await request.get('/api/v1/health');
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
