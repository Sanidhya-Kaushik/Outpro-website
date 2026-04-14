// src/services/email.service.ts
// Resend transactional email adapter

import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const resend = new Resend(env.RESEND_API_KEY);

export interface LeadNotificationData {
  fullName: string;
  businessEmail: string;
  companyName?: string;
  phoneNumber?: string;
  serviceInterest?: string;
  budgetRange?: string;
  message: string;
}

export const EmailService = {
  async notifyNewLead(lead: LeadNotificationData): Promise<void> {
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: env.EMAIL_ADMIN_NOTIFY,
        subject: `New lead: ${lead.fullName} — ${lead.serviceInterest ?? 'General enquiry'}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#0F4C81;">New Contact Form Submission</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px;font-weight:bold;width:140px;">Name</td><td style="padding:8px;">${lead.fullName}</td></tr>
              <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;"><a href="mailto:${lead.businessEmail}">${lead.businessEmail}</a></td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Company</td><td style="padding:8px;">${lead.companyName ?? '—'}</td></tr>
              <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;">Phone</td><td style="padding:8px;">${lead.phoneNumber ?? '—'}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Service</td><td style="padding:8px;">${lead.serviceInterest ?? '—'}</td></tr>
              <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;">Budget</td><td style="padding:8px;">${lead.budgetRange ?? '—'}</td></tr>
            </table>
            <h3 style="color:#0F4C81;">Message</h3>
            <p style="background:#f5f5f5;padding:16px;border-radius:4px;">${lead.message}</p>
            <a href="https://outpro.india/admin/leads" style="display:inline-block;background:#0F4C81;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;margin-top:16px;">
              View in Admin Dashboard →
            </a>
            <p style="color:#999;font-size:12px;margin-top:24px;">Outpro.India · New Delhi, India</p>
          </div>
        `,
      });
      logger.info('Admin lead notification sent', { email: lead.businessEmail });
    } catch (err) {
      logger.error('Failed to send admin lead notification', { error: err });
      throw err;
    }
  },

  async sendLeadConfirmation(toEmail: string, name: string): Promise<void> {
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: toEmail,
        subject: "We've received your message — Outpro.India",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#0F4C81;">Hi ${name},</h2>
            <p>Thank you for reaching out to Outpro.India. We've received your message and one of our team members will reply to you within <strong>24 hours</strong> on business days.</p>
            <p>If your request is urgent, please call us directly:</p>
            <p style="font-size:18px;font-weight:bold;color:#0F4C81;">+91 98765 43210</p>
            <p style="margin-top:32px;">Warm regards,<br/><strong>The Outpro.India Team</strong></p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
            <p style="color:#999;font-size:12px;">Outpro.India · New Delhi, India · hello@outpro.india</p>
          </div>
        `,
      });
      logger.info('Lead confirmation sent', { email: toEmail });
    } catch (err) {
      logger.error('Failed to send lead confirmation email', { email: toEmail, error: err });
      throw err;
    }
  },

  async sendAdminInvitation(toEmail: string, fullName: string): Promise<void> {
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: toEmail,
        subject: 'You have been added to Outpro.India Admin',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#0F4C81;">Welcome, ${fullName}!</h2>
            <p>You have been granted access to the Outpro.India admin dashboard.</p>
            <a href="https://outpro.india/login" style="display:inline-block;background:#0F4C81;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">
              Log In to Dashboard →
            </a>
            <p style="margin-top:24px;color:#555;">
              <strong>Important:</strong> Please change your temporary password on first login and enable 
              multi-factor authentication (MFA) via Settings → Security.
            </p>
            <p style="color:#999;font-size:12px;margin-top:32px;">Outpro.India · New Delhi, India</p>
          </div>
        `,
      });
    } catch (err) {
      logger.warn('Failed to send admin invitation email', { email: toEmail, error: err });
      // Non-fatal — user can still log in
    }
  },

  async sendPasswordResetNotification(toEmail: string, fullName: string): Promise<void> {
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: toEmail,
        subject: 'Your Outpro.India password was changed',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#0F4C81;">Password Changed</h2>
            <p>Hi ${fullName}, your Outpro.India admin password was just changed.</p>
            <p>If you did not make this change, contact your super admin immediately.</p>
            <p style="color:#999;font-size:12px;margin-top:32px;">Outpro.India · New Delhi, India</p>
          </div>
        `,
      });
    } catch (err) {
      logger.warn('Failed to send password change notification', { email: toEmail, error: err });
    }
  },
};
