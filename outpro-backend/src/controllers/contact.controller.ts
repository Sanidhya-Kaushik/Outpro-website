// src/controllers/contact.controller.ts

import { Request, Response, NextFunction } from 'express';
import { LeadModel, AuditModel } from '../models';
import { AppError, successResponse, parsePagination } from '../utils/response';
import { sanitiseObject } from '../utils/sanitise';
import { verifyRecaptcha } from '../utils/recaptcha';
import { AuthenticatedRequest, LeadStatus } from '../types/api.types';
import { ContactFormInput, UpdateLeadInput, leadQuerySchema } from '../validators';
import { logger } from '../utils/logger';
import { EmailService } from '../services/email.service';
import { CrmService } from '../services/crm.service';

export const ContactController = {
  /**
   * POST /contact — public endpoint
   * Validates reCAPTCHA, stores lead, fires CRM + email asynchronously.
   * Always returns 201 regardless of CRM/email delivery status.
   */
  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = sanitiseObject(req.body as ContactFormInput);

      const captchaValid = await verifyRecaptcha(body.recaptchaToken);
      if (!captchaValid) {
        return next(AppError.forbidden('reCAPTCHA verification failed', 'CAPTCHA_FAILED'));
      }

      const lead = await LeadModel.create({
        fullName: body.fullName,
        businessEmail: body.businessEmail,
        companyName: body.companyName,
        phoneNumber: body.phoneNumber,
        serviceInterest: body.serviceInterest,
        budgetRange: body.budgetRange,
        message: body.message,
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? '',
      });

      // Fire-and-forget — don't block 201 on downstream services
      Promise.allSettled([
        CrmService.syncLead(lead.id, body),
        EmailService.notifyNewLead(body),
        EmailService.sendLeadConfirmation(body.businessEmail, body.fullName),
      ]).then(results => {
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            logger.error('Post-submit async task failed', {
              task: ['crm', 'adminEmail', 'confirmEmail'][i],
              leadId: lead.id,
              error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            });
          }
        });
      });

      res.status(201).json({
        success: true,
        data: { message: 'Your message has been received. We will reply within 24 hours.' },
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
   * GET /contact/leads — JWT required (any role)
   */
  async getLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedQuery = leadQuerySchema.parse(req.query);
      const { page, limit, offset } = parsePagination(parsedQuery);
      const result = await LeadModel.findMany({ ...parsedQuery, limit, offset });
      successResponse(res, result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /contact/leads/stats — JWT required (any role)
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = Math.min(
        365,
        Math.max(1, parseInt(String(req.query['period'] ?? '30'), 10)),
      );
      const stats = await LeadModel.getStats(period);
      successResponse(res, {
        period: `${period}d`,
        total: parseInt(stats.total, 10),
        new: parseInt(stats.new_count, 10),
        converted: parseInt(stats.converted, 10),
        conversionRate:
          parseInt(stats.total, 10) > 0
            ? Math.round((parseInt(stats.converted, 10) / parseInt(stats.total, 10)) * 10000) / 100
            : 0,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /contact/leads/:id — JWT required (any role)
   * Auto-marks 'new' leads as 'read' on first open.
   */
  async getLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lead = await LeadModel.findById(req.params['id']!);
      if (!lead) return next(AppError.notFound('Lead not found'));

      if (lead.status === 'new') {
        await LeadModel.update(lead.id, { status: 'read' });
        lead.status = 'read' as LeadStatus;
      }

      successResponse(res, lead);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /contact/leads/:id — JWT required (editor+)
   */
  async updateLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { id: userId, email } = (req as AuthenticatedRequest).user;
      const body = req.body as UpdateLeadInput;

      const existing = await LeadModel.findById(id);
      if (!existing) return next(AppError.notFound('Lead not found'));

      await LeadModel.update(id, { status: body.status });

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'lead.status.update',
        targetTable: 'contact_leads',
        targetId: id,
        payload: { before: { status: existing.status }, after: { status: body.status } },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const updated = await LeadModel.findById(id);
      successResponse(res, updated);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /contact/leads/:id — JWT required (super_admin only)
   */
  async deleteLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { id: userId, email } = (req as AuthenticatedRequest).user;

      const existing = await LeadModel.findById(id);
      if (!existing) return next(AppError.notFound('Lead not found'));

      await LeadModel.delete(id);

      await AuditModel.log({
        actorId: userId,
        actorEmail: email,
        action: 'lead.delete',
        targetTable: 'contact_leads',
        targetId: id,
        payload: { deletedEmail: existing.businessEmail },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
