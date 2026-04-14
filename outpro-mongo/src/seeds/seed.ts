// src/seeds/seed.ts
// Seeds MongoDB with development data mirroring the PostgreSQL sample data
// Run: npx ts-node src/seeds/seed.ts

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { connectDB } from '../config/database';
import AdminUser from '../models/AdminUser';
import ContactLead from '../models/ContactLead';
import AuditLog, { MediaAsset, FormEmailLog, AdminSession } from '../models/AuditLog';
import { BlogCategory, BlogPost, JobOpening, Partner } from '../models/Phase2';

async function clearCollections() {
  console.log('🧹 Clearing existing data...');
  await Promise.all([
    AdminUser.deleteMany({}),
    ContactLead.deleteMany({}),
    AuditLog.collection.deleteMany({}), // bypass immutability hook for seeding
    MediaAsset.deleteMany({}),
    FormEmailLog.deleteMany({}),
    AdminSession.deleteMany({}),
    BlogCategory.deleteMany({}),
    BlogPost.deleteMany({}),
    JobOpening.deleteMany({}),
    Partner.deleteMany({}),
  ]);
  console.log('✅ Collections cleared.');
}

async function seedAdminUsers() {
  console.log('👤 Seeding admin users...');

  const [arjun, priya, rahul] = await AdminUser.create([
    {
      _id: new mongoose.Types.ObjectId('a10000000000000000000001'),
      email: 'arjun@outpro.india',
      passwordHash: await bcrypt.hash('Admin@1234', 12),
      role: 'super_admin',
      fullName: 'Arjun Mehta',
      mfaEnabled: true,
      isActive: true,
    },
    {
      _id: new mongoose.Types.ObjectId('a10000000000000000000002'),
      email: 'priya@outpro.india',
      passwordHash: await bcrypt.hash('Editor@1234', 12),
      role: 'editor',
      fullName: 'Priya Sharma',
      mfaEnabled: true,
      isActive: true,
    },
    {
      _id: new mongoose.Types.ObjectId('a10000000000000000000003'),
      email: 'rahul@outpro.india',
      passwordHash: await bcrypt.hash('Viewer@1234', 12),
      role: 'viewer',
      fullName: 'Rahul Verma',
      mfaEnabled: false,
      isActive: true,
    },
  ]);

  console.log(`  ✅ Created ${[arjun, priya, rahul].length} admin users.`);
  return { arjun, priya, rahul };
}

async function seedContactLeads(adminIds: { arjun: any; priya: any }) {
  console.log('📋 Seeding contact leads...');

  const leads = await ContactLead.create([
    {
      _id: new mongoose.Types.ObjectId('b20000000000000000000001'),
      fullName: 'Neha Kapoor',
      businessEmail: 'neha.kapoor@techstart.in',
      companyName: 'TechStart Pvt Ltd',
      phoneNumber: '+91-9876543210',
      serviceInterest: 'Website Development',
      budgetRange: '₹2L – ₹5L',
      message: 'We need a modern corporate website with CMS integration and SEO optimisation for our B2B SaaS product.',
      status: 'new',
      crmProvider: 'hubspot',
      crmSyncId: 'HS-CONTACT-00112',
      crmSyncedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      recaptchaScore: 0.92,
      assignedTo: adminIds.priya._id,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      _id: new mongoose.Types.ObjectId('b20000000000000000000002'),
      fullName: 'Sameer Khan',
      businessEmail: 'sameer@brandhouse.co.in',
      companyName: 'BrandHouse Agency',
      phoneNumber: '+91-9123456789',
      serviceInterest: 'Digital Marketing',
      budgetRange: '₹50K – ₹2L',
      message: 'Looking for SEO + Google Ads management for our e-commerce clients. Monthly retainer preferred.',
      status: 'read',
      crmProvider: 'hubspot',
      crmSyncId: 'HS-CONTACT-00113',
      crmSyncedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      recaptchaScore: 0.88,
      assignedTo: adminIds.priya._id,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      _id: new mongoose.Types.ObjectId('b20000000000000000000003'),
      fullName: 'Anita Desai',
      businessEmail: 'anita.desai@globalexports.com',
      companyName: 'Global Exports Ltd',
      serviceInterest: 'UI/UX Design',
      budgetRange: '₹2L – ₹5L',
      message: 'Our current platform UI is outdated. We want a full redesign of our supplier portal.',
      status: 'replied',
      crmProvider: 'zoho',
      crmSyncId: 'ZOHO-LEAD-78934',
      crmSyncedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      recaptchaScore: 0.79,
      assignedTo: adminIds.arjun._id,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      _id: new mongoose.Types.ObjectId('b20000000000000000000004'),
      fullName: 'Vikram Rao',
      businessEmail: 'vikram@startupnest.io',
      companyName: 'StartupNest',
      phoneNumber: '+91-9000012345',
      serviceInterest: 'Mobile App',
      budgetRange: '₹5L – ₹15L',
      message: 'We are building a fintech app for micro-lending. Need cross-platform iOS + Android development.',
      status: 'converted',
      crmProvider: 'hubspot',
      crmSyncId: 'HS-CONTACT-00089',
      crmSyncedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      recaptchaScore: 0.95,
      assignedTo: adminIds.arjun._id,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
    {
      _id: new mongoose.Types.ObjectId('b20000000000000000000005'),
      fullName: 'Pooja Iyer',
      businessEmail: 'pooja.iyer@freshideas.in',
      message: 'Just exploring your services. Can someone reach out to discuss options?',
      status: 'new',
      crmProvider: 'none',
      recaptchaScore: 0.55,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
  ]);

  console.log(`  ✅ Created ${leads.length} contact leads.`);
  return leads;
}

async function seedAuditLogs(adminIds: any, leadIds: any) {
  console.log('📜 Seeding audit logs...');

  // Bypass immutability hook for seeding by using insertMany directly
  await AuditLog.collection.insertMany([
    {
      actorId: adminIds.priya._id,
      actorEmail: 'priya@outpro.india',
      action: 'lead.status.update',
      targetCollection: 'contact_leads',
      targetId: leadIds[1]._id,
      payload: { before: { status: 'new' }, after: { status: 'read' } },
      createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
    },
    {
      actorId: adminIds.arjun._id,
      actorEmail: 'arjun@outpro.india',
      action: 'lead.assign',
      targetCollection: 'contact_leads',
      targetId: leadIds[2]._id,
      payload: { before: { assignedTo: null }, after: { assignedTo: adminIds.arjun._id.toString() } },
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      actorId: adminIds.arjun._id,
      actorEmail: 'arjun@outpro.india',
      action: 'admin.login',
      payload: { ip: '103.45.67.89', mfaMethod: 'totp' },
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    },
    {
      actorId: adminIds.priya._id,
      actorEmail: 'priya@outpro.india',
      action: 'lead.status.update',
      targetCollection: 'contact_leads',
      targetId: leadIds[2]._id,
      payload: { before: { status: 'read' }, after: { status: 'replied' } },
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log('  ✅ Created 4 audit log entries.');
}

async function seedMediaAssets(adminIds: any) {
  console.log('🖼️  Seeding media assets...');

  const assets = await MediaAsset.create([
    {
      _id: new mongoose.Types.ObjectId('c30000000000000000000001'),
      uploadedBy: adminIds.priya._id,
      originalFilename: 'hero-banner-v3.webp',
      storageBucket: 'public',
      storagePath: 'media/2026/04/hero-banner-v3.webp',
      publicUrl: 'https://cdn.outpro.india/media/2026/04/hero-banner-v3.webp',
      mimeType: 'image/webp',
      fileSizeBytes: 245760,
      scanStatus: 'clean',
      altText: 'Outpro India hero banner — team collaborating on digital strategy',
    },
    {
      _id: new mongoose.Types.ObjectId('c30000000000000000000002'),
      uploadedBy: adminIds.arjun._id,
      originalFilename: 'case-study-globalexports.pdf',
      storageBucket: 'public',
      storagePath: 'media/2026/04/case-study-globalexports.pdf',
      publicUrl: 'https://cdn.outpro.india/media/2026/04/case-study-globalexports.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1048576,
      scanStatus: 'clean',
    },
    {
      _id: new mongoose.Types.ObjectId('c30000000000000000000003'),
      uploadedBy: adminIds.priya._id,
      originalFilename: 'team-photo-2026.jpg',
      storageBucket: 'private',
      storagePath: 'uploads/pending/team-photo-2026.jpg',
      publicUrl: null,
      mimeType: 'image/jpeg',
      fileSizeBytes: 3145728,
      scanStatus: 'pending_scan',
      altText: 'Outpro India team photo 2026',
    },
  ]);

  console.log(`  ✅ Created ${assets.length} media assets.`);
  return assets;
}

async function seedFormEmailLog(leadIds: any, adminIds: any) {
  console.log('📧 Seeding email log...');

  await FormEmailLog.create([
    {
      leadId: leadIds[0]._id,
      recipientEmail: 'arjun@outpro.india',
      templateName: 'admin_notification',
      resendMessageId: 'resend_msg_abc123001',
      status: 'sent',
      sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      leadId: leadIds[0]._id,
      recipientEmail: 'neha.kapoor@techstart.in',
      templateName: 'auto_reply',
      resendMessageId: 'resend_msg_abc123002',
      status: 'sent',
      sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      leadId: leadIds[4]._id,
      recipientEmail: 'arjun@outpro.india',
      templateName: 'admin_notification',
      resendMessageId: 'resend_msg_abc123010',
      status: 'sent',
      sentAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
  ]);

  console.log('  ✅ Created 3 email log entries.');
}

async function seedBlogData() {
  console.log('📝 Seeding blog data...');

  const [webDev, digitalMktg, uiux, caseStudies] = await BlogCategory.create([
    { name: 'Web Development', slug: 'web-development', description: 'Articles on modern web technologies and best practices.' },
    { name: 'Digital Marketing', slug: 'digital-marketing', description: 'SEO, PPC, social media, and content strategy insights.' },
    { name: 'UI/UX Design', slug: 'ui-ux-design', description: 'Design thinking, user research, and interface trends.' },
    { name: 'Case Studies', slug: 'case-studies', description: 'Deep-dives into our client projects and outcomes.' },
  ]);

  await BlogPost.create([
    {
      _id: new mongoose.Types.ObjectId('d40000000000000000000001'),
      sanityId: 'sanity-blog-001',
      title: 'Why Next.js 14 Is the Right Choice for Corporate Websites in 2026',
      slug: 'nextjs-14-corporate-websites-2026',
      authorName: 'Arjun Mehta',
      excerpt: 'We explore how Next.js App Router, ISR, and Edge Functions address the performance and scalability needs of modern corporate platforms.',
      publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      isPublished: true,
      categories: [webDev._id],
    },
    {
      _id: new mongoose.Types.ObjectId('d40000000000000000000002'),
      sanityId: 'sanity-blog-002',
      title: 'Headless CMS vs Traditional CMS: A Practical Guide for 2026',
      slug: 'headless-cms-vs-traditional-2026',
      authorName: 'Priya Sharma',
      excerpt: 'Comparing Sanity.io, Contentful, and WordPress for editorial teams who need speed without developer dependency.',
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      isPublished: true,
      categories: [webDev._id, uiux._id],
    },
  ]);

  console.log(`  ✅ Created 4 blog categories + 2 blog posts.`);
}

async function seedJobOpenings() {
  console.log('💼 Seeding job openings...');

  await JobOpening.create([
    {
      sanityId: 'sanity-job-001',
      title: 'Senior Full-Stack Engineer (Next.js)',
      slug: 'senior-fullstack-engineer-nextjs',
      department: 'Engineering',
      location: 'Delhi (Hybrid)',
      employmentType: 'full-time',
      isActive: true,
      closesAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      sanityId: 'sanity-job-002',
      title: 'UI/UX Designer',
      slug: 'ui-ux-designer',
      department: 'Design',
      location: 'Delhi (On-site)',
      employmentType: 'full-time',
      isActive: true,
      closesAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    },
    {
      sanityId: 'sanity-job-003',
      title: 'Digital Marketing Intern',
      slug: 'digital-marketing-intern',
      department: 'Marketing',
      location: 'Remote',
      employmentType: 'internship',
      isActive: true,
    },
  ]);

  console.log('  ✅ Created 3 job openings.');
}

async function seedPartners() {
  console.log('🤝 Seeding partners...');

  await Partner.create([
    {
      companyName: 'TechForce Solutions',
      contactEmail: 'partner@techforce.in',
      tier: 'gold',
      isActive: true,
      joinedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
    },
    {
      companyName: 'CreativeHub Agency',
      contactEmail: 'hello@creativehub.co.in',
      tier: 'silver',
      isActive: true,
      joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log('  ✅ Created 2 partners.');
}

// ── Main runner ───────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱 Outpro.India — MongoDB Seed Script\n' + '═'.repeat(45));

  await connectDB();
  await clearCollections();

  const adminIds = await seedAdminUsers();
  const leads = await seedContactLeads(adminIds);
  await seedAuditLogs(adminIds, leads);
  await seedMediaAssets(adminIds);
  await seedFormEmailLog(leads, adminIds);
  await seedBlogData();
  await seedJobOpenings();
  await seedPartners();

  console.log('\n' + '═'.repeat(45));
  console.log('🎉 Seed complete! Collections populated:');
  console.log('   admin_users · contact_leads · audit_log · media_assets');
  console.log('   form_email_log · blog_categories · blog_posts');
  console.log('   job_openings · partners');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
