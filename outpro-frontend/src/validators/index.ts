// src/validators/index.ts
import { z } from 'zod';

export const contactFormSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(120).trim(),
  businessEmail: z.string().email('Please enter a valid email').max(255).toLowerCase().trim(),
  companyName: z.string().max(200).trim().optional(),
  phoneNumber: z
    .string()
    .max(30)
    .regex(/^\+?[1-9]\d{1,14}$/, 'Use E.164 format, e.g. +919876543210')
    .optional()
    .or(z.literal('')),
  serviceInterest: z
    .enum(['Website Development', 'Digital Marketing', 'UI/UX Design', 'Mobile App', 'SEO', 'Other'])
    .optional(),
  budgetRange: z.string().max(80).optional(),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must not exceed 2000 characters')
    .trim(),
  recaptchaToken: z.string().min(1),
});

export const loginFormSchema = z.object({
  email: z.string().email('Enter a valid email').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
  totpCode: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Code must contain only digits')
    .optional()
    .or(z.literal('')),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one digit')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const projectFormSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase kebab-case')
    .trim(),
  title: z.string().min(2).max(200).trim(),
  clientName: z.string().min(1).max(200).trim(),
  category: z.enum(['Web Development', 'Branding', 'Mobile', 'UI/UX', 'Marketing', 'SEO']),
  description: z.string().max(5000).trim().optional(),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  projectUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

export const testimonialFormSchema = z.object({
  quote: z.string().min(20, 'Quote must be at least 20 characters').max(1000).trim(),
  authorName: z.string().min(1).max(150).trim(),
  authorTitle: z.string().max(100).trim().optional(),
  company: z.string().max(200).trim().optional(),
  starRating: z.number().int().min(1).max(5),
  videoUrl: z
    .string()
    .url()
    .regex(/^https:\/\/(player\.vimeo\.com|www\.youtube\.com|youtube\.com)/, 'Must be Vimeo or YouTube')
    .optional()
    .or(z.literal('')),
  isVideoTestimonial: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
});

export const adminUserFormSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Uppercase required')
    .regex(/[a-z]/, 'Lowercase required')
    .regex(/[0-9]/, 'Digit required')
    .regex(/[^A-Za-z0-9]/, 'Special character required'),
  fullName: z.string().max(150).trim().optional(),
  role: z.enum(['super_admin', 'editor', 'viewer']),
});

export type ContactFormValues  = z.infer<typeof contactFormSchema>;
export type LoginFormValues    = z.infer<typeof loginFormSchema>;
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;
export type ProjectFormValues  = z.infer<typeof projectFormSchema>;
export type TestimonialFormValues = z.infer<typeof testimonialFormSchema>;
export type AdminUserFormValues = z.infer<typeof adminUserFormSchema>;
