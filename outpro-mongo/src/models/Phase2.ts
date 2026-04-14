// src/models/Phase2.ts
// Phase 2 models: Blog system + Careers module
// Phase 3 models: Partner Portal
// Replaces PostgreSQL: blog_categories, blog_posts, blog_post_categories,
//                      job_openings, job_applications, partners, partner_users

import mongoose, { Schema, Document, Model } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — BLOG
// In MongoDB we embed categories inside posts (no junction table needed)
// ─────────────────────────────────────────────────────────────────────────────

// ── BlogCategory ──────────────────────────────────────────────────────────────
export interface IBlogCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  createdAt: Date;
}

const BlogCategorySchema = new Schema<IBlogCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 110 },
    description: { type: String, maxlength: 500 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'blog_categories',
  }
);

BlogCategorySchema.index({ slug: 1 }, { unique: true });

const BlogCategory: Model<IBlogCategory> =
  mongoose.models.BlogCategory ||
  mongoose.model<IBlogCategory>('BlogCategory', BlogCategorySchema);

export { BlogCategory };


// ── BlogPost ──────────────────────────────────────────────────────────────────
// Categories are embedded as ObjectId refs — replaces blog_post_categories join table
export interface IBlogPost extends Document {
  _id: mongoose.Types.ObjectId;
  sanityId: string;             // Sanity document _id — source of truth
  title: string;
  slug: string;
  authorName?: string;
  excerpt?: string;
  publishedAt?: Date;
  isPublished: boolean;
  viewCount: number;
  categories: mongoose.Types.ObjectId[];  // replaces junction table
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
  {
    sanityId: {
      type: String,
      required: true,
      unique: true,
      maxlength: 100,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
    },
    authorName: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    excerpt: {
      type: String,
      maxlength: 500,
    },
    publishedAt: Date,
    isPublished: {
      type: Boolean,
      default: false,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ── Embedded category refs (replaces blog_post_categories junction table)
    categories: [{
      type: Schema.Types.ObjectId,
      ref: 'BlogCategory',
    }],
  },
  {
    timestamps: true,
    collection: 'blog_posts',
  }
);

BlogPostSchema.index({ slug: 1 }, { unique: true });                          // idx_blog_slug
BlogPostSchema.index({ publishedAt: -1, isPublished: 1 });                    // idx_blog_published_at
BlogPostSchema.index({ categories: 1 });
BlogPostSchema.index(
  { title: 'text', excerpt: 'text' },
  { name: 'idx_blog_fts', weights: { title: 3, excerpt: 1 } }
);

const BlogPost: Model<IBlogPost> =
  mongoose.models.BlogPost ||
  mongoose.model<IBlogPost>('BlogPost', BlogPostSchema);

export { BlogPost };


// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — CAREERS
// ─────────────────────────────────────────────────────────────────────────────

export type EmploymentType = 'full-time' | 'contract' | 'internship';
export type JobAppStatus = 'received' | 'under_review' | 'shortlisted' | 'rejected' | 'hired';

// ── JobOpening ────────────────────────────────────────────────────────────────
export interface IJobOpening extends Document {
  _id: mongoose.Types.ObjectId;
  sanityId: string;
  title: string;
  slug: string;
  department?: string;
  location?: string;
  employmentType?: EmploymentType;
  isActive: boolean;
  closesAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobOpeningSchema = new Schema<IJobOpening>(
  {
    sanityId: { type: String, required: true, unique: true, maxlength: 100 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 220 },
    department: { type: String, trim: true, maxlength: 100 },
    location: { type: String, trim: true, maxlength: 100 },
    employmentType: {
      type: String,
      enum: ['full-time', 'contract', 'internship'] as EmploymentType[],
    },
    isActive: { type: Boolean, default: true },
    closesAt: Date,
  },
  { timestamps: true, collection: 'job_openings' }
);

JobOpeningSchema.index({ isActive: 1 });                                   // idx_jobs_is_active
JobOpeningSchema.index({ slug: 1 }, { unique: true });

const JobOpening: Model<IJobOpening> =
  mongoose.models.JobOpening ||
  mongoose.model<IJobOpening>('JobOpening', JobOpeningSchema);

export { JobOpening };


// ── JobApplication ────────────────────────────────────────────────────────────
export interface IJobApplication extends Document {
  _id: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;          // ref: JobOpening
  fullName: string;
  email: string;
  phoneNumber?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  coverLetter?: string;
  resumeAssetId?: mongoose.Types.ObjectId; // ref: MediaAsset
  status: JobAppStatus;
  recaptchaScore?: number;
  ipAddress?: string;
  reviewedBy?: mongoose.Types.ObjectId;    // ref: AdminUser
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobApplicationSchema = new Schema<IJobApplication>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'JobOpening', required: true },
    fullName: { type: String, required: true, trim: true, maxlength: 150 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phoneNumber: { type: String, trim: true, maxlength: 30 },
    linkedinUrl: { type: String, maxlength: 512 },
    portfolioUrl: { type: String, maxlength: 512 },
    coverLetter: { type: String, maxlength: 5000 },
    resumeAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
    status: {
      type: String,
      enum: ['received', 'under_review', 'shortlisted', 'rejected', 'hired'] as JobAppStatus[],
      default: 'received',
    },
    recaptchaScore: { type: Number, min: 0, max: 1 },
    ipAddress: { type: String, maxlength: 45, select: false },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    internalNotes: { type: String, maxlength: 5000 },
  },
  { timestamps: true, collection: 'job_applications' }
);

JobApplicationSchema.index({ jobId: 1 });                                  // idx_job_apps_job_id
JobApplicationSchema.index({ status: 1 });                                 // idx_job_apps_status
JobApplicationSchema.index({ email: 1 });                                  // idx_job_apps_email

const JobApplication: Model<IJobApplication> =
  mongoose.models.JobApplication ||
  mongoose.model<IJobApplication>('JobApplication', JobApplicationSchema);

export { JobApplication };


// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — PARTNER PORTAL
// ─────────────────────────────────────────────────────────────────────────────

export type PartnerTier = 'standard' | 'silver' | 'gold';

// ── Partner ───────────────────────────────────────────────────────────────────
export interface IPartner extends Document {
  _id: mongoose.Types.ObjectId;
  companyName: string;
  contactEmail: string;
  tier: PartnerTier;
  isActive: boolean;
  joinedAt: Date;
  createdAt: Date;
}

const PartnerSchema = new Schema<IPartner>(
  {
    companyName: { type: String, required: true, trim: true, maxlength: 200 },
    contactEmail: { type: String, required: true, unique: true, lowercase: true, trim: true },
    tier: {
      type: String,
      enum: ['standard', 'silver', 'gold'] as PartnerTier[],
      default: 'standard',
    },
    isActive: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'partners',
  }
);

PartnerSchema.index({ contactEmail: 1 }, { unique: true });
PartnerSchema.index({ tier: 1 });

const Partner: Model<IPartner> =
  mongoose.models.Partner ||
  mongoose.model<IPartner>('Partner', PartnerSchema);

export { Partner };


// ── PartnerUser ───────────────────────────────────────────────────────────────
export interface IPartnerUser extends Document {
  _id: mongoose.Types.ObjectId;
  partnerId: mongoose.Types.ObjectId;  // ref: Partner
  email: string;
  passwordHash: string;
  fullName?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

const PartnerUserSchema = new Schema<IPartnerUser>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String, trim: true, maxlength: 150 },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'partner_users',
  }
);

PartnerUserSchema.index({ email: 1 }, { unique: true });
PartnerUserSchema.index({ partnerId: 1 });

const PartnerUser: Model<IPartnerUser> =
  mongoose.models.PartnerUser ||
  mongoose.model<IPartnerUser>('PartnerUser', PartnerUserSchema);

export { PartnerUser };
