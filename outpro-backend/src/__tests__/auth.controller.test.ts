// src/__tests__/auth.controller.test.ts
// Unit tests for AuthController — mocks DB, bcrypt, JWT, speakeasy

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ── Mock all external dependencies ────────────────────────────────────────────

const JWT_SECRET = 'test-secret-that-is-at-least-64-characters-long-for-auth-controller-tests';

vi.mock('../config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET,
    JWT_EXPIRY: '8h',
    SESSION_MAX_AGE_SECONDS: 28800,
    BCRYPT_ROUNDS: 4,
    LOG_LEVEL: 'error',
    LOG_DIR: '/tmp',
  },
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockAuthModel = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  incrementFailedAttempts: vi.fn(),
  recordSuccessfulLogin: vi.fn(),
  createSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  storeMfaSecret: vi.fn(),
  enableMfa: vi.fn(),
  updatePassword: vi.fn(),
};

const mockAuditModel = { log: vi.fn() };

vi.mock('../models', () => ({
  AuthModel: mockAuthModel,
  AuditModel: mockAuditModel,
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock('speakeasy', () => ({
  default: {
    totp: { verify: vi.fn() },
    generateSecret: vi.fn(),
  },
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn() },
}));

vi.mock('uuid', () => ({ v4: () => 'mock-jti-uuid' }));

import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { AuthController } from '../controllers/auth.controller';

// ── Helper factories ──────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: { 'user-agent': 'test-agent' },
    cookies: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  const res = {
    locals: { requestId: 'req-test-123' },
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

function makeActiveUser(overrides = {}) {
  return {
    id: 'user-uuid-001',
    email: 'arjun@outpro.india',
    password_hash: '$2b$04$hashedPassword',
    full_name: 'Arjun Mehta',
    role: 'super_admin',
    mfa_enabled: false,
    mfa_secret: null,
    is_active: true,
    failed_attempts: 0,
    locked_until: null,
    last_login_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthModel.createSession.mockResolvedValue('session-id-001');
  mockAuditModel.log.mockResolvedValue(undefined);
  mockAuthModel.recordSuccessfulLogin.mockResolvedValue(undefined);
  mockAuthModel.incrementFailedAttempts.mockResolvedValue(undefined);
});

// ═══════════════════════════════════════════════════════════════════════════════
// login
// ═══════════════════════════════════════════════════════════════════════════════

describe('AuthController.login', () => {
  it('returns 401 when user does not exist', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(null);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const req = makeReq({ body: { email: 'nobody@outpro.india', password: 'pass' } });
    const res = makeRes();
    const next = makeNext();

    await AuthController.login(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 403 when account is inactive', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(makeActiveUser({ is_active: false }));
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const req = makeReq({ body: { email: 'arjun@outpro.india', password: 'pass' } });
    const next = makeNext();

    await AuthController.login(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('ACCOUNT_INACTIVE');
  });

  it('returns 403 when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 300_000).toISOString(); // 5 min from now
    mockAuthModel.findByEmail.mockResolvedValue(
      makeActiveUser({ locked_until: lockedUntil }),
    );
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const req = makeReq({ body: { email: 'arjun@outpro.india', password: 'pass' } });
    const next = makeNext();

    await AuthController.login(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('ACCOUNT_LOCKED');
  });

  it('returns 401 and increments failed_attempts when password is wrong', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(makeActiveUser());
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const req = makeReq({ body: { email: 'arjun@outpro.india', password: 'wrong' } });
    const next = makeNext();

    await AuthController.login(req, makeRes(), next);

    expect(mockAuthModel.incrementFailedAttempts).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 MFA_REQUIRED when mfa_enabled but no totpCode provided', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(
      makeActiveUser({ mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP' }),
    );
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const req = makeReq({ body: { email: 'arjun@outpro.india', password: 'correctPass' } });
    const next = makeNext();

    await AuthController.login(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('MFA_REQUIRED');
  });

  it('returns 401 INVALID_TOTP when totpCode is wrong', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(
      makeActiveUser({ mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP' }),
    );
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(speakeasy.totp.verify).mockReturnValue(false);

    const req = makeReq({
      body: { email: 'arjun@outpro.india', password: 'correctPass', totpCode: '000000' },
    });
    const next = makeNext();

    await AuthController.login(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('INVALID_TOTP');
  });

  it('returns 200 with token and sets HttpOnly cookie on successful login', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(makeActiveUser());
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const req = makeReq({ body: { email: 'arjun@outpro.india', password: 'correctPass' } });
    const res = makeRes();
    const next = makeNext();

    await AuthController.login(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledOnce();
    const [cookieName, , cookieOptions] = (res.cookie as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(cookieName).toBe('session');
    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.sameSite).toBe('strict');

    expect(res.json).toHaveBeenCalledOnce();
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.user.email).toBe('arjun@outpro.india');
    expect(body.data.user.role).toBe('super_admin');
  });

  it('records successful login and writes audit log', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(makeActiveUser());
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const req = makeReq({ body: { email: 'arjun@outpro.india', password: 'correctPass' } });

    await AuthController.login(req, makeRes(), makeNext());

    expect(mockAuthModel.recordSuccessfulLogin).toHaveBeenCalledOnce();
    expect(mockAuthModel.createSession).toHaveBeenCalledOnce();
    expect(mockAuditModel.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.login' }),
    );
  });

  it('succeeds with valid TOTP when MFA is enabled', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(
      makeActiveUser({ mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP' }),
    );
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(speakeasy.totp.verify).mockReturnValue(true);

    const req = makeReq({
      body: { email: 'arjun@outpro.india', password: 'correctPass', totpCode: '123456' },
    });
    const res = makeRes();
    const next = makeNext();

    await AuthController.login(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// logout
// ═══════════════════════════════════════════════════════════════════════════════

describe('AuthController.logout', () => {
  it('revokes session, clears cookie, and writes audit log', async () => {
    mockAuthModel.revokeSession.mockResolvedValue(undefined);

    const jti = 'mock-jti-uuid';
    const token = jwt.sign(
      { sub: 'user-001', email: 'arjun@outpro.india', role: 'super_admin', jti },
      JWT_SECRET,
    );

    const req = {
      ...makeReq({ cookies: { session: token } }),
      user: { id: 'user-001', email: 'arjun@outpro.india', role: 'super_admin', sessionId: 'sess-1' },
    } as unknown as Request;

    const res = makeRes();
    const next = makeNext();

    await AuthController.logout(req, res, next);

    expect(mockAuthModel.revokeSession).toHaveBeenCalledOnce();
    expect(res.clearCookie).toHaveBeenCalledWith('session', expect.any(Object));
    expect(mockAuditModel.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.logout' }),
    );
    expect(res.json).toHaveBeenCalledOnce();
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// me
// ═══════════════════════════════════════════════════════════════════════════════

describe('AuthController.me', () => {
  it('returns 404 when user no longer exists in DB', async () => {
    mockAuthModel.findById.mockResolvedValue(null);

    const req = {
      ...makeReq(),
      user: { id: 'user-001', email: 'a@b.com', role: 'editor', sessionId: 's1' },
    } as unknown as Request;
    const next = makeNext();

    await AuthController.me(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(404);
  });

  it('returns user data when found', async () => {
    const user = {
      id: 'user-001',
      email: 'arjun@outpro.india',
      full_name: 'Arjun Mehta',
      role: 'super_admin',
      mfa_enabled: true,
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
    };
    mockAuthModel.findById.mockResolvedValue(user);

    const req = {
      ...makeReq(),
      user: { id: 'user-001', email: 'arjun@outpro.india', role: 'super_admin', sessionId: 's1' },
    } as unknown as Request;
    const res = makeRes();

    await AuthController.me(req, res, makeNext());

    expect(res.json).toHaveBeenCalled();
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.email).toBe('arjun@outpro.india');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// changePassword
// ═══════════════════════════════════════════════════════════════════════════════

describe('AuthController.changePassword', () => {
  it('returns 401 when current password is incorrect', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(makeActiveUser());
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const req = {
      ...makeReq({
        body: { currentPassword: 'wrong', newPassword: 'New@Pass123!', confirmPassword: 'New@Pass123!' },
        cookies: { session: '' },
      }),
      user: { id: 'user-001', email: 'arjun@outpro.india', role: 'super_admin', sessionId: 's1' },
    } as unknown as Request;
    const next = makeNext();

    await AuthController.changePassword(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  it('updates password and revokes other sessions on success', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(makeActiveUser());
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue('new-hash' as never);
    mockAuthModel.updatePassword.mockResolvedValue(undefined);
    mockAuthModel.revokeAllUserSessions.mockResolvedValue(undefined);

    const req = {
      ...makeReq({
        body: { currentPassword: 'Old@Pass123!', newPassword: 'New@Pass456!', confirmPassword: 'New@Pass456!' },
        cookies: { session: '' },
      }),
      user: { id: 'user-001', email: 'arjun@outpro.india', role: 'super_admin', sessionId: 's1' },
    } as unknown as Request;
    const res = makeRes();

    await AuthController.changePassword(req, res, makeNext());

    expect(mockAuthModel.updatePassword).toHaveBeenCalledWith('user-001', 'new-hash');
    expect(mockAuthModel.revokeAllUserSessions).toHaveBeenCalledOnce();
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MFA setup + verify
// ═══════════════════════════════════════════════════════════════════════════════

describe('AuthController.mfaSetup', () => {
  it('returns QR code data URL and manual key', async () => {
    vi.mocked(speakeasy.generateSecret).mockReturnValue({
      base32: 'JBSWY3DPEHPK3PXP',
      otpauth_url: 'otpauth://totp/Outpro.India%20(arjun%40outpro.india)?secret=JBSWY3DPEHPK3PXP',
    } as never);
    vi.mocked(QRCode.toDataURL).mockResolvedValue('data:image/png;base64,abc123' as never);
    mockAuthModel.storeMfaSecret.mockResolvedValue(undefined);

    const req = {
      ...makeReq(),
      user: { id: 'user-001', email: 'arjun@outpro.india', role: 'super_admin', sessionId: 's1' },
    } as unknown as Request;
    const res = makeRes();

    await AuthController.mfaSetup(req, res, makeNext());

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.qrCode).toContain('data:image/png;base64,');
    expect(body.data.manualKey).toBe('JBSWY3DPEHPK3PXP');
    expect(mockAuthModel.storeMfaSecret).toHaveBeenCalledWith('user-001', 'JBSWY3DPEHPK3PXP');
  });
});

describe('AuthController.mfaVerify', () => {
  it('returns 400 when MFA setup not started', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(makeActiveUser({ mfa_secret: null }));

    const req = {
      ...makeReq({ body: { totpCode: '123456' } }),
      user: { id: 'user-001', email: 'arjun@outpro.india', role: 'super_admin', sessionId: 's1' },
    } as unknown as Request;
    const next = makeNext();

    await AuthController.mfaVerify(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(400);
  });

  it('returns 401 for invalid TOTP code', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(
      makeActiveUser({ mfa_secret: 'JBSWY3DPEHPK3PXP' }),
    );
    vi.mocked(speakeasy.totp.verify).mockReturnValue(false);

    const req = {
      ...makeReq({ body: { totpCode: '000000' } }),
      user: { id: 'user-001', email: 'arjun@outpro.india', role: 'super_admin', sessionId: 's1' },
    } as unknown as Request;
    const next = makeNext();

    await AuthController.mfaVerify(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('INVALID_TOTP');
  });

  it('enables MFA and writes audit log on valid code', async () => {
    mockAuthModel.findByEmail.mockResolvedValue(
      makeActiveUser({ mfa_secret: 'JBSWY3DPEHPK3PXP' }),
    );
    vi.mocked(speakeasy.totp.verify).mockReturnValue(true);
    mockAuthModel.enableMfa.mockResolvedValue(undefined);

    const req = {
      ...makeReq({ body: { totpCode: '123456' } }),
      user: { id: 'user-001', email: 'arjun@outpro.india', role: 'super_admin', sessionId: 's1' },
    } as unknown as Request;
    const res = makeRes();

    await AuthController.mfaVerify(req, res, makeNext());

    expect(mockAuthModel.enableMfa).toHaveBeenCalledWith('user-001');
    expect(mockAuditModel.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.mfa_enabled' }),
    );
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
  });
});
