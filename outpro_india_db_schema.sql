-- ============================================================
-- OUTPRO.INDIA — Corporate Digital Presence Platform
-- PostgreSQL Database Schema (Supabase)
-- Based on: OPI-SRS-2025-001 v1.0 / Architecture v1.0
-- Prepared by: Database Architect
-- Date: April 2026
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";      -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- trigram indexes for search


-- ============================================================
-- 1. CUSTOM TYPES / ENUMS
-- ============================================================

CREATE TYPE lead_status AS ENUM (
    'new',
    'read',
    'replied',
    'converted',
    'archived'
);

CREATE TYPE admin_role AS ENUM (
    'super_admin',
    'editor',
    'viewer'
);

CREATE TYPE media_status AS ENUM (
    'pending_scan',
    'clean',
    'infected',
    'rejected'
);

CREATE TYPE crm_provider AS ENUM (
    'hubspot',
    'zoho',
    'none'
);

CREATE TYPE job_app_status AS ENUM (
    'received',
    'under_review',
    'shortlisted',
    'rejected',
    'hired'
);


-- ============================================================
-- 2. TABLE: admin_users
-- Admin accounts with MFA, brute-force protection, role-based access.
-- ============================================================

CREATE TABLE admin_users (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    email               CITEXT          NOT NULL UNIQUE,
    password_hash       VARCHAR(255)    NOT NULL,                    -- bcrypt(12)
    role                admin_role      NOT NULL DEFAULT 'viewer',
    full_name           VARCHAR(150),
    mfa_secret          VARCHAR(255),                               -- TOTP secret, encrypted at app layer
    mfa_enabled         BOOLEAN         NOT NULL DEFAULT FALSE,
    failed_attempts     SMALLINT        NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    last_login_ip       INET,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  admin_users                IS 'Platform administrators with role-based access and TOTP MFA.';
COMMENT ON COLUMN admin_users.mfa_secret     IS 'TOTP shared secret — encrypted at application layer before storage.';
COMMENT ON COLUMN admin_users.locked_until   IS 'Brute-force lockout: account rejected until this timestamp.';
COMMENT ON COLUMN admin_users.failed_attempts IS 'Consecutive failed login attempts; reset on successful login.';


-- ============================================================
-- 3. TABLE: contact_leads
-- Inbound contact form submissions (primary transactional table).
-- ============================================================

CREATE TABLE contact_leads (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name           VARCHAR(120)    NOT NULL,
    business_email      CITEXT          NOT NULL,
    company_name        VARCHAR(200),
    phone_number        VARCHAR(30),
    service_interest    VARCHAR(100),
    budget_range        VARCHAR(80),
    message             TEXT            NOT NULL,
    status              lead_status     NOT NULL DEFAULT 'new',

    -- CRM sync
    crm_provider        crm_provider    NOT NULL DEFAULT 'none',
    crm_sync_id         VARCHAR(100),                               -- HubSpot / Zoho contact ID
    crm_synced_at       TIMESTAMPTZ,
    crm_sync_error      TEXT,                                      -- Last sync error message, if any

    -- Security & audit fields
    ip_address          INET,                                      -- Encrypted at app layer before storage
    recaptcha_score     DECIMAL(3,2),                              -- Google reCAPTCHA v3 score (0.00–1.00)
    user_agent          VARCHAR(512),

    -- Admin tracking
    assigned_to         UUID            REFERENCES admin_users(id) ON DELETE SET NULL,
    replied_by          UUID            REFERENCES admin_users(id) ON DELETE SET NULL,
    replied_at          TIMESTAMPTZ,
    internal_notes      TEXT,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  contact_leads                IS 'Contact form submissions — leads from the public /contact page.';
COMMENT ON COLUMN contact_leads.ip_address     IS 'Stored encrypted at application layer; raw IP never persisted in plaintext.';
COMMENT ON COLUMN contact_leads.recaptcha_score IS 'reCAPTCHA v3 risk score. Threshold ≥ 0.5 required for submission acceptance.';
COMMENT ON COLUMN contact_leads.crm_sync_id    IS 'External CRM contact/deal ID after successful push.';


-- ============================================================
-- 4. TABLE: audit_log
-- Append-only audit trail for all admin actions.
-- ============================================================

CREATE TABLE audit_log (
    id              BIGSERIAL       PRIMARY KEY,
    actor_id        UUID            REFERENCES admin_users(id) ON DELETE SET NULL,
    actor_email     CITEXT          NOT NULL,                      -- Denormalised: preserves identity after user deletion
    action          VARCHAR(100)    NOT NULL,                      -- e.g. 'lead.status.update', 'admin.login'
    target_table    VARCHAR(60),
    target_id       UUID,
    payload         JSONB,                                         -- Before/after delta snapshot
    ip_address      INET,
    user_agent      VARCHAR(512),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  audit_log             IS 'Immutable audit trail. Rows are never UPDATE-d or DELETE-d.';
COMMENT ON COLUMN audit_log.actor_email IS 'Denormalised email snapshot — preserves audit identity if admin account is later deleted.';
COMMENT ON COLUMN audit_log.payload     IS 'JSONB delta: {before: {...}, after: {...}} for mutations; metadata for auth events.';


-- ============================================================
-- 5. TABLE: media_assets
-- File uploads managed via Supabase Storage with virus scan tracking.
-- ============================================================

CREATE TABLE media_assets (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by         UUID            REFERENCES admin_users(id) ON DELETE SET NULL,
    original_filename   VARCHAR(255)    NOT NULL,
    storage_bucket      VARCHAR(100)    NOT NULL,                  -- 'private' before scan, 'public' after
    storage_path        VARCHAR(512)    NOT NULL UNIQUE,           -- Supabase Storage object path
    public_url          VARCHAR(1024),                             -- Null until virus scan passes
    mime_type           VARCHAR(100)    NOT NULL,
    file_size_bytes     BIGINT          NOT NULL,
    scan_status         media_status    NOT NULL DEFAULT 'pending_scan',
    scan_completed_at   TIMESTAMPTZ,
    scan_result_detail  TEXT,
    alt_text            VARCHAR(255),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  media_assets               IS 'Tracks uploaded media files through Supabase Storage and virus scan pipeline.';
COMMENT ON COLUMN media_assets.public_url    IS 'CDN-accessible URL — populated only after scan_status = clean.';
COMMENT ON COLUMN media_assets.storage_path  IS 'Internal Supabase Storage path; not exposed directly to clients.';


-- ============================================================
-- 6. TABLE: admin_sessions
-- Optional: explicit session tracking for forced-logout / audit.
-- ============================================================

CREATE TABLE admin_sessions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID            NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    jwt_jti         VARCHAR(128)    NOT NULL UNIQUE,               -- JWT ID claim for revocation
    ip_address      INET,
    user_agent      VARCHAR(512),
    expires_at      TIMESTAMPTZ     NOT NULL,
    revoked         BOOLEAN         NOT NULL DEFAULT FALSE,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  admin_sessions          IS 'Tracks issued JWTs for explicit revocation (forced logout, suspicious activity).';
COMMENT ON COLUMN admin_sessions.jwt_jti  IS 'JWT jti claim — checked on each request to detect revoked tokens.';


-- ============================================================
-- 7. TABLE: form_email_log
-- Tracks outbound transactional emails sent via Resend.
-- ============================================================

CREATE TABLE form_email_log (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID            NOT NULL REFERENCES contact_leads(id) ON DELETE CASCADE,
    recipient_email CITEXT          NOT NULL,
    template_name   VARCHAR(100)    NOT NULL,                      -- e.g. 'admin_notification', 'auto_reply'
    resend_message_id VARCHAR(128),                                -- Resend API message ID
    status          VARCHAR(30)     NOT NULL DEFAULT 'queued',     -- queued | sent | failed | bounced
    error_message   TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE form_email_log IS 'Audit log for all transactional emails dispatched by /api/contact.';


-- ============================================================
-- 8. TABLE: rate_limit_log  (Optional — if not using Upstash Redis)
-- Tracks API rate-limit hits for analysis.
-- ============================================================

CREATE TABLE rate_limit_log (
    id              BIGSERIAL       PRIMARY KEY,
    ip_address      INET            NOT NULL,
    endpoint        VARCHAR(120)    NOT NULL,
    hit_count       SMALLINT        NOT NULL DEFAULT 1,
    window_start    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    window_end      TIMESTAMPTZ     NOT NULL,
    blocked         BOOLEAN         NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE rate_limit_log IS 'Persistent rate-limit analytics. Primary enforcement is Upstash Redis; this table is for post-hoc analysis.';


-- ============================================================
-- PHASE 2 TABLES (Blog & Careers Modules)
-- Uncomment and migrate when Phase 2 development begins.
-- ============================================================

-- ============================================================
-- 9. TABLE: blog_categories  [Phase 2]
-- ============================================================

CREATE TABLE blog_categories (
    id          SERIAL          PRIMARY KEY,
    name        VARCHAR(100)    NOT NULL UNIQUE,
    slug        VARCHAR(110)    NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE blog_categories IS '[Phase 2] Blog post categories. Mirrors Sanity CMS category content type.';


-- ============================================================
-- 10. TABLE: blog_posts  [Phase 2]
-- Mirrors Sanity CMS blogPost content type for search/RSS.
-- ============================================================

CREATE TABLE blog_posts (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    sanity_id       VARCHAR(100)    NOT NULL UNIQUE,               -- Sanity document _id
    title           VARCHAR(300)    NOT NULL,
    slug            VARCHAR(320)    NOT NULL UNIQUE,
    author_name     VARCHAR(150),
    excerpt         TEXT,
    published_at    TIMESTAMPTZ,
    is_published    BOOLEAN         NOT NULL DEFAULT FALSE,
    view_count      INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  blog_posts           IS '[Phase 2] Lightweight mirror of Sanity blog posts for search indexing and analytics.';
COMMENT ON COLUMN blog_posts.sanity_id IS 'Sanity document _id — used to correlate DB record with CMS source of truth.';


-- ============================================================
-- 11. TABLE: blog_post_categories  [Phase 2]
-- Many-to-many join for blog posts ↔ categories.
-- ============================================================

CREATE TABLE blog_post_categories (
    post_id         UUID    NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    category_id     INT     NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, category_id)
);


-- ============================================================
-- 12. TABLE: job_openings  [Phase 2]
-- Career listings (Sanity-managed content, DB for applications).
-- ============================================================

CREATE TABLE job_openings (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    sanity_id       VARCHAR(100)    NOT NULL UNIQUE,
    title           VARCHAR(200)    NOT NULL,
    slug            VARCHAR(220)    NOT NULL UNIQUE,
    department      VARCHAR(100),
    location        VARCHAR(100),
    employment_type VARCHAR(60),                                   -- 'full-time' | 'contract' | 'internship'
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    closes_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE job_openings IS '[Phase 2] Career listings. Content managed in Sanity; DB row exists for application linking.';


-- ============================================================
-- 13. TABLE: job_applications  [Phase 2]
-- Inbound job applications linked to job openings.
-- ============================================================

CREATE TABLE job_applications (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              UUID            NOT NULL REFERENCES job_openings(id) ON DELETE RESTRICT,
    full_name           VARCHAR(150)    NOT NULL,
    email               CITEXT          NOT NULL,
    phone_number        VARCHAR(30),
    linkedin_url        VARCHAR(512),
    portfolio_url       VARCHAR(512),
    cover_letter        TEXT,
    resume_asset_id     UUID            REFERENCES media_assets(id) ON DELETE SET NULL,
    status              job_app_status  NOT NULL DEFAULT 'received',
    recaptcha_score     DECIMAL(3,2),
    ip_address          INET,
    reviewed_by         UUID            REFERENCES admin_users(id) ON DELETE SET NULL,
    internal_notes      TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE job_applications IS '[Phase 2] Candidate applications for active job openings.';


-- ============================================================
-- PHASE 3 TABLES (Partner Portal Module)
-- ============================================================

-- ============================================================
-- 14. TABLE: partners  [Phase 3]
-- ============================================================

CREATE TABLE partners (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name    VARCHAR(200)    NOT NULL,
    contact_email   CITEXT          NOT NULL UNIQUE,
    tier            VARCHAR(50)     NOT NULL DEFAULT 'standard',   -- 'standard' | 'silver' | 'gold'
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    joined_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE partners IS '[Phase 3] Registered partner organisations in the Partner Portal.';


-- ============================================================
-- 15. TABLE: partner_users  [Phase 3]
-- Portal users belonging to a partner organisation.
-- ============================================================

CREATE TABLE partner_users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id      UUID            NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    email           CITEXT          NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    full_name       VARCHAR(150),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE partner_users IS '[Phase 3] Login accounts for partner portal users.';


-- ============================================================
-- TRIGGERS — auto-update updated_at timestamps
-- ============================================================

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'admin_users', 'contact_leads', 'media_assets',
        'blog_posts', 'job_openings', 'job_applications', 'partners'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER set_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()',
            tbl
        );
    END LOOP;
END
$$;


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE contact_leads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_email_log   ENABLE ROW LEVEL SECURITY;

-- Public: allow anonymous INSERT on contact_leads only
CREATE POLICY public_insert_leads
    ON contact_leads FOR INSERT
    TO anon
    WITH CHECK (true);

-- Authenticated admins: full access to all tables
CREATE POLICY admin_full_access_leads
    ON contact_leads FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY admin_full_access_users
    ON admin_users FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY admin_full_access_audit
    ON audit_log FOR SELECT
    TO authenticated
    USING (true);

-- Audit log: INSERT only via service role; no UPDATE or DELETE ever
CREATE POLICY service_insert_audit
    ON audit_log FOR INSERT
    TO service_role
    WITH CHECK (true);


-- ============================================================
-- INDEXES — PERFORMANCE & SEARCH
-- ============================================================

-- contact_leads
CREATE INDEX idx_leads_status           ON contact_leads (status);
CREATE INDEX idx_leads_created_at       ON contact_leads (created_at DESC);
CREATE INDEX idx_leads_email            ON contact_leads (business_email);
CREATE INDEX idx_leads_crm_sync_id      ON contact_leads (crm_sync_id) WHERE crm_sync_id IS NOT NULL;
CREATE INDEX idx_leads_assigned_to      ON contact_leads (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_leads_service_interest ON contact_leads (service_interest) WHERE service_interest IS NOT NULL;

-- Full-text search on leads
CREATE INDEX idx_leads_fts ON contact_leads
    USING GIN (to_tsvector('english', coalesce(full_name,'') || ' ' || coalesce(company_name,'') || ' ' || coalesce(message,'')));

-- admin_users
CREATE UNIQUE INDEX idx_admin_email     ON admin_users (email);
CREATE INDEX idx_admin_role             ON admin_users (role);

-- audit_log
CREATE INDEX idx_audit_actor_id         ON audit_log (actor_id);
CREATE INDEX idx_audit_target           ON audit_log (target_table, target_id);
CREATE INDEX idx_audit_created_at       ON audit_log (created_at DESC);
CREATE INDEX idx_audit_action           ON audit_log (action);

-- media_assets
CREATE INDEX idx_media_scan_status      ON media_assets (scan_status);
CREATE INDEX idx_media_uploaded_by      ON media_assets (uploaded_by);

-- admin_sessions
CREATE INDEX idx_sessions_admin_id      ON admin_sessions (admin_id);
CREATE INDEX idx_sessions_jti           ON admin_sessions (jwt_jti);
CREATE INDEX idx_sessions_expires_at    ON admin_sessions (expires_at);

-- Phase 2: blog
CREATE INDEX idx_blog_slug              ON blog_posts (slug);
CREATE INDEX idx_blog_published_at      ON blog_posts (published_at DESC) WHERE is_published = TRUE;
CREATE INDEX idx_blog_fts               ON blog_posts
    USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(excerpt,'')));

-- Phase 2: jobs
CREATE INDEX idx_jobs_is_active         ON job_openings (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_job_apps_job_id        ON job_applications (job_id);
CREATE INDEX idx_job_apps_status        ON job_applications (status);
CREATE INDEX idx_job_apps_email         ON job_applications (email);

-- rate_limit_log
CREATE INDEX idx_rate_ip_endpoint       ON rate_limit_log (ip_address, endpoint, window_start);


-- ============================================================
-- SAMPLE DATA
-- ============================================================

-- 1. Admin Users
INSERT INTO admin_users (id, email, password_hash, role, full_name, mfa_enabled, is_active)
VALUES
    ('a1000000-0000-0000-0000-000000000001',
     'arjun@outpro.india',
     '$2b$12$ExampleHashForArjunSuperAdmin00001',
     'super_admin', 'Arjun Mehta', TRUE, TRUE),

    ('a1000000-0000-0000-0000-000000000002',
     'priya@outpro.india',
     '$2b$12$ExampleHashForPriyaEditor000001',
     'editor', 'Priya Sharma', TRUE, TRUE),

    ('a1000000-0000-0000-0000-000000000003',
     'rahul@outpro.india',
     '$2b$12$ExampleHashForRahulViewer00001',
     'viewer', 'Rahul Verma', FALSE, TRUE);


-- 2. Contact Leads
INSERT INTO contact_leads (
    id, full_name, business_email, company_name, phone_number,
    service_interest, budget_range, message, status,
    crm_provider, crm_sync_id, crm_synced_at,
    recaptcha_score, assigned_to, created_at
)
VALUES
    ('b2000000-0000-0000-0000-000000000001',
     'Neha Kapoor', 'neha.kapoor@techstart.in', 'TechStart Pvt Ltd', '+91-9876543210',
     'Website Development', '₹2L – ₹5L',
     'We need a modern corporate website with CMS integration and SEO optimisation for our B2B SaaS product.',
     'new', 'hubspot', 'HS-CONTACT-00112', now() - INTERVAL '2 days',
     0.92, 'a1000000-0000-0000-0000-000000000002',
     now() - INTERVAL '2 days'),

    ('b2000000-0000-0000-0000-000000000002',
     'Sameer Khan', 'sameer@brandhouse.co.in', 'BrandHouse Agency', '+91-9123456789',
     'Digital Marketing', '₹50K – ₹1L',
     'Looking for SEO + Google Ads management for our e-commerce clients. Monthly retainer preferred.',
     'read', 'hubspot', 'HS-CONTACT-00113', now() - INTERVAL '1 day',
     0.88, 'a1000000-0000-0000-0000-000000000002',
     now() - INTERVAL '1 day'),

    ('b2000000-0000-0000-0000-000000000003',
     'Anita Desai', 'anita.desai@globalexports.com', 'Global Exports Ltd', NULL,
     'UI/UX Design', '₹1L – ₹2L',
     'Our current platform UI is outdated. We want a full redesign of our supplier portal.',
     'replied', 'zoho', 'ZOHO-LEAD-78934', now() - INTERVAL '5 days',
     0.79, 'a1000000-0000-0000-0000-000000000001',
     now() - INTERVAL '5 days'),

    ('b2000000-0000-0000-0000-000000000004',
     'Vikram Rao', 'vikram@startupnest.io', 'StartupNest', '+91-9000012345',
     'Mobile App Development', '₹5L – ₹10L',
     'We are building a fintech app for micro-lending. Need cross-platform iOS + Android development.',
     'converted', 'hubspot', 'HS-CONTACT-00089', now() - INTERVAL '14 days',
     0.95, 'a1000000-0000-0000-0000-000000000001',
     now() - INTERVAL '14 days'),

    ('b2000000-0000-0000-0000-000000000005',
     'Pooja Iyer', 'pooja.iyer@freshideas.in', NULL, NULL,
     NULL, NULL,
     'Just exploring your services. Can someone reach out to discuss options?',
     'new', 'none', NULL, NULL,
     0.55, NULL,
     now() - INTERVAL '3 hours');


-- 3. Audit Log
INSERT INTO audit_log (actor_id, actor_email, action, target_table, target_id, payload, created_at)
VALUES
    ('a1000000-0000-0000-0000-000000000002',
     'priya@outpro.india',
     'lead.status.update',
     'contact_leads',
     'b2000000-0000-0000-0000-000000000002',
     '{"before": {"status": "new"}, "after": {"status": "read"}}',
     now() - INTERVAL '23 hours'),

    ('a1000000-0000-0000-0000-000000000001',
     'arjun@outpro.india',
     'lead.assign',
     'contact_leads',
     'b2000000-0000-0000-0000-000000000003',
     '{"before": {"assigned_to": null}, "after": {"assigned_to": "a1000000-0000-0000-0000-000000000001"}}',
     now() - INTERVAL '5 days'),

    ('a1000000-0000-0000-0000-000000000001',
     'arjun@outpro.india',
     'admin.login',
     NULL, NULL,
     '{"ip": "103.45.67.89", "mfa_method": "totp"}',
     now() - INTERVAL '1 hour'),

    ('a1000000-0000-0000-0000-000000000002',
     'priya@outpro.india',
     'lead.status.update',
     'contact_leads',
     'b2000000-0000-0000-0000-000000000003',
     '{"before": {"status": "read"}, "after": {"status": "replied"}}',
     now() - INTERVAL '4 days');


-- 4. Media Assets
INSERT INTO media_assets (
    id, uploaded_by, original_filename, storage_bucket, storage_path,
    public_url, mime_type, file_size_bytes, scan_status, alt_text
)
VALUES
    ('c3000000-0000-0000-0000-000000000001',
     'a1000000-0000-0000-0000-000000000002',
     'hero-banner-v3.webp', 'public',
     'media/2026/04/hero-banner-v3.webp',
     'https://cdn.outpro.india/media/2026/04/hero-banner-v3.webp',
     'image/webp', 245760, 'clean',
     'Outpro India hero banner — team collaborating on digital strategy'),

    ('c3000000-0000-0000-0000-000000000002',
     'a1000000-0000-0000-0000-000000000001',
     'case-study-globalexports.pdf', 'public',
     'media/2026/04/case-study-globalexports.pdf',
     'https://cdn.outpro.india/media/2026/04/case-study-globalexports.pdf',
     'application/pdf', 1048576, 'clean',
     NULL),

    ('c3000000-0000-0000-0000-000000000003',
     'a1000000-0000-0000-0000-000000000002',
     'team-photo-2026.jpg', 'private',
     'uploads/pending/team-photo-2026.jpg',
     NULL,
     'image/jpeg', 3145728, 'pending_scan',
     'Outpro India team photo 2026');


-- 5. Form Email Log
INSERT INTO form_email_log (lead_id, recipient_email, template_name, resend_message_id, status, sent_at)
VALUES
    ('b2000000-0000-0000-0000-000000000001',
     'arjun@outpro.india',
     'admin_notification',
     'resend_msg_abc123001', 'sent',
     now() - INTERVAL '2 days'),

    ('b2000000-0000-0000-0000-000000000001',
     'neha.kapoor@techstart.in',
     'auto_reply',
     'resend_msg_abc123002', 'sent',
     now() - INTERVAL '2 days'),

    ('b2000000-0000-0000-0000-000000000005',
     'arjun@outpro.india',
     'admin_notification',
     'resend_msg_abc123010', 'sent',
     now() - INTERVAL '3 hours');


-- Phase 2 sample data
-- 6. Blog Categories
INSERT INTO blog_categories (name, slug, description)
VALUES
    ('Web Development',  'web-development',  'Articles on modern web technologies and best practices.'),
    ('Digital Marketing','digital-marketing','SEO, PPC, social media, and content strategy insights.'),
    ('UI/UX Design',     'ui-ux-design',     'Design thinking, user research, and interface trends.'),
    ('Case Studies',     'case-studies',     'Deep-dives into our client projects and outcomes.');


-- 7. Blog Posts (Phase 2)
INSERT INTO blog_posts (id, sanity_id, title, slug, author_name, excerpt, published_at, is_published)
VALUES
    ('d4000000-0000-0000-0000-000000000001',
     'sanity-blog-001',
     'Why Next.js 14 Is the Right Choice for Corporate Websites in 2026',
     'nextjs-14-corporate-websites-2026',
     'Arjun Mehta',
     'We explore how Next.js App Router, ISR, and Edge Functions address the performance and scalability needs of modern corporate platforms.',
     now() - INTERVAL '7 days', TRUE),

    ('d4000000-0000-0000-0000-000000000002',
     'sanity-blog-002',
     'Headless CMS vs Traditional CMS: A Practical Guide for 2026',
     'headless-cms-vs-traditional-2026',
     'Priya Sharma',
     'Comparing Sanity.io, Contentful, and WordPress for editorial teams who need speed without developer dependency.',
     now() - INTERVAL '3 days', TRUE);


-- Blog post → category joins
INSERT INTO blog_post_categories (post_id, category_id)
VALUES
    ('d4000000-0000-0000-0000-000000000001', 1),
    ('d4000000-0000-0000-0000-000000000002', 1),
    ('d4000000-0000-0000-0000-000000000002', 3);


-- ============================================================
-- ENTITY RELATIONSHIP SUMMARY (as SQL comments)
-- ============================================================
--
-- admin_users (1) ──< audit_log          (actor_id → FK)
-- admin_users (1) ──< admin_sessions     (admin_id → FK)
-- admin_users (1) ──< contact_leads      (assigned_to, replied_by → FK)
-- admin_users (1) ──< media_assets       (uploaded_by → FK)
-- admin_users (1) ──< job_applications   (reviewed_by → FK)
-- contact_leads (1) ──< form_email_log   (lead_id → FK)
-- media_assets (1) ──< job_applications  (resume_asset_id → FK)
-- job_openings (1) ──< job_applications  (job_id → FK)
-- blog_posts (M) ──< blog_post_categories >── (M) blog_categories
-- partners (1) ──< partner_users         (partner_id → FK)
--
-- ============================================================
-- END OF SCHEMA
-- ============================================================
