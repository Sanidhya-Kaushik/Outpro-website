-- migrations/003_seed_development.sql
-- Development seed data — DO NOT run in production.
-- Creates a default super_admin and representative sample records.
--
-- Default credentials (change on first login):
--   Email:    arjun@outpro.india
--   Password: Outpro@Dev2026!
--
-- To generate your own bcrypt hash:
--   node -e "require('bcrypt').hash('YourPassword!',12).then(console.log)"

-- ── Guard: only run in development ───────────────────────────────────────────

DO $$
BEGIN
  IF current_setting('app.env', true) = 'production' THEN
    RAISE EXCEPTION 'Refusing to run seed migration in production environment.';
  END IF;
END $$;

-- ── Admin users ───────────────────────────────────────────────────────────────

INSERT INTO admin_users (id, email, password_hash, full_name, role, mfa_enabled, is_active)
VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'arjun@outpro.india',
    -- bcrypt hash of "Outpro@Dev2026!" with rounds=12
    '$2b$12$LqBDEbGpjdl0VmYGHNMiEuRLjR8mS2OKmXyf5KZRP5mNMX8vP3wuO',
    'Arjun Mehta',
    'super_admin',
    false,
    true
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'priya@outpro.india',
    '$2b$12$LqBDEbGpjdl0VmYGHNMiEuRLjR8mS2OKmXyf5KZRP5mNMX8vP3wuO',
    'Priya Singh',
    'editor',
    false,
    true
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'rajan@outpro.india',
    '$2b$12$LqBDEbGpjdl0VmYGHNMiEuRLjR8mS2OKmXyf5KZRP5mNMX8vP3wuO',
    'Rajan Desai',
    'viewer',
    false,
    true
  )
ON CONFLICT (email) DO NOTHING;

-- ── Portfolio projects ────────────────────────────────────────────────────────

INSERT INTO portfolio_projects
  (id, slug, title, client_name, category, description, is_featured, is_published, view_count, display_order, tags)
VALUES
  (
    'b2000000-0000-0000-0000-000000000001',
    'brandhouse-agency-rebrand',
    'BrandHouse Agency Full Rebrand',
    'BrandHouse Ltd',
    'Branding',
    'A complete identity overhaul for one of Delhi''s leading creative agencies — new logo, colour system, and web presence.',
    true, true, 1240, 1,
    '["branding","logo","figma","next.js"]'
  ),
  (
    'b2000000-0000-0000-0000-000000000002',
    'financeOS-dashboard',
    'FinanceOS Analytics Dashboard',
    'FinanceOS Pvt Ltd',
    'Web Development',
    'Real-time financial analytics dashboard built with React, D3.js, and WebSockets. Handles 50k+ daily active users.',
    true, true, 3840, 2,
    '["react","d3.js","websockets","postgresql"]'
  ),
  (
    'b2000000-0000-0000-0000-000000000003',
    'logitrack-mobile-app',
    'LogiTrack Logistics Mobile App',
    'LogiTrack India',
    'Mobile',
    'Cross-platform React Native app for real-time shipment tracking, driver dispatch, and route optimisation.',
    true, true, 987, 3,
    '["react-native","ios","android","maps-api"]'
  ),
  (
    'b2000000-0000-0000-0000-000000000004',
    'retailplus-seo-growth',
    'RetailPlus Organic Growth Campaign',
    'RetailPlus Ecommerce',
    'SEO',
    'Technical SEO audit and 6-month content strategy that delivered +180% organic traffic and 60% revenue growth.',
    false, true, 562, 4,
    '["seo","content-strategy","technical-seo"]'
  )
ON CONFLICT (slug) DO NOTHING;

-- ── Testimonials ──────────────────────────────────────────────────────────────

INSERT INTO testimonials
  (id, quote, author_name, author_title, company, star_rating, is_featured, is_video_testimonial, display_order)
VALUES
  (
    'f6000000-0000-0000-0000-000000000001',
    'Outpro completely transformed our digital presence. Within three months of launching our new site, organic traffic doubled and our lead quality improved dramatically. The team delivered everything on time and budget.',
    'Neha Kapoor',
    'CEO',
    'TechStart Pvt Ltd',
    5, true, false, 1
  ),
  (
    'f6000000-0000-0000-0000-000000000002',
    'The best agency we have worked with in ten years of business. They genuinely understood our goals and built something that will scale with us. Our sales team loves the new CRM integrations.',
    'Rohan Verma',
    'CTO',
    'BuildSmart Technologies',
    5, true, false, 2
  ),
  (
    'f6000000-0000-0000-0000-000000000003',
    'Incredible UI/UX work. Our patient satisfaction scores for the portal went from 3.2 to 4.7 out of 5 in six months. Outpro really put in the time to understand our users.',
    'Dr Anita Sharma',
    'Head of Product',
    'MedPortal Health',
    5, true, false, 3
  ),
  (
    'f6000000-0000-0000-0000-000000000004',
    'The SEO results speak for themselves — 180% traffic increase in four months. But beyond the numbers, their communication and reporting were exceptional. We always knew exactly where we stood.',
    'Vikram Rao',
    'Marketing Director',
    'RetailPlus India',
    5, true, false, 4
  ),
  (
    'f6000000-0000-0000-0000-000000000005',
    'Professional, creative, and technically excellent. Our React Native app launched on time with zero critical bugs. The post-launch support has been outstanding.',
    'Kiran Mehta',
    'Founder',
    'LogiTrack India',
    4, false, false, 5
  )
ON CONFLICT DO NOTHING;

-- ── Sample leads ──────────────────────────────────────────────────────────────

INSERT INTO contact_leads
  (id, full_name, business_email, company_name, service_interest, message, status)
VALUES
  (
    'c3000000-0000-0000-0000-000000000001',
    'Pooja Iyer',
    'pooja@techventures.in',
    'TechVentures India',
    'Website Development',
    'We are a Series A startup looking to redesign our marketing site. We need a fast, CMS-driven solution that our non-technical team can update.',
    'new'
  ),
  (
    'c3000000-0000-0000-0000-000000000002',
    'Rahul Gupta',
    'rahul@startupx.co',
    'StartupX',
    'Digital Marketing',
    'We just raised seed funding and need to build our digital marketing presence from scratch. Looking for Google Ads, Meta, and SEO support.',
    'replied'
  ),
  (
    'c3000000-0000-0000-0000-000000000003',
    'Sneha Bose',
    'sneha@medportal.in',
    'MedPortal Health',
    'UI/UX Design',
    'We need a complete UX audit of our patient portal and a redesign based on the findings. Accessibility compliance (WCAG 2.1 AA) is mandatory.',
    'converted'
  )
ON CONFLICT DO NOTHING;

-- ── Audit log seed entries ────────────────────────────────────────────────────

INSERT INTO audit_log (actor_id, actor_email, action, target_table, target_id)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'arjun@outpro.india', 'admin.login', NULL, NULL),
  ('a1000000-0000-0000-0000-000000000001', 'arjun@outpro.india', 'lead.status.update', 'contact_leads', 'c3000000-0000-0000-0000-000000000003'),
  ('a1000000-0000-0000-0000-000000000002', 'priya@outpro.india', 'portfolio.create', 'portfolio_projects', 'b2000000-0000-0000-0000-000000000004'),
  ('a1000000-0000-0000-0000-000000000002', 'priya@outpro.india', 'testimonial.update', 'testimonials', 'f6000000-0000-0000-0000-000000000005');
