// src/types/api.types.ts
// Canonical TypeScript types shared across controllers, services, and validators

import { Request } from 'express';

// ── Roles ─────────────────────────────────────────────────────────────────────

export type AdminRole = 'super_admin' | 'editor' | 'viewer';

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;        // admin_users.id (UUID)
  email: string;
  role: AdminRole;
  jti: string;        // admin_sessions.jwt_jti — for revocation
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: AdminRole;
    sessionId: string;
  };
}

// ── Standard API Envelopes ────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; issue: string }>;
    requestId: string;
    timestamp: string;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ── Entities ──────────────────────────────────────────────────────────────────

export type LeadStatus = 'new' | 'read' | 'replied' | 'converted';

export interface ContactLead {
  id: string;
  createdAt: string;
  fullName: string;
  businessEmail: string;
  companyName: string | null;
  phoneNumber: string | null;
  serviceInterest: string | null;
  budgetRange: string | null;
  message: string;
  status: LeadStatus;
  crmSyncId: string | null;
  crmSyncedAt: string | null;
  // ip_address intentionally excluded from response type
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  role: AdminRole;
  mfaEnabled: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type ScanStatus = 'pending' | 'clean' | 'infected' | 'error';

export interface MediaAsset {
  id: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  publicUrl: string | null;
  scanStatus: ScanStatus;
  uploadedById: string;
  createdAt: string;
}

export interface PortfolioProject {
  id: string;
  slug: string;
  title: string;
  clientName: string;
  category: string;
  description: string | null;
  coverImageId: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  viewCount: number;
  projectUrl: string | null;
  completedAt: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  authorTitle: string | null;
  company: string | null;
  avatarAssetId: string | null;
  starRating: number;
  videoUrl: string | null;
  isVideoTestimonial: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;  // Redacted for non-super_admin
  userAgent: string | null;
  createdAt: string;
}

// ── Dashboard KPIs ────────────────────────────────────────────────────────────

export interface DashboardKpis {
  leads: {
    total: number;
    new: number;
    converted: number;
    conversionRate: number;
  };
  testimonials: {
    total: number;
    avgRating: number;
    pending: number;
  };
  portfolio: {
    total: number;
    featured: number;
    totalViews: number;
  };
  media: {
    totalAssets: number;
    pendingScan: number;
    storageUsedMb: number;
  };
  recentLeads: Array<Pick<ContactLead, 'id' | 'fullName' | 'businessEmail' | 'status' | 'createdAt'>>;
  recentActivity: Array<Pick<AuditLogEntry, 'action' | 'actorEmail' | 'createdAt'>>;
}
