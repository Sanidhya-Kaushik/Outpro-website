-- migrations/002_performance_indexes.sql
-- Additional indexes for query patterns identified post-launch
-- Safe to run on a live database — CREATE INDEX CONCURRENTLY does not lock

-- ── Concurrent index creation (no table locks) ────────────────────────────────

-- Composite index for the most common lead list query (status + created_at DESC)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status_created
  ON contact_leads(status, created_at DESC);

-- Partial index for new leads only — used by dashboard "new leads" count
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_new
  ON contact_leads(created_at DESC)
  WHERE status = 'new';

-- Composite index for portfolio listing with published + display_order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_published_order
  ON portfolio_projects(is_published, display_order ASC, created_at DESC)
  WHERE is_published = TRUE;

-- Composite index for testimonials carousel (featured + display_order)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_testimonials_featured_order
  ON testimonials(is_featured, display_order ASC)
  WHERE is_featured = TRUE;

-- Composite for audit log actor + created_at (common admin filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_actor_created
  ON audit_log(actor_id, created_at DESC);

-- Composite for audit log action filtering with time range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_action_created
  ON audit_log(action, created_at DESC);

-- Sessions: non-revoked sessions by user (authenticate middleware hot path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active
  ON admin_sessions(admin_user_id, jwt_jti)
  WHERE revoked = FALSE;

-- Media assets by scan status + created_at (stuck scan recovery cron)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_pending_created
  ON media_assets(created_at ASC)
  WHERE scan_status = 'pending';

-- ── Vacuum and analyze after index creation ───────────────────────────────────
ANALYZE contact_leads;
ANALYZE portfolio_projects;
ANALYZE testimonials;
ANALYZE audit_log;
ANALYZE admin_sessions;
ANALYZE media_assets;
