// src/controllers/portfolio.controller.ts

import { Request, Response, NextFunction } from 'express';
import { PortfolioModel, AuditModel } from '../models';
import { AppError, successResponse, parsePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types/api.types';
import {
  CreateProjectInput,
  UpdateProjectInput,
  portfolioQuerySchema,
} from '../validators';
import { revalidatePath } from '../services/isr.service';
import { logger } from '../utils/logger';

export const PortfolioController = {
  /**
   * GET /portfolio — public
   * Supports ?category, ?featured, ?published, ?page, ?limit
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedQuery = portfolioQuerySchema.parse(req.query);
      const { page: _page, limit, offset } = parsePagination(parsedQuery);
      const result = await PortfolioModel.findMany({ ...parsedQuery, limit, offset });
      successResponse(res, result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /portfolio/categories — public
   * Returns category name + published project count
   */
  async categories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const counts = await PortfolioModel.getCategoryCounts();
      successResponse(res, counts);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /portfolio/:slug — public
   * Also increments view_count asynchronously (non-blocking)
   */
  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const project = await PortfolioModel.findBySlug(req.params['slug']!);
      if (!project) return next(AppError.notFound('Project not found'));

      // Non-blocking view counter — failure must not affect response
      PortfolioModel.incrementViewCount(project.id).catch((err: unknown) => {
        logger.warn('Failed to increment view count', {
          projectId: project.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      successResponse(res, project);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /portfolio — JWT (editor+)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: userId, email } = (req as AuthenticatedRequest).user;
      const body = req.body as CreateProjectInput;

      const created = await PortfolioModel.create(body);

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'portfolio.create',
        targetTable: 'portfolio_projects',
        targetId: created.id,
        payload: { slug: body.slug, title: body.title },
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
   * PATCH /portfolio/:id — JWT (editor+)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { id: userId, email } = (req as AuthenticatedRequest).user;
      const body = req.body as UpdateProjectInput;

      const existing = await PortfolioModel.findById(id);
      if (!existing) return next(AppError.notFound('Project not found'));

      await PortfolioModel.update(id, body);

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'portfolio.update',
        targetTable: 'portfolio_projects',
        targetId: id,
        payload: {
          before: { title: existing.title, isPublished: existing.isPublished },
          changes: body,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      successResponse(res, await PortfolioModel.findById(id));
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /portfolio/:id — JWT (super_admin only)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { id: userId, email } = (req as AuthenticatedRequest).user;

      const existing = await PortfolioModel.findById(id);
      if (!existing) return next(AppError.notFound('Project not found'));

      await PortfolioModel.delete(id);

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'portfolio.delete',
        targetTable: 'portfolio_projects',
        targetId: id,
        payload: { slug: existing.slug, title: existing.title },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /portfolio/revalidate — Sanity CMS webhook (secret auth)
   * Triggers Next.js ISR revalidation for affected static pages.
   */
  async revalidate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as {
        _type?: string;
        slug?: { current?: string };
      };

      const paths = await revalidatePath(body._type, body.slug?.current);

      logger.info('ISR revalidation completed', {
        contentType: body._type,
        slug: body.slug?.current,
        paths,
      });

      successResponse(res, { revalidated: true, paths });
    } catch (err) {
      next(err);
    }
  },
};
