// src/__tests__/models.test.ts
// Unit tests for all data-access model functions
// Mocks pg query() — tests SQL shape, parameter order, and row mapping

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('../config/env', () => ({
  env: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    LOG_DIR: '/tmp',
  },
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockQuery = vi.fn();
const mockWithTransaction = vi.fn();

vi.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (...args: unknown[]) => mockWithTransaction(...args),
}));

import {
  LeadModel,
  PortfolioModel,
  TestimonialModel,
  AdminUserModel,
  AuditModel,
  MediaModel,
  DashboardModel,
} from '../models';

// ── Helpers ───────────────────────────────────────────────────────────────────

const id = uuidv4();
const now = new Date().toISOString();

function pgResult<T>(rows: T[], rowCount = rows.length) {
  return { rows, rowCount, command: 'SELECT', oid: 0, fields: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// LeadModel
// ═══════════════════════════════════════════════════════════════════════════════

describe('LeadModel', () => {
  describe('create', () => {
    it('inserts a lead and returns id', async () => {
      mockQuery.mockResolvedValue(pgResult([{ id }]));

      const result = await LeadModel.create({
        fullName: 'Neha Kapoor',
        businessEmail: 'neha@techstart.in',
        message: 'We need a website.',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(result).toEqual({ id });
      expect(mockQuery).toHaveBeenCalledOnce();

      const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO contact_leads');
      expect(sql).toContain('RETURNING id');
      expect(values).toContain('Neha Kapoor');
      expect(values).toContain('neha@techstart.in');
    });

    it('passes null for optional fields when not provided', async () => {
      mockQuery.mockResolvedValue(pgResult([{ id }]));

      await LeadModel.create({
        fullName: 'Test User',
        businessEmail: 'test@test.com',
        message: 'Hello world',
        ipAddress: '1.1.1.1',
        userAgent: '',
      });

      const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      // companyName, phoneNumber, serviceInterest, budgetRange should all be null
      expect(values).toContain(null);
    });
  });

  describe('findById', () => {
    it('returns null when lead not found', async () => {
      mockQuery.mockResolvedValue(pgResult([]));
      const result = await LeadModel.findById('nonexistent-id');
      expect(result).toBeNull();
    });

    it('returns the lead row when found', async () => {
      const row = {
        id,
        created_at: now,
        full_name: 'Neha Kapoor',
        business_email: 'neha@test.in',
        company_name: null,
        phone_number: null,
        service_interest: 'SEO',
        budget_range: null,
        message: 'Test message',
        status: 'new',
        crm_sync_id: null,
        crm_synced_at: null,
        ip_address: '1.1.1.1',
      };
      mockQuery.mockResolvedValue(pgResult([row]));

      const result = await LeadModel.findById(id);

      // Verify snake_case → camelCase mapping
      expect(result).not.toBeNull();
      expect(result!.id).toBe(id);
      expect(result!.fullName).toBe('Neha Kapoor');
      expect(result!.businessEmail).toBe('neha@test.in');
      expect(result!.serviceInterest).toBe('SEO');
      expect(result!.status).toBe('new');
      expect(result!.createdAt).toBe(now);
    });
  });

  describe('update', () => {
    it('updates status field correctly', async () => {
      mockQuery.mockResolvedValue(pgResult([{ id }]));

      await LeadModel.update(id, { status: 'replied' });

      const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('UPDATE contact_leads');
      expect(sql).toContain('status =');
      expect(values).toContain('replied');
      expect(values).toContain(id);
    });

    it('builds dynamic SET clause with only provided fields', async () => {
      mockQuery.mockResolvedValue(pgResult([{ id }]));

      await LeadModel.update(id, { status: 'converted', crmSyncId: 'crm-123' });

      const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('status =');
      expect(sql).toContain('crm_sync_id =');
      expect(values).toContain('converted');
      expect(values).toContain('crm-123');
    });
  });

  describe('delete', () => {
    it('sends DELETE query with correct id', async () => {
      mockQuery.mockResolvedValue(pgResult([], 1));

      await LeadModel.delete(id);

      const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('DELETE FROM contact_leads');
      expect(values).toContain(id);
    });
  });

  describe('getStats', () => {
    it('queries with correct interval and returns parsed stats', async () => {
      mockQuery.mockResolvedValue(
        pgResult([{ total: '84', new_count: '12', converted: '15' }]),
      );

      const result = await LeadModel.getStats(30);

      const [sql] = mockQuery.mock.calls[0] as [string];
      expect(sql).toContain('30 days');
      expect(result.total).toBe('84');
      expect(result.new_count).toBe('12');
    });
  });

  describe('findMany', () => {
    it('returns paginated data with total count', async () => {
      mockQuery
        .mockResolvedValueOnce(pgResult([{ count: '5' }]))
        .mockResolvedValueOnce(pgResult([]));

      const result = await LeadModel.findMany({
        limit: 20,
        offset: 0,
        sortBy: 'createdAt',
        sortDir: 'desc',
      });

      expect(result.pagination.total).toBe(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.items).toEqual([]);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('applies status filter in WHERE clause', async () => {
      mockQuery
        .mockResolvedValueOnce(pgResult([{ count: '2' }]))
        .mockResolvedValueOnce(pgResult([]));

      await LeadModel.findMany({
        status: 'new',
        limit: 20,
        offset: 0,
        sortBy: 'createdAt',
        sortDir: 'desc',
      });

      const [countSql, countValues] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(countSql).toContain('WHERE');
      expect(countValues).toContain('new');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PortfolioModel
// ═══════════════════════════════════════════════════════════════════════════════

describe('PortfolioModel', () => {
  describe('create', () => {
    it('inserts and returns id and slug', async () => {
      mockQuery.mockResolvedValue(pgResult([{ id, slug: 'test-project' }]));

      const result = await PortfolioModel.create({
        slug: 'test-project',
        title: 'Test Project',
        clientName: 'ACME Ltd',
        category: 'Web Development',
        isFeatured: false,
        isPublished: false,
        displayOrder: 0,
        tags: [],
      });

      expect(result).toEqual({ id, slug: 'test-project' });
      const [sql] = mockQuery.mock.calls[0] as [string];
      expect(sql).toContain('INSERT INTO portfolio_projects');
      expect(sql).toContain('RETURNING id, slug');
    });
  });

  describe('findBySlug', () => {
    it('returns null for unknown slug', async () => {
      mockQuery.mockResolvedValue(pgResult([]));
      const result = await PortfolioModel.findBySlug('no-such-slug');
      expect(result).toBeNull();
    });

    it('maps row to camelCase domain object', async () => {
      const row = {
        id,
        slug: 'brand-rebrand',
        title: 'BrandHouse Rebrand',
        client_name: 'BrandHouse Ltd',
        category: 'Branding',
        description: 'A full rebrand.',
        cover_image_id: null,
        is_featured: true,
        is_published: true,
        view_count: 42,
        project_url: 'https://brandhouse.co.in',
        completed_at: null,
        display_order: 1,
        created_at: now,
        updated_at: now,
      };
      mockQuery.mockResolvedValue(pgResult([row]));

      const result = await PortfolioModel.findBySlug('brand-rebrand');

      expect(result).not.toBeNull();
      expect(result!.slug).toBe('brand-rebrand');
      expect(result!.clientName).toBe('BrandHouse Ltd');
      expect(result!.isFeatured).toBe(true);
      expect(result!.viewCount).toBe(42);
    });
  });

  describe('incrementViewCount', () => {
    it('sends atomic UPDATE for view_count', async () => {
      mockQuery.mockResolvedValue(pgResult([], 1));

      await PortfolioModel.incrementViewCount(id);

      const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('view_count = view_count + 1');
      expect(values).toContain(id);
    });
  });

  describe('getCategoryCounts', () => {
    it('returns parsed array of category + count', async () => {
      mockQuery.mockResolvedValue(
        pgResult([
          { category: 'Branding', count: '5' },
          { category: 'Web Development', count: '8' },
        ]),
      );

      const result = await PortfolioModel.getCategoryCounts();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ category: 'Branding', count: 5 });
      expect(result[1]).toEqual({ category: 'Web Development', count: 8 });
      // count must be an integer, not a string
      expect(typeof result[0].count).toBe('number');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TestimonialModel
// ═══════════════════════════════════════════════════════════════════════════════

describe('TestimonialModel', () => {
  describe('create', () => {
    it('inserts testimonial with all required fields', async () => {
      mockQuery.mockResolvedValue(pgResult([{ id }]));

      await TestimonialModel.create({
        quote: 'Outstanding work across the board.',
        authorName: 'Neha Kapoor',
        starRating: 5,
        isVideoTestimonial: false,
        isFeatured: false,
        displayOrder: 0,
      });

      const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO testimonials');
      expect(values).toContain('Outstanding work across the board.');
      expect(values).toContain('Neha Kapoor');
      expect(values).toContain(5);
    });
  });

  describe('getStats', () => {
    it('returns typed statistics with byRating breakdown', async () => {
      mockQuery.mockResolvedValue(
        pgResult([
          {
            total: '18',
            avg_rating: '4.8',
            featured_count: '6',
            video_count: '4',
            by_5: '14',
            by_4: '3',
            by_3: '1',
            by_2: '0',
            by_1: '0',
          },
        ]),
      );

      const result = await TestimonialModel.getStats();

      expect(result.total).toBe(18);
      expect(result.avgRating).toBe(4.8);
      expect(result.featuredCount).toBe(6);
      expect(result.videoCount).toBe(4);
      expect(result.byRating[5]).toBe(14);
      expect(result.byRating[1]).toBe(0);
      // All values must be numbers
      expect(typeof result.total).toBe('number');
      expect(typeof result.avgRating).toBe('number');
    });
  });

  describe('reorder', () => {
    it('issues one UPDATE per item in the order array', async () => {
      mockQuery.mockResolvedValue(pgResult([], 1));

      const order = [
        { id: uuidv4(), displayOrder: 1 },
        { id: uuidv4(), displayOrder: 2 },
        { id: uuidv4(), displayOrder: 3 },
      ];

      await TestimonialModel.reorder(order);

      expect(mockQuery).toHaveBeenCalledTimes(3);
      mockQuery.mock.calls.forEach(([sql], i) => {
        expect(sql).toContain('UPDATE testimonials');
        expect(sql).toContain('display_order =');
      });
    });

    it('uses client.query when a PoolClient is provided', async () => {
      const clientQuery = vi.fn().mockResolvedValue(pgResult([], 1));
      const fakeClient = { query: clientQuery };

      const order = [{ id: uuidv4(), displayOrder: 1 }];
      await TestimonialModel.reorder(order, fakeClient as never);

      // Should use the client, NOT the global query
      expect(clientQuery).toHaveBeenCalledOnce();
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AdminUserModel
// ═══════════════════════════════════════════════════════════════════════════════

describe('AdminUserModel', () => {
  describe('create', () => {
    it('inserts admin user and returns id', async () => {
      mockQuery.mockResolvedValue(pgResult([{ id }]));

      const result = await AdminUserModel.create({
        email: 'priya@outpro.india',
        passwordHash: '$2b$12$hashedpassword',
        fullName: 'Priya Singh',
        role: 'editor',
      });

      expect(result).toEqual({ id });
      const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO admin_users');
      // Password hash must appear in values — never in SQL string
      expect(sql).not.toContain('$2b$12$hashedpassword');
      expect(values).toContain('$2b$12$hashedpassword');
      expect(values).toContain('priya@outpro.india');
    });
  });

  describe('countSuperAdmins', () => {
    it('returns parsed integer count', async () => {
      mockQuery.mockResolvedValue(pgResult([{ count: '3' }]));

      const count = await AdminUserModel.countSuperAdmins();

      expect(count).toBe(3);
      expect(typeof count).toBe('number');
    });

    it('returns 0 when no super_admins exist', async () => {
      mockQuery.mockResolvedValue(pgResult([{ count: '0' }]));
      const count = await AdminUserModel.countSuperAdmins();
      expect(count).toBe(0);
    });
  });

  describe('findAll', () => {
    it('maps all rows to camelCase AdminUser objects', async () => {
      const rows = [
        {
          id,
          email: 'arjun@outpro.india',
          full_name: 'Arjun Mehta',
          role: 'super_admin',
          mfa_enabled: true,
          is_active: true,
          last_login_at: now,
          created_at: now,
        },
      ];
      mockQuery.mockResolvedValue(pgResult(rows));

      const result = await AdminUserModel.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('arjun@outpro.india');
      expect(result[0].fullName).toBe('Arjun Mehta');
      expect(result[0].role).toBe('super_admin');
      expect(result[0].mfaEnabled).toBe(true);
      // password_hash must never appear
      expect('passwordHash' in result[0]).toBe(false);
      expect('password_hash' in result[0]).toBe(false);
    });
  });

  describe('update', () => {
    it('builds SET clause from only provided fields', async () => {
      mockQuery.mockResolvedValue(pgResult([], 1));

      await AdminUserModel.update(id, { role: 'viewer' });

      const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('role =');
      expect(sql).not.toContain('is_active =');
      expect(values).toContain('viewer');
      expect(values).toContain(id);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AuditModel
// ═══════════════════════════════════════════════════════════════════════════════

describe('AuditModel', () => {
  describe('log', () => {
    it('inserts audit entry with all provided fields', async () => {
      mockQuery.mockResolvedValue(pgResult([], 1));

      await AuditModel.log({
        actorId: id,
        actorEmail: 'arjun@outpro.india',
        action: 'lead.status.update',
        targetTable: 'contact_leads',
        targetId: uuidv4(),
        payload: { before: { status: 'new' }, after: { status: 'replied' } },
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO audit_log');
      expect(values).toContain('lead.status.update');
      expect(values).toContain('arjun@outpro.india');
      // payload serialised to JSON string
      const payloadArg = values.find(v => typeof v === 'string' && v.includes('before'));
      expect(payloadArg).toBeDefined();
    });

    it('passes null for optional fields not provided', async () => {
      mockQuery.mockResolvedValue(pgResult([], 1));

      await AuditModel.log({
        actorId: id,
        actorEmail: 'arjun@outpro.india',
        action: 'admin.login',
      });

      const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      // targetTable, targetId, payload, ipAddress, userAgent should all be null
      const nullCount = values.filter(v => v === null).length;
      expect(nullCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('findMany', () => {
    it('returns paginated audit log entries', async () => {
      mockQuery
        .mockResolvedValueOnce(pgResult([{ count: '100' }]))
        .mockResolvedValueOnce(
          pgResult([
            {
              id,
              actor_id: id,
              actor_email: 'arjun@outpro.india',
              action: 'lead.delete',
              target_table: 'contact_leads',
              target_id: uuidv4(),
              payload: null,
              ip_address: '1.2.3.4',
              user_agent: 'Mozilla/5.0',
              created_at: now,
            },
          ]),
        );

      const result = await AuditModel.findMany({ limit: 50, offset: 0 });

      expect(result.pagination.total).toBe(100);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].action).toBe('lead.delete');
      expect(result.items[0].actorEmail).toBe('arjun@outpro.india');
    });

    it('applies actorId filter in WHERE clause', async () => {
      mockQuery
        .mockResolvedValueOnce(pgResult([{ count: '5' }]))
        .mockResolvedValueOnce(pgResult([]));

      await AuditModel.findMany({ actorId: id, limit: 50, offset: 0 });

      const [countSql, countValues] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(countSql).toContain('actor_id =');
      expect(countValues).toContain(id);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MediaModel
// ═══════════════════════════════════════════════════════════════════════════════

describe('MediaModel', () => {
  describe('create', () => {
    it('inserts with pending scan_status and returns id', async () => {
      mockQuery.mockResolvedValue(pgResult([{ id }]));

      const result = await MediaModel.create({
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 204800,
        storagePath: 'images/2026-04-13/photo.jpg',
        uploadedById: uuidv4(),
      });

      expect(result).toEqual({ id });
      const [sql] = mockQuery.mock.calls[0] as [string];
      expect(sql).toContain("'pending'");
    });
  });

  describe('isReferencedElsewhere', () => {
    it('returns true if referenced by testimonials', async () => {
      mockQuery
        .mockResolvedValueOnce(pgResult([{ '?column?': 1 }], 1)) // testimonials hit
        .mockResolvedValueOnce(pgResult([], 0));

      const result = await MediaModel.isReferencedElsewhere(id);
      expect(result).toBe(true);
    });

    it('returns true if referenced by portfolio', async () => {
      mockQuery
        .mockResolvedValueOnce(pgResult([], 0))
        .mockResolvedValueOnce(pgResult([{ '?column?': 1 }], 1)); // portfolio hit

      const result = await MediaModel.isReferencedElsewhere(id);
      expect(result).toBe(true);
    });

    it('returns false when not referenced anywhere', async () => {
      mockQuery
        .mockResolvedValueOnce(pgResult([], 0))
        .mockResolvedValueOnce(pgResult([], 0));

      const result = await MediaModel.isReferencedElsewhere(id);
      expect(result).toBe(false);
    });
  });

  describe('updateScanResult', () => {
    it('updates scan_status and public_url', async () => {
      mockQuery.mockResolvedValue(pgResult([], 1));

      await MediaModel.updateScanResult(id, 'clean', 'https://cdn.supabase.co/photo.jpg');

      const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('scan_status =');
      expect(sql).toContain('public_url =');
      expect(values).toContain('clean');
      expect(values).toContain('https://cdn.supabase.co/photo.jpg');
      expect(values).toContain(id);
    });

    it('sets public_url to null for infected files', async () => {
      mockQuery.mockResolvedValue(pgResult([], 1));

      await MediaModel.updateScanResult(id, 'infected', null);

      const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(values).toContain('infected');
      expect(values).toContain(null);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DashboardModel
// ═══════════════════════════════════════════════════════════════════════════════

describe('DashboardModel', () => {
  describe('getKpis', () => {
    it('returns fully typed dashboard KPI object', async () => {
      // Six parallel queries run via Promise.all
      mockQuery
        .mockResolvedValueOnce(pgResult([{ total: '84', new_count: '12', converted: '15' }]))
        .mockResolvedValueOnce(pgResult([{ total: '18', avg_rating: '4.8', pending: '2' }]))
        .mockResolvedValueOnce(pgResult([{ total: '24', featured: '6', total_views: '18430' }]))
        .mockResolvedValueOnce(pgResult([{ total: '87', pending: '1', storage_bytes: '358981632' }]))
        .mockResolvedValueOnce(pgResult([]))   // recentLeads
        .mockResolvedValueOnce(pgResult([]));  // recentActivity

      const result = await DashboardModel.getKpis(30);

      expect(result.leads.total).toBe(84);
      expect(result.leads.new).toBe(12);
      expect(result.leads.converted).toBe(15);
      expect(result.leads.conversionRate).toBeCloseTo(17.86, 1);

      expect(result.testimonials.total).toBe(18);
      expect(result.testimonials.avgRating).toBe(4.8);

      expect(result.portfolio.totalViews).toBe(18430);
      expect(result.portfolio.featured).toBe(6);

      expect(result.media.totalAssets).toBe(87);
      expect(result.media.pendingScan).toBe(1);
      // 358981632 bytes ≈ 342.5 MB
      expect(result.media.storageUsedMb).toBeCloseTo(342.5, 0);

      expect(result.recentLeads).toEqual([]);
      expect(result.recentActivity).toEqual([]);
    });

    it('handles zero total leads without division error', async () => {
      mockQuery
        .mockResolvedValueOnce(pgResult([{ total: '0', new_count: '0', converted: '0' }]))
        .mockResolvedValueOnce(pgResult([{ total: '0', avg_rating: '0', pending: '0' }]))
        .mockResolvedValueOnce(pgResult([{ total: '0', featured: '0', total_views: '0' }]))
        .mockResolvedValueOnce(pgResult([{ total: '0', pending: '0', storage_bytes: '0' }]))
        .mockResolvedValueOnce(pgResult([]))
        .mockResolvedValueOnce(pgResult([]));

      const result = await DashboardModel.getKpis(7);

      expect(result.leads.conversionRate).toBe(0);
      expect(result.media.storageUsedMb).toBe(0);
    });
  });
});
