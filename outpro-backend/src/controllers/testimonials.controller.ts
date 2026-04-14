// src/controllers/testimonials.controller.ts

import { Request, Response, NextFunction } from 'express';
import { TestimonialModel, AuditModel } from '../models';
import { withTransaction } from '../config/database';
import { AppError, successResponse, parsePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types/api.types';
import {
  CreateTestimonialInput,
  UpdateTestimonialInput,
  ReorderTestimonialsInput,
  testimonialQuerySchema,
} from '../validators';

export const TestimonialController = {
  /**
   * GET /testimonials — public
   * Supports ?featured, ?minRating, ?videoOnly, ?sortBy, ?page, ?limit
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedQuery = testimonialQuerySchema.parse(req.query);
      const { limit, offset } = parsePagination(parsedQuery);
      const result = await TestimonialModel.findMany({ ...parsedQuery, limit, offset });
      successResponse(res, result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /testimonials/stats — JWT required (any role)
   */
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await TestimonialModel.getStats();
      successResponse(res, stats);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /testimonials/:id — public
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = await TestimonialModel.findById(req.params['id']!);
      if (!t) return next(AppError.notFound('Testimonial not found'));
      successResponse(res, t);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /testimonials — JWT (editor+)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: userId, email } = (req as AuthenticatedRequest).user;
      const body = req.body as CreateTestimonialInput;

      const created = await TestimonialModel.create(body);

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'testimonial.create',
        targetTable: 'testimonials',
        targetId: created.id,
        payload: { authorName: body.authorName, starRating: body.starRating },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        data: created,
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
   * PATCH /testimonials/:id — JWT (editor+)
   * Partial update — only provided fields are validated and updated.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { id: userId, email } = (req as AuthenticatedRequest).user;
      const body = req.body as UpdateTestimonialInput;

      const existing = await TestimonialModel.findById(id);
      if (!existing) return next(AppError.notFound('Testimonial not found'));

      await TestimonialModel.update(id, body);

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'testimonial.update',
        targetTable: 'testimonials',
        targetId: id,
        payload: {
          before: { starRating: existing.starRating, isFeatured: existing.isFeatured },
          changes: body,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      successResponse(res, await TestimonialModel.findById(id));
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /testimonials/:id — JWT (super_admin only)
   * Does NOT auto-delete the associated avatar media asset.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { id: userId, email } = (req as AuthenticatedRequest).user;

      const existing = await TestimonialModel.findById(id);
      if (!existing) return next(AppError.notFound('Testimonial not found'));

      await TestimonialModel.delete(id);

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'testimonial.delete',
        targetTable: 'testimonials',
        targetId: id,
        payload: { authorName: existing.authorName },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /testimonials/reorder — JWT (editor+)
   * Updates displayOrder for multiple testimonials in a single DB transaction.
   * All succeed or all roll back.
   */
  async reorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: userId, email } = (req as AuthenticatedRequest).user;
      const { order } = req.body as ReorderTestimonialsInput;

      await withTransaction(async client => {
        await TestimonialModel.reorder(order, client);
      });

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'testimonial.reorder',
        payload: { itemCount: order.length },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      successResponse(res, {
        reordered: order.length,
        message: `Display order updated for ${order.length} testimonials.`,
      });
    } catch (err) {
      next(err);
    }
  },
};
