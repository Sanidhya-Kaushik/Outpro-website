// src/validators/index.ts
// All Zod schemas — mirrors API Design Specification validation rules exactly

import { z } from 'zod';

// ── Shared primitives ─────────────────────────────────────────────────────────

const uuid = z.string().uuid();
const email = z.string().email().max(255).toLowerCase().trim();
const password = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');

const totpCode = z
  .string()
  .length(6, 'TOTP code must be exactly 6 digits')
  .regex(/^\d{6}$/, 'TOTP code must contain only digits');

const e164Phone = z
  .string()
  .max(30)
  .regex(/^\+?[1-9]\d{1,14}$/, 'Phone must be in E.164 format')
  .optional();

const videoUrl = z
  .string()
  .url()
  .regex(
    /^https:\/\/(player\.vimeo\.com|www\.youtube\.com|youtube\.com)/,
    'Video URL must be from Vimeo or YouTube',
  )
  .optional()
  .nullable();

const serviceInterestEnum = z
  .enum(['Website Development', 'Digital Marketing', 'UI/UX Design', 'Mobile App', 'SEO', 'Other'])
  .optional();

// ── Auth ──────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  totpCode: totpCode.optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine(d => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const mfaVerifySchema = z.object({
  totpCode,
});

// ── Contact form ──────────────────────────────────────────────────────────────

export const contactFormSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(120, 'Full name must not exceed 120 characters')
    .trim(),
  businessEmail: email,
  companyName: z.string().max(200).trim().optional(),
  phoneNumber: e164Phone,
  serviceInterest: serviceInterestEnum,
  budgetRange: z.string().max(80).trim().optional(),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must not exceed 2000 characters')
    .trim(),
  recaptchaToken: z.string().min(1, 'reCAPTCHA token is required'),
});

// ── Lead update ───────────────────────────────────────────────────────────────

export const updateLeadSchema = z.object({
  status: z.enum(['new', 'read', 'replied', 'converted']).optional(),
  companyName: z.string().max(200).trim().optional(),
  notes: z.string().max(5000).trim().optional(),
});

// ── Portfolio ─────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case')
    .trim(),
  title: z.string().min(2).max(200).trim(),
  clientName: z.string().min(1).max(200).trim(),
  category: z
    .enum(['Web Development', 'Branding', 'Mobile', 'UI/UX', 'Marketing', 'SEO'])
    .default('Web Development'),
  description: z.string().max(5000).trim().optional(),
  coverImageId: uuid.optional().nullable(),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  projectUrl: z.string().url().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  displayOrder: z.number().int().positive().default(0),
  tags: z.array(z.string().max(50)).max(10).default([]),
});

export const updateProjectSchema = createProjectSchema.partial().omit({ slug: true });

// ── Testimonials ──────────────────────────────────────────────────────────────

export const createTestimonialSchema = z.object({
  quote: z.string().min(20).max(1000).trim(),
  authorName: z.string().min(1).max(150).trim(),
  authorTitle: z.string().max(100).trim().optional().nullable(),
  company: z.string().max(200).trim().optional().nullable(),
  avatarAssetId: uuid.optional().nullable(),
  starRating: z.number().int().min(1).max(5),
  videoUrl,
  isVideoTestimonial: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  displayOrder: z.number().int().nonnegative().default(0),
});

export const updateTestimonialSchema = createTestimonialSchema.partial();

export const reorderTestimonialsSchema = z.object({
  order: z
    .array(
      z.object({
        id: uuid,
        displayOrder: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(100),
});

// ── Admin users ───────────────────────────────────────────────────────────────

export const createAdminUserSchema = z.object({
  email,
  password,
  fullName: z.string().max(150).trim().optional(),
  role: z.enum(['super_admin', 'editor', 'viewer']),
});

export const updateAdminUserSchema = z.object({
  role: z.enum(['super_admin', 'editor', 'viewer']).optional(),
  isActive: z.boolean().optional(),
  fullName: z.string().max(150).trim().optional(),
});

// ── Audit log query ───────────────────────────────────────────────────────────

export const auditLogQuerySchema = z.object({
  actorId: uuid.optional(),
  action: z.string().max(100).optional(),
  targetTable: z.string().max(100).optional(),
  targetId: uuid.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('50').transform(Number),
});

// ── Lead list query ───────────────────────────────────────────────────────────

export const leadQuerySchema = z.object({
  status: z.enum(['new', 'read', 'replied', 'converted']).optional(),
  serviceInterest: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('20').transform(Number),
  sortBy: z.enum(['createdAt', 'fullName', 'status']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

// ── Portfolio query ───────────────────────────────────────────────────────────

export const portfolioQuerySchema = z.object({
  category: z.string().optional(),
  featured: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  published: z
    .string()
    .optional()
    .transform(v => (v === undefined ? undefined : v === 'true')),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('9').transform(Number),
});

// ── Testimonial query ─────────────────────────────────────────────────────────

export const testimonialQuerySchema = z.object({
  featured: z
    .string()
    .optional()
    .transform(v => (v === undefined ? undefined : v === 'true')),
  minRating: z.string().optional().transform(v => (v ? parseInt(v, 10) : undefined)),
  videoOnly: z
    .string()
    .optional()
    .transform(v => (v === undefined ? undefined : v === 'true')),
  sortBy: z.enum(['displayOrder', 'starRating', 'createdAt']).default('displayOrder'),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('20').transform(Number),
});

// ── Media query ───────────────────────────────────────────────────────────────

export const mediaQuerySchema = z.object({
  scanStatus: z.enum(['pending', 'clean', 'infected', 'error']).optional(),
  mimeType: z.string().optional(),
  uploadedById: uuid.optional(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('24').transform(Number),
});

// ── Dashboard query ───────────────────────────────────────────────────────────

export const dashboardQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
});

// ── Type exports ──────────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ContactFormInput = z.infer<typeof contactFormSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;
export type UpdateTestimonialInput = z.infer<typeof updateTestimonialSchema>;
export type ReorderTestimonialsInput = z.infer<typeof reorderTestimonialsSchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
