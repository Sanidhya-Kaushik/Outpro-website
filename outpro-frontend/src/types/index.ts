// src/types/index.ts
// Canonical frontend types — mirrors API contract from outpro-india-api

export type AdminRole = 'super_admin' | 'editor' | 'viewer';
export type LeadStatus = 'new' | 'read' | 'replied' | 'converted';
export type ScanStatus = 'pending' | 'clean' | 'infected' | 'error';

// ── API envelope ──────────────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta: { requestId: string; timestamp: string };
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

// ── Domain entities ───────────────────────────────────────────────────────────

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

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface DashboardKpis {
  leads: { total: number; new: number; converted: number; conversionRate: number };
  testimonials: { total: number; avgRating: number; pending: number };
  portfolio: { total: number; featured: number; totalViews: number };
  media: { totalAssets: number; pendingScan: number; storageUsedMb: number };
  recentLeads: Array<Pick<ContactLead, 'id' | 'fullName' | 'businessEmail' | 'status' | 'createdAt'>>;
  recentActivity: Array<Pick<AuditLogEntry, 'action' | 'actorEmail' | 'createdAt'>>;
}

// ── Form types ────────────────────────────────────────────────────────────────

export type ServiceInterest =
  | 'Website Development'
  | 'Digital Marketing'
  | 'UI/UX Design'
  | 'Mobile App'
  | 'SEO'
  | 'Other';

export interface ContactFormValues {
  fullName: string;
  businessEmail: string;
  companyName?: string;
  phoneNumber?: string;
  serviceInterest?: ServiceInterest;
  budgetRange?: string;
  message: string;
  recaptchaToken: string;
}

export interface LoginFormValues {
  email: string;
  password: string;
  totpCode?: string;
}

// ── Auth store ────────────────────────────────────────────────────────────────

export interface AuthState {
  user: AdminUser | null;
  token: string | null;
  expiresAt: string | null;
  isAuthenticated: boolean;
  setAuth: (data: { token: string; expiresAt: string; user: AdminUser }) => void;
  clearAuth: () => void;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// ── Sanity CMS types ──────────────────────────────────────────────────────────

export interface SanityImage {
  _type: 'image';
  asset: { _ref: string; _type: 'reference' };
  hotspot?: { x: number; y: number; height: number; width: number };
  alt?: string;
}

export interface SanityService {
  _id: string;
  slug: { current: string };
  title: string;
  tagline: string;
  description: string;
  icon: string;
  heroImage: SanityImage;
  deliverables: string[];
  caseStudies: Array<{ slug: { current: string }; title: string }>;
}

export interface SanityTeamMember {
  _id: string;
  name: string;
  role: string;
  bio: string;
  photo: SanityImage;
  linkedIn?: string;
}

export interface SanitySiteSettings {
  siteName: string;
  tagline: string;
  description: string;
  ogImage: SanityImage;
  address: string;
  phone: string;
  email: string;
  social: { platform: string; url: string }[];
}
