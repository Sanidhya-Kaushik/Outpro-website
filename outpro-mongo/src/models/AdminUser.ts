// src/models/AdminUser.ts
// Replaces PostgreSQL: admin_users table
// Includes: RBAC roles, TOTP MFA, brute-force lockout, bcrypt password hash

import mongoose, { Schema, Document, Model } from 'mongoose';

// ── Enum definitions (mirrors PostgreSQL admin_role ENUM) ─────────────────────
export type AdminRole = 'super_admin' | 'editor' | 'viewer';

// ── TypeScript interface ───────────────────────────────────────────────────────
export interface IAdminUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;                   // Lowercased + trimmed (citext equivalent)
  passwordHash: string;            // bcrypt(12)
  role: AdminRole;
  fullName?: string;
  mfaSecret?: string;              // TOTP secret — encrypted at app layer
  mfaEnabled: boolean;
  failedAttempts: number;          // Consecutive failed logins; reset on success
  lockedUntil?: Date;              // Brute-force lockout timestamp
  lastLoginAt?: Date;
  lastLoginIp?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ────────────────────────────────────────────────────────────────────
const AdminUserSchema = new Schema<IAdminUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,   // citext equivalent — always stored lowercase
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      maxlength: 255,
      select: false,     // Never returned by default — must explicitly select
    },
    role: {
      type: String,
      enum: ['super_admin', 'editor', 'viewer'] as AdminRole[],
      default: 'viewer',
      required: true,
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    mfaSecret: {
      type: String,
      maxlength: 255,
      select: false,     // Sensitive — encrypted at app layer, never returned by default
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
      required: true,
    },
    failedAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      maxlength: 45,     // IPv6 max length
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,          // Adds createdAt + updatedAt automatically
    collection: 'admin_users',
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.mfaSecret;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Indexes (mirrors PostgreSQL indexes) ──────────────────────────────────────
AdminUserSchema.index({ email: 1 }, { unique: true });                // idx_admin_email
AdminUserSchema.index({ role: 1 });                                   // idx_admin_role
AdminUserSchema.index({ isActive: 1 });
AdminUserSchema.index({ lockedUntil: 1 }, { sparse: true });          // For lockout queries

// ── Model ─────────────────────────────────────────────────────────────────────
const AdminUser: Model<IAdminUser> =
  mongoose.models.AdminUser ||
  mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);

export default AdminUser;
