// src/lib/api/client.ts
// Typed API client — wraps fetch with auth, error parsing, and retry

import { ApiSuccess, ApiError, ApiResponse, PaginatedData } from '@/types';
import { useAuthStore } from '@/store/authStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://www.outpro.india/api/v1';

// ── Custom error ──────────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Array<{ field: string; issue: string }>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  init: RequestInit = {},
  skipAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers ?? {}) as Record<string, string>),
  };

  // Inject Bearer token for authenticated requests
  if (!skipAuth) {
    const token = useAuthStore.getState().token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  const body = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !body.success) {
    const err = body as ApiError;
    // Auto-logout on 401
    if (res.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    throw new ApiClientError(
      err.error.code,
      err.error.message,
      res.status,
      err.error.details,
    );
  }

  return (body as ApiSuccess<T>).data;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const api = {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>, skipAuth = false) {
    const url = params
      ? `${path}?${new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()}`
      : path;
    return request<T>(url, { method: 'GET' }, skipAuth);
  },

  post<T>(path: string, body?: unknown, skipAuth = false) {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, skipAuth);
  },

  patch<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  },

  del<T = void>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  },
};

export default api;

// ── Auth endpoints ────────────────────────────────────────────────────────────

export const authApi = {
  login: (data: { email: string; password: string; totpCode?: string }) =>
    api.post<{ token: string; expiresAt: string; user: import('@/types').AdminUser }>(
      '/auth/login', data, true,
    ),

  logout: () => api.post<{ message: string }>('/auth/logout'),

  me: () => api.get<import('@/types').AdminUser>('/auth/me'),

  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => api.patch<{ message: string }>('/auth/password', data),

  mfaSetup: () =>
    api.post<{ qrCode: string; manualKey: string }>('/auth/mfa/setup'),

  mfaVerify: (totpCode: string) =>
    api.post<{ message: string }>('/auth/mfa/verify', { totpCode }),
};

// ── Contact / Leads endpoints ─────────────────────────────────────────────────

export const contactApi = {
  submit: (data: import('@/types').ContactFormValues) =>
    api.post<{ message: string }>('/contact', data, true),

  getLeads: (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: string;
  }) => api.get<PaginatedData<import('@/types').ContactLead>>('/contact/leads', params),

  getLead: (id: string) =>
    api.get<import('@/types').ContactLead>(`/contact/leads/${id}`),

  updateLead: (id: string, data: { status?: import('@/types').LeadStatus }) =>
    api.patch<import('@/types').ContactLead>(`/contact/leads/${id}`, data),

  deleteLead: (id: string) => api.del(`/contact/leads/${id}`),

  getStats: (period = 30) =>
    api.get<{
      total: number;
      new: number;
      converted: number;
      conversionRate: number;
    }>('/contact/leads/stats', { period }),
};

// ── Portfolio endpoints ───────────────────────────────────────────────────────

export const portfolioApi = {
  list: (params?: {
    category?: string;
    featured?: boolean;
    published?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedData<import('@/types').PortfolioProject>>('/portfolio', params, true),

  categories: () =>
    api.get<Array<{ category: string; count: number }>>('/portfolio/categories', undefined, true),

  getBySlug: (slug: string) =>
    api.get<import('@/types').PortfolioProject>(`/portfolio/${slug}`, undefined, true),

  create: (data: Partial<import('@/types').PortfolioProject>) =>
    api.post<{ id: string; slug: string }>('/portfolio', data),

  update: (id: string, data: Partial<import('@/types').PortfolioProject>) =>
    api.patch<import('@/types').PortfolioProject>(`/portfolio/${id}`, data),

  delete: (id: string) => api.del(`/portfolio/${id}`),
};

// ── Testimonials endpoints ────────────────────────────────────────────────────

export const testimonialsApi = {
  list: (params?: {
    featured?: boolean;
    minRating?: number;
    videoOnly?: boolean;
    sortBy?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<PaginatedData<import('@/types').Testimonial>>(
      '/testimonials', params, true,
    ),

  getById: (id: string) =>
    api.get<import('@/types').Testimonial>(`/testimonials/${id}`),

  getStats: () =>
    api.get<{
      total: number;
      avgRating: number;
      featuredCount: number;
      videoCount: number;
      byRating: Record<number, number>;
    }>('/testimonials/stats'),

  create: (data: Partial<import('@/types').Testimonial>) =>
    api.post<{ id: string }>('/testimonials', data),

  update: (id: string, data: Partial<import('@/types').Testimonial>) =>
    api.patch<import('@/types').Testimonial>(`/testimonials/${id}`, data),

  delete: (id: string) => api.del(`/testimonials/${id}`),

  reorder: (order: Array<{ id: string; displayOrder: number }>) =>
    api.patch<{ reordered: number }>('/testimonials/reorder', { order }),
};

// ── Admin endpoints ───────────────────────────────────────────────────────────

export const adminApi = {
  dashboard: (period: '7d' | '30d' | '90d' = '30d') =>
    api.get<import('@/types').DashboardKpis>('/admin/dashboard', { period }),

  // Users
  listUsers: () => api.get<import('@/types').AdminUser[]>('/admin/users'),
  createUser: (data: {
    email: string;
    password: string;
    fullName?: string;
    role: string;
  }) => api.post<import('@/types').AdminUser>('/admin/users', data),
  updateUser: (id: string, data: { role?: string; isActive?: boolean; fullName?: string }) =>
    api.patch<import('@/types').AdminUser>(`/admin/users/${id}`, data),
  deleteUser: (id: string) => api.del(`/admin/users/${id}`),

  // Audit log
  auditLog: (params?: {
    actorId?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<PaginatedData<import('@/types').AuditLogEntry>>(
      '/admin/audit-log', params,
    ),

  // Media
  listMedia: (params?: {
    scanStatus?: string;
    mimeType?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<PaginatedData<import('@/types').MediaAsset>>('/admin/media', params),

  uploadMedia: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const token = useAuthStore.getState().token;
    return fetch(`${BASE_URL}/admin/media`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async r => {
      const body = await r.json() as ApiResponse<import('@/types').MediaAsset>;
      if (!r.ok || !body.success) throw new ApiClientError(
        (body as ApiError).error.code,
        (body as ApiError).error.message,
        r.status,
      );
      return (body as ApiSuccess<import('@/types').MediaAsset>).data;
    });
  },

  deleteMedia: (id: string) => api.del(`/admin/media/${id}`),
};
