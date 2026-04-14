// src/controllers/admin.controller.ts

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { AdminUserModel, MediaModel, DashboardModel, AuditModel } from '../models';
import { AuthModel } from '../models';
import { AppError, successResponse, parsePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types/api.types';
import { redactIp } from '../utils/sanitise';
import { env } from '../config/env';
import { StorageService } from '../services/storage.service';
import { EmailService } from '../services/email.service';
import {
  CreateAdminUserInput,
  UpdateAdminUserInput,
  auditLogQuerySchema,
  mediaQuerySchema,
  dashboardQuerySchema,
} from '../validators';
import { logger } from '../utils/logger';

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const AdminController = {
  /**
   * GET /admin/dashboard?period=7d|30d|90d — JWT (any role)
   */
  async dashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { period } = dashboardQuerySchema.parse(req.query);
      const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      const kpis = await DashboardModel.getKpis(days);
      successResponse(res, kpis);
    } catch (err) {
      next(err);
    }
  },

  // ── Admin users ─────────────────────────────────────────────────────────────

  /**
   * GET /admin/users — JWT (super_admin only)
   * Password hash is never included in the response.
   */
  async listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await AdminUserModel.findAll();
      successResponse(res, users);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /admin/users — JWT (super_admin only)
   * Hashes password with bcrypt(12), sends invitation email, writes audit entry.
   */
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: actorId, email: actorEmail } = (req as AuthenticatedRequest).user;
      const body = req.body as CreateAdminUserInput;

      // Unique email check
      if (await AdminUserModel.findByEmail(body.email)) {
        return next(AppError.conflict('An admin account with this email already exists'));
      }

      const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_ROUNDS);
      const created = await AdminUserModel.create({
        email: body.email,
        passwordHash,
        fullName: body.fullName,
        role: body.role,
      });

      await Promise.allSettled([
        AuditModel.log({
          actorId,
          actorEmail,
          action: 'admin_user.create',
          targetTable: 'admin_users',
          targetId: created.id,
          payload: { email: body.email, role: body.role },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }),
        EmailService.sendAdminInvitation(body.email, body.fullName ?? 'Admin'),
      ]);

      const newUser = await AdminUserModel.findById(created.id);

      res.status(201).json({
        success: true,
        data: newUser,
        meta: {
          requestId: res.locals['requestId'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /admin/users/:id — JWT (super_admin only)
   * Cannot demote/deactivate the last super_admin.
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { id: actorId, email: actorEmail } = (req as AuthenticatedRequest).user;
      const body = req.body as UpdateAdminUserInput;

      const target = await AdminUserModel.findById(id);
      if (!target) return next(AppError.notFound('Admin user not found'));

      // Guard: cannot demote or deactivate the last super_admin
      const isDemoting = body.role && body.role !== 'super_admin' && target.role === 'super_admin';
      const isDeactivating = body.isActive === false && target.role === 'super_admin';

      if (isDemoting || isDeactivating) {
        const superCount = await AdminUserModel.countSuperAdmins();
        if (superCount <= 1) {
          return next(
            new AppError(
              'Cannot demote or deactivate the last active super_admin.',
              400,
              'LAST_SUPER_ADMIN',
              [{ field: 'role', issue: 'At least one active super_admin must remain.' }],
            ),
          );
        }
      }

      await AdminUserModel.update(id, {
        role: body.role,
        isActive: body.isActive,
        fullName: body.fullName,
      });

      await AuditModel.log({
        actorId,
        actorEmail,
        action: 'admin_user.update',
        targetTable: 'admin_users',
        targetId: id,
        payload: {
          before: { role: target.role, isActive: target.isActive },
          changes: body,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      successResponse(res, await AdminUserModel.findById(id));
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /admin/users/:id — JWT (super_admin only)
   * Cannot delete own account or the last super_admin.
   * Revokes all sessions before deletion.
   */
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { id: actorId, email: actorEmail } = (req as AuthenticatedRequest).user;

      // Cannot self-delete
      if (id === actorId) {
        return next(
          new AppError('Cannot delete your own account.', 400, 'SELF_DELETE', [
            { field: 'id', issue: 'Self-deletion is not permitted.' },
          ]),
        );
      }

      const target = await AdminUserModel.findById(id);
      if (!target) return next(AppError.notFound('Admin user not found'));

      // Guard: last super_admin protection
      if (target.role === 'super_admin') {
        const superCount = await AdminUserModel.countSuperAdmins();
        if (superCount <= 1) {
          return next(
            new AppError(
              'Cannot delete the last active super_admin.',
              400,
              'LAST_SUPER_ADMIN',
            ),
          );
        }
      }

      // Revoke all active sessions first
      await AuthModel.revokeAllUserSessions(id);
      await AdminUserModel.delete(id);

      await AuditModel.log({
        actorId,
        actorEmail,
        action: 'admin_user.delete',
        targetTable: 'admin_users',
        targetId: id,
        payload: { deletedEmail: target.email, deletedRole: target.role },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // ── Audit log ───────────────────────────────────────────────────────────────

  /**
   * GET /admin/audit-log — JWT (any role)
   * IP addresses are redacted for non-super_admin viewers.
   */
  async auditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role } = (req as AuthenticatedRequest).user;
      const parsedQuery = auditLogQuerySchema.parse(req.query);
      const { limit, offset } = parsePagination(parsedQuery, 100);

      const result = await AuditModel.findMany({ ...parsedQuery, limit, offset });

      // Redact IP for non-super_admin roles
      if (role !== 'super_admin') {
        result.items = result.items.map(entry => ({
          ...entry,
          ipAddress: redactIp(entry.ipAddress),
        }));
      }

      successResponse(res, result);
    } catch (err) {
      next(err);
    }
  },

  // ── Media ───────────────────────────────────────────────────────────────────

  /**
   * POST /admin/media — JWT (editor+)
   * Accepts multipart/form-data. Validates MIME by magic bytes.
   * Uploads to private Supabase bucket, triggers async ClamAV scan stub.
   */
  async uploadMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: userId, email } = (req as AuthenticatedRequest).user;
      const file = req.file;

      if (!file) {
        return next(AppError.badRequest('No file was provided in the request.'));
      }

      // Upload buffer to Supabase private bucket
      const storagePath = await StorageService.uploadToPrivate(
        file.buffer,
        file.originalname,
        file.mimetype,
      );

      const asset = await MediaModel.create({
        filename: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        storagePath,
        uploadedById: userId,
      });

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'media.upload',
        targetTable: 'media_assets',
        targetId: asset.id,
        payload: {
          filename: file.originalname,
          mimeType: file.mimetype,
          bytes: file.size,
          storagePath,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // TODO: Trigger async ClamAV Lambda scan here.
      // On clean result → StorageService.promoteToPublic() + MediaModel.updateScanResult()
      logger.info('Media uploaded, pending virus scan', { assetId: asset.id, storagePath });

      res.status(201).json({
        success: true,
        data: asset,
        meta: {
          requestId: res.locals['requestId'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /admin/media — JWT (any role)
   * Supports ?scanStatus, ?mimeType, ?uploadedById, ?page, ?limit
   */
  async listMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedQuery = mediaQuerySchema.parse(req.query);
      const { limit, offset } = parsePagination(parsedQuery, 50);
      const result = await MediaModel.findMany({ ...parsedQuery, limit, offset });
      successResponse(res, result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /admin/media/:id — JWT (super_admin only)
   * Checks FK references before deletion to prevent dangling references.
   * Deletes from Supabase Storage then removes the DB record.
   */
  async deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { id: userId, email } = (req as AuthenticatedRequest).user;

      const asset = await MediaModel.findById(id);
      if (!asset) return next(AppError.notFound('Media asset not found'));

      // FK reference check — reject if used by portfolio or testimonials
      if (await MediaModel.isReferencedElsewhere(id)) {
        return next(
          AppError.conflict(
            'This asset is referenced by existing portfolio or testimonial records. ' +
              'Remove those references before deleting the asset.',
          ),
        );
      }

      // Delete from Supabase Storage (best-effort — non-fatal if already gone)
      await StorageService.delete(asset.storagePath);

      await MediaModel.delete(id);

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'media.delete',
        targetTable: 'media_assets',
        targetId: id,
        payload: { filename: asset.filename, mimeType: asset.mimeType },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
