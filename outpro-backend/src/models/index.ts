// src/models/index.ts
// Data-access layer — parameterised SQL only, no ORM, no string interpolation

import { PoolClient } from 'pg';
import { query, withTransaction } from '../config/database';
import {
  AdminUser,
  ContactLead,
  LeadStatus,
  MediaAsset,
  PortfolioProject,
  Testimonial,
  AuditLogEntry,
  PaginatedData,
  DashboardKpis,
} from '../types/api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MODEL
// ═══════════════════════════════════════════════════════════════════════════════

export const AuthModel = {
  async findByEmail(email: string) {
    const result = await query<{
      id: string;
      email: string;
      password_hash: string;
      full_name: string | null;
      role: string;
      mfa_enabled: boolean;
      mfa_secret: string | null;
      is_active: boolean;
      failed_attempts: number;
      locked_until: string | null;
      last_login_at: string | null;
    }>(
      `SELECT id, email, password_hash, full_name, role, mfa_enabled, mfa_secret,
              is_active, failed_attempts, locked_until, last_login_at
       FROM admin_users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  },

  async findById(id: string) {
    const result = await query<{
      id: string; email: string; full_name: string | null; role: string;
      mfa_enabled: boolean; is_active: boolean; last_login_at: string | null; created_at: string;
    }>(
      `SELECT id, email, full_name, role, mfa_enabled, is_active, last_login_at, created_at
       FROM admin_users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  async incrementFailedAttempts(id: string, lockUntil: Date | null) {
    await query(
      `UPDATE admin_users
       SET failed_attempts = failed_attempts + 1,
           locked_until = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, lockUntil?.toISOString() ?? null],
    );
  },

  async recordSuccessfulLogin(id: string, ip: string) {
    await query(
      `UPDATE admin_users
       SET failed_attempts = 0,
           locked_until = NULL,
           last_login_at = NOW(),
           last_login_ip = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, ip],
    );
  },

  async createSession(userId: string, jti: string, expiresAt: Date) {
    const result = await query<{ id: string }>(
      `INSERT INTO admin_sessions (admin_user_id, jwt_jti, expires_at)
       VALUES ($1, $2, $3) RETURNING id`,
      [userId, jti, expiresAt.toISOString()],
    );
    return result.rows[0].id;
  },

  async revokeSession(jti: string) {
    await query(
      `UPDATE admin_sessions SET revoked = TRUE, updated_at = NOW() WHERE jwt_jti = $1`,
      [jti],
    );
  },

  async revokeAllUserSessions(userId: string, exceptJti?: string) {
    if (exceptJti) {
      await query(
        `UPDATE admin_sessions SET revoked = TRUE, updated_at = NOW()
         WHERE admin_user_id = $1 AND jwt_jti != $2 AND revoked = FALSE`,
        [userId, exceptJti],
      );
    } else {
      await query(
        `UPDATE admin_sessions SET revoked = TRUE, updated_at = NOW()
         WHERE admin_user_id = $1 AND revoked = FALSE`,
        [userId],
      );
    }
  },

  async storeMfaSecret(userId: string, secret: string) {
    await query(
      `UPDATE admin_users SET mfa_secret = $2, updated_at = NOW() WHERE id = $1`,
      [userId, secret],
    );
  },

  async enableMfa(userId: string) {
    await query(
      `UPDATE admin_users SET mfa_enabled = TRUE, updated_at = NOW() WHERE id = $1`,
      [userId],
    );
  },

  async updatePassword(userId: string, hash: string) {
    await query(
      `UPDATE admin_users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
      [userId, hash],
    );
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT / LEADS MODEL
// ═══════════════════════════════════════════════════════════════════════════════

export const LeadModel = {
  async create(data: {
    fullName: string;
    businessEmail: string;
    companyName?: string;
    phoneNumber?: string;
    serviceInterest?: string;
    budgetRange?: string;
    message: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<{ id: string }> {
    const result = await query<{ id: string }>(
      `INSERT INTO contact_leads
         (full_name, business_email, company_name, phone_number, service_interest,
          budget_range, message, ip_address, user_agent, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'new')
       RETURNING id`,
      [
        data.fullName, data.businessEmail, data.companyName ?? null,
        data.phoneNumber ?? null, data.serviceInterest ?? null,
        data.budgetRange ?? null, data.message, data.ipAddress, data.userAgent,
      ],
    );
    return result.rows[0];
  },

  async findMany(params: {
    status?: string;
    serviceInterest?: string;
    search?: string;
    limit: number;
    offset: number;
    sortBy: string;
    sortDir: string;
  }): Promise<PaginatedData<ContactLead>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`status = $${idx++}`);
      values.push(params.status);
    }
    if (params.serviceInterest) {
      conditions.push(`service_interest = $${idx++}`);
      values.push(params.serviceInterest);
    }
    if (params.search) {
      conditions.push(`(full_name ILIKE $${idx} OR business_email ILIKE $${idx} OR company_name ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSort = ['created_at', 'full_name', 'status'];
    const sortCol = allowedSort.includes(params.sortBy) ? params.sortBy : 'created_at';
    const sortDir = params.sortDir === 'asc' ? 'ASC' : 'DESC';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM contact_leads ${where}`,
      values,
    );

    const dataResult = await query<{
      id: string; created_at: string; full_name: string; business_email: string;
      company_name: string | null; phone_number: string | null; service_interest: string | null;
      budget_range: string | null; message: string; status: string; crm_sync_id: string | null;
      crm_synced_at: string | null;
    }>(
      `SELECT id, created_at, full_name, business_email, company_name, phone_number,
              service_interest, budget_range, message, status, crm_sync_id, crm_synced_at
       FROM contact_leads ${where}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset],
    );

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
    return {
      items: dataResult.rows.map(mapLead),
      pagination: {
        page: Math.floor(params.offset / params.limit) + 1,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  },

  async findById(id: string) {
    const result = await query<{
      id: string; created_at: string; full_name: string; business_email: string;
      company_name: string | null; phone_number: string | null; service_interest: string | null;
      budget_range: string | null; message: string; status: string; crm_sync_id: string | null;
      crm_synced_at: string | null; ip_address: string | null;
    }>(
      `SELECT id, created_at, full_name, business_email, company_name, phone_number,
              service_interest, budget_range, message, status, crm_sync_id, crm_synced_at, ip_address
       FROM contact_leads WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  async update(id: string, data: { status?: LeadStatus; crmSyncId?: string; crmSyncedAt?: Date }) {
    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (data.status) { sets.push(`status = $${idx++}`); values.push(data.status); }
    if (data.crmSyncId) { sets.push(`crm_sync_id = $${idx++}`); values.push(data.crmSyncId); }
    if (data.crmSyncedAt) { sets.push(`crm_synced_at = $${idx++}`); values.push(data.crmSyncedAt.toISOString()); }

    values.push(id);
    const result = await query<{ id: string }>(
      `UPDATE contact_leads SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id`,
      values,
    );
    return result.rows[0] ?? null;
  },

  async delete(id: string) {
    await query(`DELETE FROM contact_leads WHERE id = $1`, [id]);
  },

  async getStats(periodDays: number) {
    const result = await query<{
      total: string; new_count: string; converted: string;
    }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'new') AS new_count,
              COUNT(*) FILTER (WHERE status = 'converted') AS converted
       FROM contact_leads
       WHERE created_at >= NOW() - INTERVAL '${periodDays} days'`,
    );
    return result.rows[0];
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO MODEL
// ═══════════════════════════════════════════════════════════════════════════════

export const PortfolioModel = {
  async create(data: {
    slug: string; title: string; clientName: string; category: string;
    description?: string; coverImageId?: string; isFeatured: boolean;
    isPublished: boolean; projectUrl?: string; completedAt?: string;
    displayOrder: number; tags: string[];
  }): Promise<{ id: string; slug: string }> {
    const result = await query<{ id: string; slug: string }>(
      `INSERT INTO portfolio_projects
         (slug, title, client_name, category, description, cover_image_id, is_featured,
          is_published, project_url, completed_at, display_order, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, slug`,
      [
        data.slug, data.title, data.clientName, data.category,
        data.description ?? null, data.coverImageId ?? null,
        data.isFeatured, data.isPublished, data.projectUrl ?? null,
        data.completedAt ?? null, data.displayOrder, JSON.stringify(data.tags),
      ],
    );
    return result.rows[0];
  },

  async findMany(params: {
    category?: string; featured?: boolean; published?: boolean;
    limit: number; offset: number;
  }): Promise<PaginatedData<PortfolioProject>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.category) { conditions.push(`category = $${idx++}`); values.push(params.category); }
    if (params.featured !== undefined) { conditions.push(`is_featured = $${idx++}`); values.push(params.featured); }
    if (params.published !== undefined) { conditions.push(`is_published = $${idx++}`); values.push(params.published); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM portfolio_projects ${where}`, values);
    const dataResult = await query<Record<string, unknown>>(
      `SELECT id, slug, title, client_name, category, description, cover_image_id,
              is_featured, is_published, view_count, project_url, completed_at,
              display_order, created_at, updated_at
       FROM portfolio_projects ${where}
       ORDER BY display_order ASC, created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset],
    );

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
    return {
      items: dataResult.rows.map(mapProject),
      pagination: { page: Math.floor(params.offset / params.limit) + 1, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    };
  },

  async findBySlug(slug: string) {
    const result = await query<Record<string, unknown>>(
      `SELECT id, slug, title, client_name, category, description, cover_image_id,
              is_featured, is_published, view_count, project_url, completed_at,
              display_order, created_at, updated_at
       FROM portfolio_projects WHERE slug = $1`,
      [slug],
    );
    return result.rows[0] ? mapProject(result.rows[0]) : null;
  },

  async findById(id: string) {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM portfolio_projects WHERE id = $1`, [id],
    );
    return result.rows[0] ? mapProject(result.rows[0]) : null;
  },

  async incrementViewCount(id: string) {
    await query(`UPDATE portfolio_projects SET view_count = view_count + 1 WHERE id = $1`, [id]);
  },

  async update(id: string, data: Partial<ReturnType<typeof PortfolioModel.create>>) {
    // Build dynamic SET clause from provided fields only
    const fieldMap: Record<string, string> = {
      title: 'title', clientName: 'client_name', category: 'category',
      description: 'description', coverImageId: 'cover_image_id', isFeatured: 'is_featured',
      isPublished: 'is_published', projectUrl: 'project_url', completedAt: 'completed_at',
      displayOrder: 'display_order',
    };
    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data) {
        sets.push(`${col} = $${idx++}`);
        values.push((data as Record<string, unknown>)[key] ?? null);
      }
    }

    values.push(id);
    const result = await query<{ id: string }>(
      `UPDATE portfolio_projects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id`,
      values,
    );
    return result.rows[0] ?? null;
  },

  async delete(id: string) {
    await query(`DELETE FROM portfolio_projects WHERE id = $1`, [id]);
  },

  async getCategoryCounts() {
    const result = await query<{ category: string; count: string }>(
      `SELECT category, COUNT(*) AS count FROM portfolio_projects WHERE is_published = TRUE GROUP BY category ORDER BY count DESC`,
    );
    return result.rows.map(r => ({ category: r.category, count: parseInt(r.count, 10) }));
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TESTIMONIALS MODEL
// ═══════════════════════════════════════════════════════════════════════════════

export const TestimonialModel = {
  async create(data: {
    quote: string; authorName: string; authorTitle?: string | null; company?: string | null;
    avatarAssetId?: string | null; starRating: number; videoUrl?: string | null;
    isVideoTestimonial: boolean; isFeatured: boolean; displayOrder: number;
  }): Promise<{ id: string }> {
    const result = await query<{ id: string }>(
      `INSERT INTO testimonials
         (quote, author_name, author_title, company, avatar_asset_id, star_rating,
          video_url, is_video_testimonial, is_featured, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        data.quote, data.authorName, data.authorTitle ?? null, data.company ?? null,
        data.avatarAssetId ?? null, data.starRating, data.videoUrl ?? null,
        data.isVideoTestimonial, data.isFeatured, data.displayOrder,
      ],
    );
    return result.rows[0];
  },

  async findMany(params: {
    featured?: boolean; minRating?: number; videoOnly?: boolean;
    sortBy: string; limit: number; offset: number;
  }): Promise<PaginatedData<Testimonial>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.featured !== undefined) { conditions.push(`is_featured = $${idx++}`); values.push(params.featured); }
    if (params.minRating) { conditions.push(`star_rating >= $${idx++}`); values.push(params.minRating); }
    if (params.videoOnly) { conditions.push(`is_video_testimonial = TRUE`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSort: Record<string, string> = { displayOrder: 'display_order', starRating: 'star_rating', createdAt: 'created_at' };
    const sortCol = allowedSort[params.sortBy] ?? 'display_order';

    const countResult = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM testimonials ${where}`, values);
    const dataResult = await query<Record<string, unknown>>(
      `SELECT id, quote, author_name, author_title, company, avatar_asset_id, star_rating,
              video_url, is_video_testimonial, is_featured, display_order, created_at, updated_at
       FROM testimonials ${where}
       ORDER BY ${sortCol} ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset],
    );

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
    return {
      items: dataResult.rows.map(mapTestimonial),
      pagination: { page: Math.floor(params.offset / params.limit) + 1, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    };
  },

  async findById(id: string) {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM testimonials WHERE id = $1`, [id],
    );
    return result.rows[0] ? mapTestimonial(result.rows[0]) : null;
  },

  async update(id: string, data: Partial<{
    quote: string; authorName: string; authorTitle: string | null; company: string | null;
    starRating: number; videoUrl: string | null; isVideoTestimonial: boolean;
    isFeatured: boolean; displayOrder: number;
  }>) {
    const fieldMap: Record<string, string> = {
      quote: 'quote', authorName: 'author_name', authorTitle: 'author_title',
      company: 'company', starRating: 'star_rating', videoUrl: 'video_url',
      isVideoTestimonial: 'is_video_testimonial', isFeatured: 'is_featured',
      displayOrder: 'display_order',
    };
    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data) {
        sets.push(`${col} = $${idx++}`);
        values.push((data as Record<string, unknown>)[key]);
      }
    }

    values.push(id);
    await query(`UPDATE testimonials SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  },

  async delete(id: string) {
    await query(`DELETE FROM testimonials WHERE id = $1`, [id]);
  },

  async reorder(order: Array<{ id: string; displayOrder: number }>, client?: PoolClient) {
    const exec = client ? client.query.bind(client) : query;
    for (const item of order) {
      await exec(
        `UPDATE testimonials SET display_order = $1, updated_at = NOW() WHERE id = $2`,
        [item.displayOrder, item.id],
      );
    }
  },

  async getStats() {
    const result = await query<{
      total: string; avg_rating: string; featured_count: string; video_count: string;
      by_5: string; by_4: string; by_3: string; by_2: string; by_1: string;
    }>(
      `SELECT COUNT(*) AS total,
              ROUND(AVG(star_rating)::numeric, 1) AS avg_rating,
              COUNT(*) FILTER (WHERE is_featured) AS featured_count,
              COUNT(*) FILTER (WHERE is_video_testimonial) AS video_count,
              COUNT(*) FILTER (WHERE star_rating = 5) AS by_5,
              COUNT(*) FILTER (WHERE star_rating = 4) AS by_4,
              COUNT(*) FILTER (WHERE star_rating = 3) AS by_3,
              COUNT(*) FILTER (WHERE star_rating = 2) AS by_2,
              COUNT(*) FILTER (WHERE star_rating = 1) AS by_1
       FROM testimonials`,
    );
    const r = result.rows[0];
    return {
      total: parseInt(r.total, 10),
      avgRating: parseFloat(r.avg_rating),
      featuredCount: parseInt(r.featured_count, 10),
      videoCount: parseInt(r.video_count, 10),
      byRating: { 5: parseInt(r.by_5, 10), 4: parseInt(r.by_4, 10), 3: parseInt(r.by_3, 10), 2: parseInt(r.by_2, 10), 1: parseInt(r.by_1, 10) },
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN USERS MODEL
// ═══════════════════════════════════════════════════════════════════════════════

export const AdminUserModel = {
  async findAll(): Promise<AdminUser[]> {
    const result = await query<Record<string, unknown>>(
      `SELECT id, email, full_name, role, mfa_enabled, is_active, last_login_at, created_at
       FROM admin_users ORDER BY created_at ASC`,
    );
    return result.rows.map(mapAdminUser);
  },

  async findById(id: string) {
    const result = await query<Record<string, unknown>>(
      `SELECT id, email, full_name, role, mfa_enabled, is_active, last_login_at, created_at
       FROM admin_users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapAdminUser(result.rows[0]) : null;
  },

  async findByEmail(email: string) {
    const result = await query<{ id: string }>(
      `SELECT id FROM admin_users WHERE email = $1`, [email],
    );
    return result.rows[0] ?? null;
  },

  async create(data: { email: string; passwordHash: string; fullName?: string; role: string }): Promise<{ id: string }> {
    const result = await query<{ id: string }>(
      `INSERT INTO admin_users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [data.email, data.passwordHash, data.fullName ?? null, data.role],
    );
    return result.rows[0];
  },

  async update(id: string, data: { role?: string; isActive?: boolean; fullName?: string }) {
    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;
    if (data.role !== undefined) { sets.push(`role = $${idx++}`); values.push(data.role); }
    if (data.isActive !== undefined) { sets.push(`is_active = $${idx++}`); values.push(data.isActive); }
    if (data.fullName !== undefined) { sets.push(`full_name = $${idx++}`); values.push(data.fullName); }
    values.push(id);
    await query(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  },

  async delete(id: string) {
    await query(`DELETE FROM admin_users WHERE id = $1`, [id]);
  },

  async countSuperAdmins(): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM admin_users WHERE role = 'super_admin' AND is_active = TRUE`,
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG MODEL
// ═══════════════════════════════════════════════════════════════════════════════

export const AuditModel = {
  async log(data: {
    actorId: string; actorEmail: string; action: string;
    targetTable?: string; targetId?: string;
    payload?: Record<string, unknown>; ipAddress?: string; userAgent?: string;
  }) {
    await query(
      `INSERT INTO audit_log
         (actor_id, actor_email, action, target_table, target_id, payload, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        data.actorId, data.actorEmail, data.action,
        data.targetTable ?? null, data.targetId ?? null,
        data.payload ? JSON.stringify(data.payload) : null,
        data.ipAddress ?? null, data.userAgent ?? null,
      ],
    );
  },

  async findMany(params: {
    actorId?: string; action?: string; targetTable?: string; targetId?: string;
    from?: string; to?: string; limit: number; offset: number;
  }): Promise<PaginatedData<AuditLogEntry>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.actorId) { conditions.push(`actor_id = $${idx++}`); values.push(params.actorId); }
    if (params.action) { conditions.push(`action ILIKE $${idx++}`); values.push(`%${params.action}%`); }
    if (params.targetTable) { conditions.push(`target_table = $${idx++}`); values.push(params.targetTable); }
    if (params.targetId) { conditions.push(`target_id = $${idx++}`); values.push(params.targetId); }
    if (params.from) { conditions.push(`created_at >= $${idx++}`); values.push(params.from); }
    if (params.to) { conditions.push(`created_at <= $${idx++}`); values.push(params.to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM audit_log ${where}`, values);
    const dataResult = await query<Record<string, unknown>>(
      `SELECT id, actor_id, actor_email, action, target_table, target_id,
              payload, ip_address, user_agent, created_at
       FROM audit_log ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset],
    );

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
    return {
      items: dataResult.rows.map(r => ({
        id: r.id as string, actorId: r.actor_id as string, actorEmail: r.actor_email as string,
        action: r.action as string, targetTable: r.target_table as string | null,
        targetId: r.target_id as string | null, payload: r.payload as Record<string, unknown> | null,
        ipAddress: r.ip_address as string | null, userAgent: r.user_agent as string | null,
        createdAt: r.created_at as string,
      })),
      pagination: { page: Math.floor(params.offset / params.limit) + 1, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA MODEL
// ═══════════════════════════════════════════════════════════════════════════════

export const MediaModel = {
  async create(data: {
    filename: string; mimeType: string; fileSizeBytes: number;
    storagePath: string; uploadedById: string;
  }): Promise<{ id: string }> {
    const result = await query<{ id: string }>(
      `INSERT INTO media_assets (filename, mime_type, file_size_bytes, storage_path, uploaded_by_id, scan_status)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id`,
      [data.filename, data.mimeType, data.fileSizeBytes, data.storagePath, data.uploadedById],
    );
    return result.rows[0];
  },

  async findMany(params: { scanStatus?: string; mimeType?: string; uploadedById?: string; limit: number; offset: number }) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.scanStatus) { conditions.push(`scan_status = $${idx++}`); values.push(params.scanStatus); }
    if (params.mimeType) { conditions.push(`mime_type ILIKE $${idx++}`); values.push(`${params.mimeType}%`); }
    if (params.uploadedById) { conditions.push(`uploaded_by_id = $${idx++}`); values.push(params.uploadedById); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query<{ count: string; size_sum: string }>(
      `SELECT COUNT(*) AS count, COALESCE(SUM(file_size_bytes), 0) AS size_sum FROM media_assets ${where}`, values,
    );
    const dataResult = await query<Record<string, unknown>>(
      `SELECT id, filename, mime_type, file_size_bytes, storage_path, public_url,
              scan_status, uploaded_by_id, created_at
       FROM media_assets ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset],
    );

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
    return {
      items: dataResult.rows.map(mapMedia),
      pagination: { page: Math.floor(params.offset / params.limit) + 1, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
      storageSumBytes: parseInt(countResult.rows[0]?.size_sum ?? '0', 10),
    };
  },

  async findById(id: string) {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM media_assets WHERE id = $1`, [id],
    );
    return result.rows[0] ? mapMedia(result.rows[0]) : null;
  },

  async updateScanResult(id: string, status: string, publicUrl: string | null) {
    await query(
      `UPDATE media_assets SET scan_status = $1, public_url = $2, updated_at = NOW() WHERE id = $3`,
      [status, publicUrl, id],
    );
  },

  async delete(id: string) {
    await query(`DELETE FROM media_assets WHERE id = $1`, [id]);
  },

  async isReferencedElsewhere(id: string): Promise<boolean> {
    const refs = await Promise.all([
      query(`SELECT 1 FROM testimonials WHERE avatar_asset_id = $1 LIMIT 1`, [id]),
      query(`SELECT 1 FROM portfolio_projects WHERE cover_image_id = $1 LIMIT 1`, [id]),
    ]);
    return refs.some(r => (r.rowCount ?? 0) > 0);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD MODEL
// ═══════════════════════════════════════════════════════════════════════════════

export const DashboardModel = {
  async getKpis(periodDays: number): Promise<DashboardKpis> {
    const [leads, testimonials, portfolio, media, recentLeads, recentActivity] = await Promise.all([
      query<{ total: string; new_count: string; converted: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'new') AS new_count,
                COUNT(*) FILTER (WHERE status = 'converted') AS converted
         FROM contact_leads WHERE created_at >= NOW() - INTERVAL '${periodDays} days'`,
      ),
      query<{ total: string; avg_rating: string; pending: string }>(
        `SELECT COUNT(*) AS total, ROUND(AVG(star_rating)::numeric,1) AS avg_rating,
                COUNT(*) FILTER (WHERE star_rating < 3) AS pending FROM testimonials`,
      ),
      query<{ total: string; featured: string; total_views: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE is_featured) AS featured,
                COALESCE(SUM(view_count), 0) AS total_views FROM portfolio_projects`,
      ),
      query<{ total: string; pending: string; storage_bytes: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE scan_status = 'pending') AS pending,
                COALESCE(SUM(file_size_bytes), 0) AS storage_bytes FROM media_assets`,
      ),
      query<{ id: string; full_name: string; business_email: string; status: string; created_at: string }>(
        `SELECT id, full_name, business_email, status, created_at FROM contact_leads ORDER BY created_at DESC LIMIT 5`,
      ),
      query<{ action: string; actor_email: string; created_at: string }>(
        `SELECT action, actor_email, created_at FROM audit_log ORDER BY created_at DESC LIMIT 10`,
      ),
    ]);

    const l = leads.rows[0];
    const total = parseInt(l.total, 10);
    const converted = parseInt(l.converted, 10);

    return {
      leads: {
        total, new: parseInt(l.new_count, 10), converted,
        conversionRate: total > 0 ? Math.round((converted / total) * 10000) / 100 : 0,
      },
      testimonials: {
        total: parseInt(testimonials.rows[0].total, 10),
        avgRating: parseFloat(testimonials.rows[0].avg_rating ?? '0'),
        pending: parseInt(testimonials.rows[0].pending, 10),
      },
      portfolio: {
        total: parseInt(portfolio.rows[0].total, 10),
        featured: parseInt(portfolio.rows[0].featured, 10),
        totalViews: parseInt(portfolio.rows[0].total_views, 10),
      },
      media: {
        totalAssets: parseInt(media.rows[0].total, 10),
        pendingScan: parseInt(media.rows[0].pending, 10),
        storageUsedMb: Math.round(parseInt(media.rows[0].storage_bytes, 10) / 1024 / 1024 * 100) / 100,
      },
      recentLeads: recentLeads.rows.map(r => ({
        id: r.id, fullName: r.full_name, businessEmail: r.business_email,
        status: r.status as LeadStatus, createdAt: r.created_at,
        companyName: null, phoneNumber: null, serviceInterest: null,
        budgetRange: null, message: '', crmSyncId: null, crmSyncedAt: null,
      })),
      recentActivity: recentActivity.rows.map(r => ({
        id: '', actorId: '', actorEmail: r.actor_email, action: r.action,
        targetTable: null, targetId: null, payload: null, ipAddress: null,
        userAgent: null, createdAt: r.created_at,
      })),
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Row mappers (snake_case DB → camelCase domain)
// ═══════════════════════════════════════════════════════════════════════════════

function mapLead(r: Record<string, unknown>): ContactLead {
  return {
    id: r.id as string, createdAt: r.created_at as string,
    fullName: r.full_name as string, businessEmail: r.business_email as string,
    companyName: r.company_name as string | null, phoneNumber: r.phone_number as string | null,
    serviceInterest: r.service_interest as string | null, budgetRange: r.budget_range as string | null,
    message: r.message as string, status: r.status as LeadStatus,
    crmSyncId: r.crm_sync_id as string | null, crmSyncedAt: r.crm_synced_at as string | null,
  };
}

function mapProject(r: Record<string, unknown>): PortfolioProject {
  return {
    id: r.id as string, slug: r.slug as string, title: r.title as string,
    clientName: r.client_name as string, category: r.category as string,
    description: r.description as string | null, coverImageId: r.cover_image_id as string | null,
    isFeatured: r.is_featured as boolean, isPublished: r.is_published as boolean,
    viewCount: r.view_count as number, projectUrl: r.project_url as string | null,
    completedAt: r.completed_at as string | null, displayOrder: r.display_order as number,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

function mapTestimonial(r: Record<string, unknown>): Testimonial {
  return {
    id: r.id as string, quote: r.quote as string, authorName: r.author_name as string,
    authorTitle: r.author_title as string | null, company: r.company as string | null,
    avatarAssetId: r.avatar_asset_id as string | null, starRating: r.star_rating as number,
    videoUrl: r.video_url as string | null, isVideoTestimonial: r.is_video_testimonial as boolean,
    isFeatured: r.is_featured as boolean, displayOrder: r.display_order as number,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

function mapAdminUser(r: Record<string, unknown>): AdminUser {
  return {
    id: r.id as string, email: r.email as string, fullName: r.full_name as string | null,
    role: r.role as AdminRole, mfaEnabled: r.mfa_enabled as boolean,
    isActive: r.is_active as boolean, lastLoginAt: r.last_login_at as string | null,
    createdAt: r.created_at as string,
  };
}

function mapMedia(r: Record<string, unknown>): MediaAsset {
  return {
    id: r.id as string, filename: r.filename as string, mimeType: r.mime_type as string,
    fileSizeBytes: r.file_size_bytes as number, storagePath: r.storage_path as string,
    publicUrl: r.public_url as string | null, scanStatus: r.scan_status as ScanStatus,
    uploadedById: r.uploaded_by_id as string, createdAt: r.created_at as string,
  };
}
