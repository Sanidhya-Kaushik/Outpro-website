// src/models/AuditLog.ts
// Replaces PostgreSQL: audit_log table
// IMMUTABLE — documents are only inserted, never updated or deleted

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId;  // ref: AdminUser (null if user deleted)
  actorEmail: string;                 // Denormalised — preserves identity after deletion
  action: string;                     // e.g. 'lead.status.update', 'admin.login'
  targetCollection?: string;          // e.g. 'contact_leads', 'admin_users'
  targetId?: mongoose.Types.ObjectId;
  payload?: Record<string, unknown>;  // Before/after delta: { before: {}, after: {} }
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    actorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      maxlength: 100,
      index: true,     // idx_audit_action
    },
    targetCollection: {
      type: String,
      maxlength: 60,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    payload: {
      type: Schema.Types.Mixed,   // Flexible JSONB equivalent
      default: null,
    },
    ipAddress: {
      type: String,
      maxlength: 45,
      select: false,
    },
    userAgent: {
      type: String,
      maxlength: 512,
      select: false,
    },
  },
  {
    // updatedAt intentionally omitted — audit log is append-only
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'audit_log',
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
AuditLogSchema.index({ actorId: 1 });                                      // idx_audit_actor_id
AuditLogSchema.index({ targetCollection: 1, targetId: 1 });                // idx_audit_target
AuditLogSchema.index({ createdAt: -1 });                                   // idx_audit_created_at
AuditLogSchema.index({ action: 1 });                                       // idx_audit_action

// Enforce immutability — block updates and deletes at the model layer
AuditLogSchema.pre('updateOne', function () { throw new Error('AuditLog is immutable.'); });
AuditLogSchema.pre('findOneAndUpdate', function () { throw new Error('AuditLog is immutable.'); });
AuditLogSchema.pre('deleteOne', function () { throw new Error('AuditLog is immutable.'); });
AuditLogSchema.pre('findOneAndDelete', function () { throw new Error('AuditLog is immutable.'); });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;


// ─────────────────────────────────────────────────────────────────────────────
// src/models/MediaAsset.ts
// Replaces PostgreSQL: media_assets table
// Tracks file uploads through storage + virus scan pipeline
// ─────────────────────────────────────────────────────────────────────────────

export type MediaStatus = 'pending_scan' | 'clean' | 'infected' | 'rejected';

export interface IMediaAsset extends Document {
  _id: mongoose.Types.ObjectId;
  uploadedBy?: mongoose.Types.ObjectId;  // ref: AdminUser
  originalFilename: string;
  storageBucket: string;                 // 'private' before scan, 'public' after
  storagePath: string;                   // Unique storage object path
  publicUrl?: string;                    // Null until virus scan passes
  mimeType: string;
  fileSizeBytes: number;
  scanStatus: MediaStatus;
  scanCompletedAt?: Date;
  scanResultDetail?: string;
  altText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MediaAssetSchema = new Schema<IMediaAsset>(
  {
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storageBucket: {
      type: String,
      required: true,
      maxlength: 100,
      enum: ['public', 'private'],
    },
    storagePath: {
      type: String,
      required: true,
      unique: true,
      maxlength: 512,
    },
    publicUrl: {
      type: String,
      maxlength: 1024,
      default: null,
    },
    mimeType: {
      type: String,
      required: true,
      maxlength: 100,
    },
    fileSizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },
    scanStatus: {
      type: String,
      enum: ['pending_scan', 'clean', 'infected', 'rejected'] as MediaStatus[],
      default: 'pending_scan',
      required: true,
    },
    scanCompletedAt: Date,
    scanResultDetail: String,
    altText: {
      type: String,
      maxlength: 255,
    },
  },
  {
    timestamps: true,
    collection: 'media_assets',
  }
);

MediaAssetSchema.index({ scanStatus: 1 });       // idx_media_scan_status
MediaAssetSchema.index({ uploadedBy: 1 });        // idx_media_uploaded_by
MediaAssetSchema.index({ storagePath: 1 }, { unique: true });

const MediaAsset: Model<IMediaAsset> =
  mongoose.models.MediaAsset ||
  mongoose.model<IMediaAsset>('MediaAsset', MediaAssetSchema);

export { MediaAsset };


// ─────────────────────────────────────────────────────────────────────────────
// src/models/AdminSession.ts
// Replaces PostgreSQL: admin_sessions table
// Tracks issued JWTs for revocation (forced logout, suspicious activity)
// ─────────────────────────────────────────────────────────────────────────────

export interface IAdminSession extends Document {
  _id: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;  // ref: AdminUser
  jwtJti: string;                    // JWT jti claim — checked on each request
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  revoked: boolean;
  revokedAt?: Date;
  createdAt: Date;
}

const AdminSessionSchema = new Schema<IAdminSession>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },
    jwtJti: {
      type: String,
      required: true,
      unique: true,
      maxlength: 128,
    },
    ipAddress: {
      type: String,
      maxlength: 45,
      select: false,
    },
    userAgent: {
      type: String,
      maxlength: 512,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'admin_sessions',
  }
);

AdminSessionSchema.index({ adminId: 1 });                                  // idx_sessions_admin_id
AdminSessionSchema.index({ jwtJti: 1 }, { unique: true });                 // idx_sessions_jti
AdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });     // TTL index — auto-delete expired sessions

const AdminSession: Model<IAdminSession> =
  mongoose.models.AdminSession ||
  mongoose.model<IAdminSession>('AdminSession', AdminSessionSchema);

export { AdminSession };


// ─────────────────────────────────────────────────────────────────────────────
// src/models/FormEmailLog.ts
// Replaces PostgreSQL: form_email_log table
// Tracks outbound transactional emails via Resend
// ─────────────────────────────────────────────────────────────────────────────

export type EmailStatus = 'queued' | 'sent' | 'failed' | 'bounced';

export interface IFormEmailLog extends Document {
  _id: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;    // ref: ContactLead
  recipientEmail: string;
  templateName: string;               // e.g. 'admin_notification', 'auto_reply'
  resendMessageId?: string;           // Resend API message ID
  status: EmailStatus;
  errorMessage?: string;
  sentAt?: Date;
  createdAt: Date;
}

const FormEmailLogSchema = new Schema<IFormEmailLog>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'ContactLead',
      required: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    templateName: {
      type: String,
      required: true,
      maxlength: 100,
      enum: ['admin_notification', 'auto_reply', 'follow_up', 'converted_notification'],
    },
    resendMessageId: {
      type: String,
      maxlength: 128,
      sparse: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'bounced'] as EmailStatus[],
      default: 'queued',
    },
    errorMessage: String,
    sentAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'form_email_log',
  }
);

FormEmailLogSchema.index({ leadId: 1 });
FormEmailLogSchema.index({ status: 1 });
FormEmailLogSchema.index({ createdAt: -1 });

const FormEmailLog: Model<IFormEmailLog> =
  mongoose.models.FormEmailLog ||
  mongoose.model<IFormEmailLog>('FormEmailLog', FormEmailLogSchema);

export { FormEmailLog };


// ─────────────────────────────────────────────────────────────────────────────
// src/models/RateLimitLog.ts
// Replaces PostgreSQL: rate_limit_log table
// Optional — used when not using Upstash Redis for rate limiting
// ─────────────────────────────────────────────────────────────────────────────

export interface IRateLimitLog extends Document {
  _id: mongoose.Types.ObjectId;
  ipAddress: string;
  endpoint: string;
  hitCount: number;
  windowStart: Date;
  windowEnd: Date;
  blocked: boolean;
}

const RateLimitLogSchema = new Schema<IRateLimitLog>(
  {
    ipAddress: {
      type: String,
      required: true,
      maxlength: 45,
    },
    endpoint: {
      type: String,
      required: true,
      maxlength: 120,
    },
    hitCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    windowStart: {
      type: Date,
      default: Date.now,
    },
    windowEnd: {
      type: Date,
      required: true,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: false,
    collection: 'rate_limit_log',
  }
);

RateLimitLogSchema.index({ ipAddress: 1, endpoint: 1, windowStart: 1 }); // idx_rate_ip_endpoint
RateLimitLogSchema.index({ windowEnd: 1 }, { expireAfterSeconds: 86400 }); // TTL: auto-delete after 24h

const RateLimitLog: Model<IRateLimitLog> =
  mongoose.models.RateLimitLog ||
  mongoose.model<IRateLimitLog>('RateLimitLog', RateLimitLogSchema);

export { RateLimitLog };
