// src/controllers/auth.controller.ts
// Authentication — login, logout, profile, password change, MFA

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { AuthModel } from '../models';
import { AuditModel } from '../models';
import { AppError, successResponse } from '../utils/response';
import { AuthenticatedRequest, JwtPayload } from '../types/api.types';
import { LoginInput, ChangePasswordInput } from '../validators';
import { logger } from '../utils/logger';

// Constant-time delay to prevent user enumeration
const CONSTANT_DELAY_MS = 300;

function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRY as jwt.SignOptions['expiresIn'] });
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie('session', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: env.SESSION_MAX_AGE_SECONDS * 1000,
    path: '/',
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie('session', { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict' });
}

// Exponential backoff lockout: 5 attempts → lock for 2^(attempts-5) minutes, max 60 min
function getLockoutUntil(failedAttempts: number): Date | null {
  if (failedAttempts < 4) return null;
  const minutes = Math.min(60, Math.pow(2, failedAttempts - 4));
  return new Date(Date.now() + minutes * 60 * 1000);
}

export const AuthController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const delay = new Promise(r => setTimeout(r, CONSTANT_DELAY_MS));
    try {
      const body = req.body as LoginInput;
      const ip = req.ip ?? 'unknown';

      const user = await AuthModel.findByEmail(body.email);
      await delay; // Always wait — prevents timing-based enumeration

      if (!user) {
        return next(AppError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS'));
      }

      if (!user.is_active) {
        return next(AppError.forbidden('Account is inactive', 'ACCOUNT_INACTIVE'));
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return next(AppError.forbidden('Account is temporarily locked', 'ACCOUNT_LOCKED'));
      }

      const passwordValid = await bcrypt.compare(body.password, user.password_hash);
      if (!passwordValid) {
        const lockUntil = getLockoutUntil(user.failed_attempts + 1);
        await AuthModel.incrementFailedAttempts(user.id, lockUntil);
        logger.warn('Failed login attempt', { email: body.email, ip, failedAttempts: user.failed_attempts + 1 });
        return next(AppError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS'));
      }

      if (user.mfa_enabled) {
        if (!body.totpCode) {
          return next(AppError.unauthorized('TOTP code is required', 'MFA_REQUIRED'));
        }
        const valid = speakeasy.totp.verify({
          secret: user.mfa_secret!,
          encoding: 'base32',
          token: body.totpCode,
          window: 1,
        });
        if (!valid) {
          return next(AppError.unauthorized('Invalid or expired TOTP code', 'INVALID_TOTP'));
        }
      }

      await AuthModel.recordSuccessfulLogin(user.id, ip);

      const jti = uuidv4();
      const expiresAt = new Date(Date.now() + env.SESSION_MAX_AGE_SECONDS * 1000);
      const token = signJwt({ sub: user.id, email: user.email, role: user.role as JwtPayload['role'], jti });

      await AuthModel.createSession(user.id, jti, expiresAt);

      await AuditModel.log({
        actorId: user.id, actorEmail: user.email, action: 'admin.login',
        ipAddress: ip, userAgent: req.headers['user-agent'],
      });

      setSessionCookie(res, token);

      successResponse(res, {
        token,
        expiresAt: expiresAt.toISOString(),
        user: {
          id: user.id, email: user.email, fullName: user.full_name,
          role: user.role, mfaEnabled: user.mfa_enabled,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const token = (req.cookies as Record<string, string>)['session'];

      if (token) {
        const payload = jwt.decode(token) as JwtPayload | null;
        if (payload?.jti) await AuthModel.revokeSession(payload.jti);
      }

      await AuditModel.log({ actorId: user.id, actorEmail: user.email, action: 'admin.logout' });
      clearSessionCookie(res);
      successResponse(res, { message: 'Logged out successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = (req as AuthenticatedRequest).user;
      const user = await AuthModel.findById(id);
      if (!user) return next(AppError.notFound('User not found'));
      successResponse(res, user);
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, email } = (req as AuthenticatedRequest).user;
      const body = req.body as ChangePasswordInput;

      const user = await AuthModel.findByEmail(email);
      if (!user) return next(AppError.notFound('User not found'));

      const currentValid = await bcrypt.compare(body.currentPassword, user.password_hash);
      if (!currentValid) {
        return next(AppError.unauthorized('Current password is incorrect', 'INVALID_CREDENTIALS'));
      }

      const newHash = await bcrypt.hash(body.newPassword, env.BCRYPT_ROUNDS);
      await AuthModel.updatePassword(id, newHash);

      // Revoke all other active sessions (force re-login on other devices)
      const currentJti = jwt.decode((req.cookies as Record<string, string>)['session'] ?? '') as JwtPayload | null;
      if (currentJti?.jti) await AuthModel.revokeAllUserSessions(id, currentJti.jti);

      await AuditModel.log({ actorId: id, actorEmail: email, action: 'admin.password_change' });
      successResponse(res, { message: 'Password updated successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async mfaSetup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, email } = (req as AuthenticatedRequest).user;
      const secret = speakeasy.generateSecret({ name: `Outpro.India (${email})`, length: 32 });
      await AuthModel.storeMfaSecret(id, secret.base32);
      const qrUrl = await QRCode.toDataURL(secret.otpauth_url!);
      successResponse(res, { qrCode: qrUrl, manualKey: secret.base32 });
    } catch (err) {
      next(err);
    }
  },

  async mfaVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, email } = (req as AuthenticatedRequest).user;
      const { totpCode } = req.body as { totpCode: string };

      const user = await AuthModel.findByEmail(email);
      if (!user?.mfa_secret) {
        return next(AppError.badRequest('MFA setup not initiated. Call /auth/mfa/setup first.'));
      }

      const valid = speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token: totpCode, window: 1 });
      if (!valid) return next(AppError.unauthorized('Invalid TOTP code', 'INVALID_TOTP'));

      await AuthModel.enableMfa(id);
      await AuditModel.log({ actorId: id, actorEmail: email, action: 'admin.mfa_enabled' });
      successResponse(res, { message: 'MFA enabled successfully.' });
    } catch (err) {
      next(err);
    }
  },
};
