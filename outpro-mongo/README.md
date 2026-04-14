# Outpro.India — MongoDB Database Layer

Complete Mongoose schema replacing the PostgreSQL/Supabase database.  
Every table, index, enum, and seed record is ported 1-to-1.

---

## Collections → PostgreSQL table mapping

| MongoDB Collection   | PostgreSQL Table          | Notes                                      |
|----------------------|---------------------------|--------------------------------------------|
| `admin_users`        | `admin_users`             | bcrypt(12), TOTP MFA, role enum, lockout   |
| `contact_leads`      | `contact_leads`           | Full-text index, CRM sync, reCAPTCHA score |
| `audit_log`          | `audit_log`               | Immutable — insert only, no update/delete  |
| `media_assets`       | `media_assets`            | TTL on sessions, virus scan pipeline       |
| `admin_sessions`     | `admin_sessions`          | JWT jti revocation, TTL auto-expire        |
| `form_email_log`     | `form_email_log`          | Resend email tracking                      |
| `rate_limit_log`     | `rate_limit_log`          | TTL 24h auto-cleanup                       |
| `blog_categories`    | `blog_categories`         | Phase 2                                    |
| `blog_posts`         | `blog_posts` + junction   | Categories embedded (no junction table)    |
| `job_openings`       | `job_openings`            | Phase 2                                    |
| `job_applications`   | `job_applications`        | Phase 2                                    |
| `partners`           | `partners`                | Phase 3                                    |
| `partner_users`      | `partner_users`           | Phase 3                                    |

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit MONGODB_URI to point to your MongoDB instance
```

### 3. Run seed data
```bash
npm run seed
```

This creates all collections, indexes, and sample data matching the original SQL seed.

---

## MongoDB Atlas (Production)

1. Create a free cluster at **mongodb.com/atlas**
2. Create a database user with readWrite access
3. Whitelist your IP (or use 0.0.0.0/0 for Vercel/Railway)
4. Copy the connection string into your `.env`:

```
MONGODB_URI=mongodb+srv://outpro:<password>@cluster0.xxxxx.mongodb.net/outpro_india?retryWrites=true&w=majority
```

---

## Key design decisions vs PostgreSQL

| Feature              | PostgreSQL                  | MongoDB                                      |
|----------------------|-----------------------------|----------------------------------------------|
| Enums                | `CREATE TYPE` enums         | Schema-level `enum` validation               |
| citext (case insens) | `CITEXT` extension          | `lowercase: true` on String fields           |
| UUID primary key     | `gen_random_uuid()`         | `mongoose.Types.ObjectId` (24-char hex)      |
| Auto timestamps      | Trigger function            | `timestamps: true` option                    |
| Full-text search     | GIN tsvector index          | MongoDB text index with weights              |
| Audit immutability   | RLS + no DELETE policy      | Pre-hook throws on update/delete             |
| Session TTL expiry   | Manual cron job             | `expireAfterSeconds` TTL index               |
| Junction table       | `blog_post_categories`      | Embedded ObjectId array in `blog_posts`      |
| Row Level Security   | Supabase RLS policies       | Application-layer middleware (same logic)    |

---

## Connecting to your Express backend

Replace the Supabase pool in `src/config/database.ts` with:

```typescript
import { connectDB } from './config/database'; // this file

// In your app startup (server.ts or index.ts):
await connectDB();
```

All your existing controller imports stay the same — just swap the model imports from raw SQL queries to Mongoose model methods.

### Example — before (PostgreSQL):
```typescript
const lead = await db.query('SELECT * FROM contact_leads WHERE id = $1', [id]);
```

### After (MongoDB):
```typescript
import ContactLead from '../models/ContactLead';
const lead = await ContactLead.findById(id).populate('assignedTo', 'fullName email');
```
