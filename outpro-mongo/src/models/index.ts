// src/models/index.ts
// Single import point for all Mongoose models

export { default as AdminUser } from './AdminUser';
export type { IAdminUser, AdminRole } from './AdminUser';

export { default as ContactLead } from './ContactLead';
export type { IContactLead, LeadStatus, CrmProvider } from './ContactLead';

export { default as AuditLog } from './AuditLog';
export type { IAuditLog } from './AuditLog';

export { MediaAsset, AdminSession, FormEmailLog, RateLimitLog } from './AuditLog';
export type { IMediaAsset, MediaStatus, IAdminSession, IFormEmailLog, EmailStatus, IRateLimitLog } from './AuditLog';

export { BlogCategory, BlogPost, JobOpening, JobApplication, Partner, PartnerUser } from './Phase2';
export type {
  IBlogCategory, IBlogPost,
  IJobOpening, IJobApplication, JobAppStatus, EmploymentType,
  IPartner, PartnerTier, IPartnerUser,
} from './Phase2';
