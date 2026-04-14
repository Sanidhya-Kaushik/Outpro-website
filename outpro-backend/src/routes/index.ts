// src/routes/index.ts
// Assembles all route groups under /api/v1

import { Router } from 'express';
import multer from 'multer';
import { fromBuffer } from 'file-type';
import { authenticate, authorise, validate, validateWebhookSecret } from '../middleware';
import {
  AuthController, ContactController, PortfolioController,
  TestimonialController, AdminController,
} from '../controllers/index';
import {
  loginSchema, changePasswordSchema, mfaVerifySchema,
  contactFormSchema, updateLeadSchema,
  createProjectSchema, updateProjectSchema,
  createTestimonialSchema, updateTestimonialSchema, reorderTestimonialsSchema,
  createAdminUserSchema, updateAdminUserSchema,
} from '../validators';
import { checkDatabaseHealth } from '../config/database';
import { AppError } from '../utils/response';

const router = Router();

// ── File upload config ────────────────────────────────────────────────────────

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/svg+xml', 'application/pdf', 'video/mp4', 'video/quicktime',
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;  // 50 MB

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: async (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new AppError('File type not allowed', 400, 'INVALID_FILE_TYPE'));
    }
    cb(null, true);
  },
});

// Magic-byte MIME validation middleware (runs after multer)
async function validateMagicBytes(req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) {
  if (!req.file) return next();
  try {
    const detected = await fromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
      return next(new AppError('File content does not match declared MIME type', 400, 'INVALID_FILE_TYPE'));
    }
    if (detected.mime.startsWith('image/') && req.file.size > MAX_IMAGE_BYTES) {
      return next(new AppError('Image exceeds 10 MB limit', 400, 'FILE_TOO_LARGE'));
    }
    req.file.mimetype = detected.mime; // Override with verified MIME
    next();
  } catch {
    next(new AppError('Could not validate file type', 400, 'INVALID_FILE_TYPE'));
  }
}

// ── Health ────────────────────────────────────────────────────────────────────

router.get('/health', async (_req, res) => {
  const db = await checkDatabaseHealth();
  res.json({
    status: db.status === 'ok' ? 'healthy' : 'degraded',
    version: process.env.npm_package_version ?? '1.0.0',
    uptime: Math.floor(process.uptime()),
    checks: { database: db.status, storage: 'ok' },
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

const auth = Router();
auth.post('/login', validate(loginSchema), AuthController.login);
auth.post('/logout', authenticate, AuthController.logout);
auth.get('/me', authenticate, AuthController.me);
auth.patch('/password', authenticate, validate(changePasswordSchema), AuthController.changePassword);
auth.post('/mfa/setup', authenticate, AuthController.mfaSetup);
auth.post('/mfa/verify', authenticate, validate(mfaVerifySchema), AuthController.mfaVerify);
router.use('/auth', auth);

// ── Contact / Leads ───────────────────────────────────────────────────────────

const contact = Router();
contact.post('/', validate(contactFormSchema), ContactController.submit);
contact.get('/leads', authenticate, ContactController.getLeads);
contact.get('/leads/stats', authenticate, ContactController.getStats);
contact.get('/leads/:id', authenticate, ContactController.getLead);
contact.patch('/leads/:id', authenticate, authorise('super_admin', 'editor'), validate(updateLeadSchema), ContactController.updateLead);
contact.delete('/leads/:id', authenticate, authorise('super_admin'), ContactController.deleteLead);
router.use('/contact', contact);

// ── Portfolio ─────────────────────────────────────────────────────────────────

const portfolio = Router();
portfolio.get('/', PortfolioController.list);
portfolio.get('/categories', PortfolioController.categories);
portfolio.get('/:slug', PortfolioController.getBySlug);
portfolio.post('/', authenticate, authorise('super_admin', 'editor'), validate(createProjectSchema), PortfolioController.create);
portfolio.patch('/:id', authenticate, authorise('super_admin', 'editor'), validate(updateProjectSchema), PortfolioController.update);
portfolio.delete('/:id', authenticate, authorise('super_admin'), PortfolioController.delete);
portfolio.post('/revalidate', validateWebhookSecret, PortfolioController.revalidate);
router.use('/portfolio', portfolio);

// ── Testimonials ──────────────────────────────────────────────────────────────

const testimonials = Router();
testimonials.get('/', TestimonialController.list);
testimonials.get('/stats', authenticate, TestimonialController.getStats);
testimonials.get('/:id', TestimonialController.getById);
testimonials.post('/', authenticate, authorise('super_admin', 'editor'), validate(createTestimonialSchema), TestimonialController.create);
testimonials.patch('/reorder', authenticate, authorise('super_admin', 'editor'), validate(reorderTestimonialsSchema), TestimonialController.reorder);
testimonials.patch('/:id', authenticate, authorise('super_admin', 'editor'), validate(updateTestimonialSchema), TestimonialController.update);
testimonials.delete('/:id', authenticate, authorise('super_admin'), TestimonialController.delete);
router.use('/testimonials', testimonials);

// ── Admin ─────────────────────────────────────────────────────────────────────

const admin = Router();
admin.use(authenticate);
admin.get('/dashboard', AdminController.dashboard);
admin.get('/users', authorise('super_admin'), AdminController.listUsers);
admin.post('/users', authorise('super_admin'), validate(createAdminUserSchema), AdminController.createUser);
admin.patch('/users/:id', authorise('super_admin'), validate(updateAdminUserSchema), AdminController.updateUser);
admin.delete('/users/:id', authorise('super_admin'), AdminController.deleteUser);
admin.get('/audit-log', AdminController.auditLog);
admin.post('/media', authorise('super_admin', 'editor'), upload.single('file'), validateMagicBytes, AdminController.uploadMedia);
admin.get('/media', AdminController.listMedia);
admin.delete('/media/:id', authorise('super_admin'), AdminController.deleteMedia);
router.use('/admin', admin);

export default router;
