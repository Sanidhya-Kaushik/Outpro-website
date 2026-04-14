// src/__tests__/validators.test.ts
// Unit tests for all Zod schemas

import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  contactFormSchema,
  changePasswordSchema,
  createProjectSchema,
  createTestimonialSchema,
  reorderTestimonialsSchema,
  createAdminUserSchema,
  updateAdminUserSchema,
} from '../validators';

// ── loginSchema ───────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts valid credentials without TOTP', () => {
    const result = loginSchema.safeParse({
      email: 'arjun@outpro.india',
      password: 'mypassword',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid credentials with TOTP', () => {
    const result = loginSchema.safeParse({
      email: 'arjun@outpro.india',
      password: 'mypassword',
      totpCode: '123456',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects TOTP that is not 6 digits', () => {
    const result = loginSchema.safeParse({
      email: 'a@b.com',
      password: 'x',
      totpCode: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('rejects TOTP containing non-digits', () => {
    const result = loginSchema.safeParse({
      email: 'a@b.com',
      password: 'x',
      totpCode: 'abc123',
    });
    expect(result.success).toBe(false);
  });

  it('normalises email to lowercase', () => {
    const result = loginSchema.safeParse({ email: 'ARJUN@OUTPRO.INDIA', password: 'x' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('arjun@outpro.india');
  });
});

// ── contactFormSchema ─────────────────────────────────────────────────────────

describe('contactFormSchema', () => {
  const valid = {
    fullName: 'Neha Kapoor',
    businessEmail: 'neha@techstart.in',
    message: 'We need a new website for our SaaS product.',
    recaptchaToken: 'valid-token-string',
  };

  it('accepts minimal valid payload', () => {
    expect(contactFormSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts full optional fields', () => {
    const result = contactFormSchema.safeParse({
      ...valid,
      companyName: 'TechStart Pvt Ltd',
      phoneNumber: '+919876543210',
      serviceInterest: 'Website Development',
      budgetRange: '₹2L – ₹5L',
    });
    expect(result.success).toBe(true);
  });

  it('rejects fullName shorter than 2 chars', () => {
    expect(contactFormSchema.safeParse({ ...valid, fullName: 'A' }).success).toBe(false);
  });

  it('rejects fullName longer than 120 chars', () => {
    expect(contactFormSchema.safeParse({ ...valid, fullName: 'A'.repeat(121) }).success).toBe(false);
  });

  it('rejects message shorter than 10 chars', () => {
    expect(contactFormSchema.safeParse({ ...valid, message: 'Short' }).success).toBe(false);
  });

  it('rejects message longer than 2000 chars', () => {
    expect(contactFormSchema.safeParse({ ...valid, message: 'A'.repeat(2001) }).success).toBe(false);
  });

  it('rejects invalid phone format', () => {
    expect(
      contactFormSchema.safeParse({ ...valid, phoneNumber: '9876543210' }).success,
    ).toBe(false); // Missing + prefix
  });

  it('accepts E.164 phone format', () => {
    expect(
      contactFormSchema.safeParse({ ...valid, phoneNumber: '+919876543210' }).success,
    ).toBe(true);
  });

  it('rejects invalid service interest enum', () => {
    expect(
      contactFormSchema.safeParse({ ...valid, serviceInterest: 'Invalid Service' }).success,
    ).toBe(false);
  });

  it('rejects missing recaptchaToken', () => {
    const { recaptchaToken: _, ...noToken } = valid;
    expect(contactFormSchema.safeParse(noToken).success).toBe(false);
  });
});

// ── changePasswordSchema ──────────────────────────────────────────────────────

describe('changePasswordSchema', () => {
  const valid = {
    currentPassword: 'OldPassword1!',
    newPassword: 'NewStr0ng@Pass!',
    confirmPassword: 'NewStr0ng@Pass!',
  };

  it('accepts valid password change', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects mismatched confirm password', () => {
    expect(
      changePasswordSchema.safeParse({ ...valid, confirmPassword: 'Different1!' }).success,
    ).toBe(false);
  });

  it('rejects new password shorter than 12 chars', () => {
    expect(
      changePasswordSchema.safeParse({ ...valid, newPassword: 'Short1!', confirmPassword: 'Short1!' }).success,
    ).toBe(false);
  });

  it('rejects password without uppercase', () => {
    expect(
      changePasswordSchema.safeParse({ ...valid, newPassword: 'nouppercase1!', confirmPassword: 'nouppercase1!' }).success,
    ).toBe(false);
  });

  it('rejects password without special character', () => {
    expect(
      changePasswordSchema.safeParse({ ...valid, newPassword: 'NoSpecialChar1', confirmPassword: 'NoSpecialChar1' }).success,
    ).toBe(false);
  });

  it('rejects password without digit', () => {
    expect(
      changePasswordSchema.safeParse({ ...valid, newPassword: 'NoDigitHere!@', confirmPassword: 'NoDigitHere!@' }).success,
    ).toBe(false);
  });
});

// ── createProjectSchema ───────────────────────────────────────────────────────

describe('createProjectSchema', () => {
  const valid = {
    slug: 'brandhouse-agency-rebrand',
    title: 'BrandHouse Agency Rebrand',
    clientName: 'BrandHouse Ltd',
    category: 'Branding',
  };

  it('accepts valid project', () => {
    expect(createProjectSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects slug with uppercase letters', () => {
    expect(createProjectSchema.safeParse({ ...valid, slug: 'BrandHouse-Rebrand' }).success).toBe(false);
  });

  it('rejects slug with spaces', () => {
    expect(createProjectSchema.safeParse({ ...valid, slug: 'brand house' }).success).toBe(false);
  });

  it('rejects invalid category', () => {
    expect(createProjectSchema.safeParse({ ...valid, category: 'Unknown' }).success).toBe(false);
  });

  it('rejects invalid projectUrl', () => {
    expect(createProjectSchema.safeParse({ ...valid, projectUrl: 'not-a-url' }).success).toBe(false);
  });

  it('accepts valid projectUrl', () => {
    expect(createProjectSchema.safeParse({ ...valid, projectUrl: 'https://brandhouse.co.in' }).success).toBe(true);
  });
});

// ── createTestimonialSchema ───────────────────────────────────────────────────

describe('createTestimonialSchema', () => {
  const valid = {
    quote: 'Outpro completely transformed our digital presence in just 6 weeks.',
    authorName: 'Neha Kapoor',
    starRating: 5,
  };

  it('accepts valid testimonial', () => {
    expect(createTestimonialSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects quote shorter than 20 chars', () => {
    expect(createTestimonialSchema.safeParse({ ...valid, quote: 'Too short' }).success).toBe(false);
  });

  it('rejects starRating of 0', () => {
    expect(createTestimonialSchema.safeParse({ ...valid, starRating: 0 }).success).toBe(false);
  });

  it('rejects starRating of 6', () => {
    expect(createTestimonialSchema.safeParse({ ...valid, starRating: 6 }).success).toBe(false);
  });

  it('rejects non-YouTube/Vimeo video URL', () => {
    expect(
      createTestimonialSchema.safeParse({ ...valid, videoUrl: 'https://dailymotion.com/video/123' }).success,
    ).toBe(false);
  });

  it('accepts YouTube video URL', () => {
    expect(
      createTestimonialSchema.safeParse({ ...valid, videoUrl: 'https://www.youtube.com/watch?v=abc123' }).success,
    ).toBe(true);
  });

  it('accepts Vimeo video URL', () => {
    expect(
      createTestimonialSchema.safeParse({ ...valid, videoUrl: 'https://player.vimeo.com/video/123456' }).success,
    ).toBe(true);
  });
});

// ── reorderTestimonialsSchema ─────────────────────────────────────────────────

describe('reorderTestimonialsSchema', () => {
  it('accepts valid reorder payload', () => {
    const result = reorderTestimonialsSchema.safeParse({
      order: [
        { id: 'f6000000-0000-0000-0000-000000000001', displayOrder: 1 },
        { id: 'f6000000-0000-0000-0000-000000000002', displayOrder: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID id', () => {
    expect(
      reorderTestimonialsSchema.safeParse({ order: [{ id: 'not-a-uuid', displayOrder: 1 }] }).success,
    ).toBe(false);
  });

  it('rejects empty order array', () => {
    expect(reorderTestimonialsSchema.safeParse({ order: [] }).success).toBe(false);
  });

  it('rejects negative displayOrder', () => {
    expect(
      reorderTestimonialsSchema.safeParse({
        order: [{ id: 'f6000000-0000-0000-0000-000000000001', displayOrder: -1 }],
      }).success,
    ).toBe(false);
  });
});

// ── createAdminUserSchema ─────────────────────────────────────────────────────

describe('createAdminUserSchema', () => {
  const valid = {
    email: 'priya@outpro.india',
    password: 'Str0ng@P@ssword!',
    fullName: 'Priya Singh',
    role: 'editor',
  };

  it('accepts valid admin user', () => {
    expect(createAdminUserSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid role', () => {
    expect(createAdminUserSchema.safeParse({ ...valid, role: 'moderator' }).success).toBe(false);
  });

  it('accepts super_admin, editor, and viewer roles', () => {
    for (const role of ['super_admin', 'editor', 'viewer']) {
      expect(createAdminUserSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
  });

  it('rejects weak password', () => {
    expect(createAdminUserSchema.safeParse({ ...valid, password: 'weakpass' }).success).toBe(false);
  });
});

// ── updateAdminUserSchema ─────────────────────────────────────────────────────

describe('updateAdminUserSchema', () => {
  it('accepts partial update with only role', () => {
    expect(updateAdminUserSchema.safeParse({ role: 'viewer' }).success).toBe(true);
  });

  it('accepts partial update with only isActive', () => {
    expect(updateAdminUserSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('accepts empty object (no-op)', () => {
    expect(updateAdminUserSchema.safeParse({}).success).toBe(true);
  });

  it('rejects invalid role value', () => {
    expect(updateAdminUserSchema.safeParse({ role: 'hacker' }).success).toBe(false);
  });
});
