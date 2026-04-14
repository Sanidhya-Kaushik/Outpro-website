-- migrations/001_initial_schema.sql
-- Outpro.India — complete database schema
-- Run: psql $DATABASE_URL -f migrations/001_initial_schema.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy search on leads

-- ── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE admin_role AS ENUM ('super_admin', 'editor', 'viewer');
CREATE TYPE lead_status AS ENUM ('new', 'read', 'replied', 'converted');
CREATE TYPE scan_status AS ENUM ('pending', 'clean', 'infected', 'error');

-- ── admin_users ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  full_name       VARCHAR(150),
  role            admin_role NOT NULL DEFAULT 'viewer',
  mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret      TEXT,                         -- AES-encrypted TOTP secret
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  last_login_ip   INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);

-- ── admin_sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  jwt_jti         VARCHAR(36) NOT NULL UNIQUE,  -- UUID v4 used as JTI
  revoked         BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_sessions_jti       ON admin_sessions(jwt_jti);
CREATE INDEX idx_admin_sessions_user      ON admin_sessions(admin_user_id);
CREATE INDEX idx_admin_sessions_expires   ON admin_sessions(expires_at);

-- ── contact_leads ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contact_leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        VARCHAR(120) NOT NULL,
  business_email   VARCHAR(255) NOT NULL,
  company_name     VARCHAR(200),
  phone_number     VARCHAR(30),
  service_interest VARCHAR(100),
  budget_range     VARCHAR(80),
  message          TEXT NOT NULL,
  status           lead_status NOT NULL DEFAULT 'new',
  crm_sync_id      VARCHAR(100),
  crm_synced_at    TIMESTAMPTZ,
  ip_address       INET,                         -- Encrypted at rest via Supabase
  user_agent       TEXT,
  notes            TEXT,                         -- Internal admin notes
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_status         ON contact_leads(status);
CREATE INDEX idx_leads_created_at     ON contact_leads(created_at DESC);
CREATE INDEX idx_leads_email          ON contact_leads(business_email);
CREATE INDEX idx_leads_service        ON contact_leads(service_interest);
-- GIN index for fuzzy search on name + email + company
CREATE INDEX idx_leads_search         ON contact_leads USING gin(
  (full_name || ' ' || business_email || ' ' || COALESCE(company_name, '')) gin_trgm_ops
);

-- ── media_assets ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_assets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename         VARCHAR(500) NOT NULL,
  mime_type        VARCHAR(100) NOT NULL,
  file_size_bytes  BIGINT NOT NULL,
  storage_path     TEXT NOT NULL,               -- Supabase Storage path
  public_url       TEXT,                         -- NULL until ClamAV scan = clean
  scan_status      scan_status NOT NULL DEFAULT 'pending',
  uploaded_by_id   UUID NOT NULL REFERENCES admin_users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_scan_status    ON media_assets(scan_status);
CREATE INDEX idx_media_uploaded_by    ON media_assets(uploaded_by_id);
CREATE INDEX idx_media_created_at     ON media_assets(created_at DESC);

-- ── portfolio_projects ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portfolio_projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             VARCHAR(120) NOT NULL UNIQUE,
  title            VARCHAR(200) NOT NULL,
  client_name      VARCHAR(200) NOT NULL,
  category         VARCHAR(100) NOT NULL,
  description      TEXT,
  cover_image_id   UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  is_featured      BOOLEAN NOT NULL DEFAULT FALSE,
  is_published     BOOLEAN NOT NULL DEFAULT FALSE,
  view_count       INTEGER NOT NULL DEFAULT 0,
  project_url      TEXT,
  completed_at     TIMESTAMPTZ,
  display_order    INTEGER NOT NULL DEFAULT 0,
  tags             JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolio_slug         ON portfolio_projects(slug);
CREATE INDEX idx_portfolio_category     ON portfolio_projects(category);
CREATE INDEX idx_portfolio_featured     ON portfolio_projects(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_portfolio_published    ON portfolio_projects(is_published);
CREATE INDEX idx_portfolio_order        ON portfolio_projects(display_order ASC);

-- ── testimonials ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS testimonials (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote                 VARCHAR(1000) NOT NULL,
  author_name           VARCHAR(150) NOT NULL,
  author_title          VARCHAR(100),
  company               VARCHAR(200),
  avatar_asset_id       UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  star_rating           SMALLINT NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  video_url             TEXT,
  is_video_testimonial  BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured           BOOLEAN NOT NULL DEFAULT FALSE,
  display_order         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_testimonials_featured   ON testimonials(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_testimonials_rating     ON testimonials(star_rating DESC);
CREATE INDEX idx_testimonials_order      ON testimonials(display_order ASC);
CREATE INDEX idx_testimonials_video      ON testimonials(is_video_testimonial) WHERE is_video_testimonial = TRUE;

-- ── audit_log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID NOT NULL,                  -- admin_users.id (no FK — actor may be deleted)
  actor_email   VARCHAR(255) NOT NULL,
  action        VARCHAR(100) NOT NULL,           -- e.g. "lead.status.update"
  target_table  VARCHAR(100),
  target_id     UUID,
  payload       JSONB,                           -- { before, after } delta
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at — audit log is immutable
);

CREATE INDEX idx_audit_actor      ON audit_log(actor_id);
CREATE INDEX idx_audit_action     ON audit_log(action);
CREATE INDEX idx_audit_target     ON audit_log(target_table, target_id);
CREATE INDEX idx_audit_created    ON audit_log(created_at DESC);

-- ── Row-Level Security (Supabase) ──────────────────────────────────────────

-- Enable RLS on all tables (policies defined in Supabase dashboard)
ALTER TABLE admin_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_leads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by our API)
-- Public role has no access to any table — all reads go through API routes

-- ── updated_at triggers ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_admin_users
  BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_admin_sessions
  BEFORE UPDATE ON admin_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_contact_leads
  BEFORE UPDATE ON contact_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_media_assets
  BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_portfolio_projects
  BEFORE UPDATE ON portfolio_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_testimonials
  BEFORE UPDATE ON testimonials FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Seed: default super_admin ──────────────────────────────────────────────
-- Run bcrypt separately to get the hash; never store plaintext passwords in migrations
-- INSERT INTO admin_users (email, password_hash, full_name, role)
-- VALUES ('arjun@outpro.india', '<bcrypt_hash>', 'Arjun Mehta', 'super_admin');
