// src/models/ContactLead.ts
// Replaces PostgreSQL: contact_leads table
// Primary transactional table — all inbound contact form submissions

import mongoose, { Schema, Document, Model } from 'mongoose';

// ── Enum types ────────────────────────────────────────────────────────────────
export type LeadStatus = 'new' | 'read' | 'replied' | 'converted' | 'archived';
export type CrmProvider = 'hubspot' | 'zoho' | 'none';

// ── TypeScript interface ───────────────────────────────────────────────────────
export interface IContactLead extends Document {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  businessEmail: string;
  companyName?: string;
  phoneNumber?: string;
  serviceInterest?: string;
  budgetRange?: string;
  message: string;
  status: LeadStatus;

  // CRM sync
  crmProvider: CrmProvider;
  crmSyncId?: string;          // HubSpot / Zoho contact ID
  crmSyncedAt?: Date;
  crmSyncError?: string;

  // Security & tracking
  ipAddress?: string;          // Encrypted at app layer before storage
  recaptchaScore?: number;     // 0.00–1.00 — threshold ≥ 0.5 required
  userAgent?: string;

  // Admin tracking
  assignedTo?: mongoose.Types.ObjectId;   // ref: AdminUser
  repliedBy?: mongoose.Types.ObjectId;    // ref: AdminUser
  repliedAt?: Date;
  internalNotes?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ────────────────────────────────────────────────────────────────────
const ContactLeadSchema = new Schema<IContactLead>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    businessEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    phoneNumber: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    serviceInterest: {
      type: String,
      trim: true,
      maxlength: 100,
      enum: [
        'Website Development',
        'UI/UX Design',
        'Mobile App',
        'Digital Marketing',
        'SEO',
        'Branding',
        'Other',
        null,
      ],
    },
    budgetRange: {
      type: String,
      trim: true,
      maxlength: 80,
      enum: ['₹50K – ₹2L', '₹2L – ₹5L', '₹5L – ₹15L', '₹15L – ₹50L', '₹50L+', 'Not sure yet', null],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['new', 'read', 'replied', 'converted', 'archived'] as LeadStatus[],
      default: 'new',
      required: true,
    },

    // ── CRM sync ──────────────────────────────────────────────────────────────
    crmProvider: {
      type: String,
      enum: ['hubspot', 'zoho', 'none'] as CrmProvider[],
      default: 'none',
    },
    crmSyncId: {
      type: String,
      maxlength: 100,
      sparse: true,
    },
    crmSyncedAt: Date,
    crmSyncError: String,

    // ── Security ──────────────────────────────────────────────────────────────
    ipAddress: {
      type: String,
      maxlength: 45,
      select: false,           // PII — not returned by default
    },
    recaptchaScore: {
      type: Number,
      min: 0,
      max: 1,
    },
    userAgent: {
      type: String,
      maxlength: 512,
      select: false,
    },

    // ── Admin tracking ────────────────────────────────────────────────────────
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    repliedBy: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    repliedAt: Date,
    internalNotes: {
      type: String,
      maxlength: 5000,
    },
  },
  {
    timestamps: true,
    collection: 'contact_leads',
  }
);

// ── Indexes (mirrors PostgreSQL indexes) ──────────────────────────────────────
ContactLeadSchema.index({ status: 1 });                                    // idx_leads_status
ContactLeadSchema.index({ createdAt: -1 });                                // idx_leads_created_at
ContactLeadSchema.index({ businessEmail: 1 });                             // idx_leads_email
ContactLeadSchema.index({ crmSyncId: 1 }, { sparse: true });               // idx_leads_crm_sync_id
ContactLeadSchema.index({ assignedTo: 1 }, { sparse: true });              // idx_leads_assigned_to
ContactLeadSchema.index({ serviceInterest: 1 }, { sparse: true });         // idx_leads_service_interest
ContactLeadSchema.index({ status: 1, createdAt: -1 });                     // compound for admin list view

// Full-text search index (replaces PostgreSQL GIN tsvector index)
ContactLeadSchema.index(
  { fullName: 'text', companyName: 'text', message: 'text' },
  { name: 'idx_leads_fts', weights: { fullName: 3, companyName: 2, message: 1 } }
);

// ── Model ─────────────────────────────────────────────────────────────────────
const ContactLead: Model<IContactLead> =
  mongoose.models.ContactLead ||
  mongoose.model<IContactLead>('ContactLead', ContactLeadSchema);

export default ContactLead;
