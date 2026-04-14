// src/services/crm.service.ts
// CRM integration — HubSpot primary, Zoho fallback, exponential-backoff retry

import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// ── Retry utility ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRetryable =
        err instanceof AxiosError &&
        (err.response?.status === 429 || (err.response?.status ?? 0) >= 500);

      if (!isRetryable || attempt === maxAttempts) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(`CRM request attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: err instanceof Error ? err.message : String(err),
      });
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ── HubSpot adapter ───────────────────────────────────────────────────────────

export interface LeadCrmData {
  fullName: string;
  businessEmail: string;
  companyName?: string;
  phoneNumber?: string;
  serviceInterest?: string;
  budgetRange?: string;
  message: string;
}

export const CrmService = {
  async syncLead(leadId: string, data: LeadCrmData): Promise<string | null> {
    if (!env.HUBSPOT_API_KEY) {
      logger.debug('CRM sync skipped — HUBSPOT_API_KEY not configured');
      return null;
    }

    const nameParts = data.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
      const response = await withRetry(() =>
        axios.post<{ id: string }>(
          'https://api.hubapi.com/crm/v3/objects/contacts',
          {
            properties: {
              firstname: firstName,
              lastname: lastName,
              email: data.businessEmail,
              phone: data.phoneNumber ?? '',
              company: data.companyName ?? '',
              hs_lead_status: 'NEW',
              message: data.message,
              // Custom HubSpot property — create in portal if needed
              service_interest: data.serviceInterest ?? '',
              budget_range: data.budgetRange ?? '',
            },
          },
          {
            headers: {
              Authorization: `Bearer ${env.HUBSPOT_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 10_000,
          },
        ),
      );

      const hubspotId = response.data.id;
      logger.info('Lead synced to HubSpot', { leadId, hubspotId });
      return hubspotId;
    } catch (err) {
      // 409 = contact already exists — find and return existing ID
      if (err instanceof AxiosError && err.response?.status === 409) {
        try {
          const existing = await axios.post<{ total: number; results: Array<{ id: string }> }>(
            'https://api.hubapi.com/crm/v3/objects/contacts/search',
            { filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: data.businessEmail }] }] },
            { headers: { Authorization: `Bearer ${env.HUBSPOT_API_KEY}` }, timeout: 5000 },
          );
          if (existing.data.results.length > 0) {
            const existingId = existing.data.results[0].id;
            logger.info('Lead already exists in HubSpot', { leadId, hubspotId: existingId });
            return existingId;
          }
        } catch {
          // Search failed — fall through to error log
        }
      }

      logger.error('CRM sync failed after retries', {
        leadId,
        error: err instanceof Error ? err.message : String(err),
        status: err instanceof AxiosError ? err.response?.status : undefined,
      });
      throw err;
    }
  },

  async updateLeadStatus(crmId: string, status: 'NEW' | 'IN_PROGRESS' | 'OPEN_DEAL' | 'CONNECTED'): Promise<void> {
    if (!env.HUBSPOT_API_KEY || !crmId) return;

    try {
      await withRetry(() =>
        axios.patch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${crmId}`,
          { properties: { hs_lead_status: status } },
          { headers: { Authorization: `Bearer ${env.HUBSPOT_API_KEY}` }, timeout: 5000 },
        ),
      );
      logger.info('CRM lead status updated', { crmId, status });
    } catch (err) {
      logger.error('Failed to update CRM lead status', { crmId, status, error: err });
      // Non-fatal — local DB is source of truth
    }
  },
};
