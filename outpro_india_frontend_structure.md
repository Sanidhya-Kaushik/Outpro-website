# Outpro.India — Next.js Frontend Architecture

> **Stack:** Next.js 14 (App Router) · TypeScript 5 · Tailwind CSS v3 · Zod · Zustand · React Hook Form · Framer Motion  
> **Backend:** REST API at `https://www.outpro.india/api/v1` · JWT + TOTP MFA · 36 endpoints

---

## 1. Folder Structure

```
outpro-india/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint → Type → Test → Build → Deploy
│       └── security-audit.yml        # pnpm audit (critical CVE block)
│
├── src/
│   ├── app/                          # Next.js 14 App Router root
│   │   ├── (public)/                 # Route group — public-facing site
│   │   │   ├── layout.tsx            # Public layout (Navbar + Footer)
│   │   │   ├── page.tsx              # / Home (SSG + ISR revalidate:3600)
│   │   │   ├── about/
│   │   │   │   └── page.tsx          # /about (SSG)
│   │   │   ├── services/
│   │   │   │   ├── page.tsx          # /services overview (SSG)
│   │   │   │   └── [slug]/
│   │   │   │       ├── page.tsx      # /services/[slug] detail (SSG)
│   │   │   │       └── loading.tsx   # Streaming skeleton
│   │   │   ├── portfolio/
│   │   │   │   ├── page.tsx          # /portfolio grid (SSG + ISR:1800)
│   │   │   │   ├── [slug]/
│   │   │   │   │   ├── page.tsx      # /portfolio/[slug] case study (SSG)
│   │   │   │   │   └── loading.tsx
│   │   │   │   └── not-found.tsx     # 404 for unknown slug
│   │   │   ├── testimonials/
│   │   │   │   └── page.tsx          # /testimonials (SSG + ISR:3600)
│   │   │   └── contact/
│   │   │       └── page.tsx          # /contact (SSG shell + CSR form)
│   │   │
│   │   ├── (admin)/                  # Route group — protected admin panel
│   │   │   ├── layout.tsx            # Admin layout (Sidebar + TopBar)
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx          # /admin → redirect to /admin/dashboard
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx      # KPI overview (CSR)
│   │   │   │   ├── leads/
│   │   │   │   │   ├── page.tsx      # Lead list with filters
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx  # Lead detail / status update
│   │   │   │   ├── portfolio/
│   │   │   │   │   ├── page.tsx      # Project list
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx  # Create project form
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx  # Edit project form
│   │   │   │   ├── testimonials/
│   │   │   │   │   ├── page.tsx      # Testimonial list + drag reorder
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx  # Create testimonial form
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx  # Edit testimonial form
│   │   │   │   ├── media/
│   │   │   │   │   └── page.tsx      # Media library grid
│   │   │   │   ├── users/
│   │   │   │   │   └── page.tsx      # Admin user management (super_admin)
│   │   │   │   ├── audit-log/
│   │   │   │   │   └── page.tsx      # Immutable audit trail viewer
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx      # Profile, password, MFA setup
│   │   │   └── login/
│   │   │       └── page.tsx          # /login (public auth page)
│   │   │
│   │   ├── api/                      # Next.js API Routes (proxy / BFF)
│   │   │   ├── contact/
│   │   │   │   └── route.ts          # POST — reCAPTCHA verify + forward
│   │   │   ├── revalidate/
│   │   │   │   └── route.ts          # POST — Sanity CMS ISR webhook
│   │   │   └── health/
│   │   │       └── route.ts          # GET — uptime probe
│   │   │
│   │   ├── error.tsx                 # Global error boundary
│   │   ├── not-found.tsx             # Global 404 page
│   │   └── layout.tsx                # Root layout (html + body, fonts, providers)
│   │
│   ├── components/
│   │   ├── ui/                       # Primitive design-system atoms
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Checkbox.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── Avatar.tsx
│   │   │   └── index.ts              # Barrel export
│   │   │
│   │   ├── layout/                   # Site-level layout components
│   │   │   ├── Navbar.tsx            # SSR — reads Sanity nav links
│   │   │   ├── Footer.tsx
│   │   │   ├── MobileMenu.tsx        # Drawer via Framer Motion
│   │   │   ├── AdminSidebar.tsx
│   │   │   └── AdminTopBar.tsx
│   │   │
│   │   ├── sections/                 # Page-level section components
│   │   │   ├── home/
│   │   │   │   ├── HeroSection.tsx
│   │   │   │   ├── StatsCounter.tsx  # Framer Motion count-up animation
│   │   │   │   ├── ServicesPreview.tsx
│   │   │   │   ├── PortfolioPreview.tsx
│   │   │   │   └── TestimonialsCarousel.tsx
│   │   │   ├── about/
│   │   │   │   ├── TeamGrid.tsx
│   │   │   │   ├── ValuesSection.tsx
│   │   │   │   └── AwardsSection.tsx
│   │   │   ├── services/
│   │   │   │   ├── ServiceCard.tsx
│   │   │   │   └── ServiceDetailHero.tsx
│   │   │   ├── portfolio/
│   │   │   │   ├── PortfolioGrid.tsx
│   │   │   │   ├── PortfolioFilter.tsx
│   │   │   │   └── CaseStudyHero.tsx
│   │   │   ├── testimonials/
│   │   │   │   ├── TestimonialCard.tsx
│   │   │   │   └── VideoTestimonial.tsx
│   │   │   └── contact/
│   │   │       ├── ContactForm.tsx   # CSR — React Hook Form + Zod
│   │   │       └── ContactInfo.tsx
│   │   │
│   │   ├── admin/                    # Admin panel components
│   │   │   ├── dashboard/
│   │   │   │   ├── KpiCard.tsx
│   │   │   │   ├── LeadsChart.tsx
│   │   │   │   └── RecentActivity.tsx
│   │   │   ├── leads/
│   │   │   │   ├── LeadsTable.tsx
│   │   │   │   ├── LeadStatusBadge.tsx
│   │   │   │   └── LeadFilters.tsx
│   │   │   ├── portfolio/
│   │   │   │   ├── ProjectForm.tsx
│   │   │   │   └── ProjectTable.tsx
│   │   │   ├── testimonials/
│   │   │   │   ├── TestimonialForm.tsx
│   │   │   │   └── DraggableTestimonialList.tsx
│   │   │   ├── media/
│   │   │   │   ├── MediaUploader.tsx # multipart/form-data drag-drop
│   │   │   │   ├── MediaGrid.tsx
│   │   │   │   └── MediaCard.tsx
│   │   │   ├── users/
│   │   │   │   ├── UserTable.tsx
│   │   │   │   └── UserForm.tsx
│   │   │   └── audit/
│   │   │       └── AuditLogTable.tsx
│   │   │
│   │   └── shared/                   # Cross-cutting reusable blocks
│   │       ├── CtaBanner.tsx
│   │       ├── SectionHeading.tsx
│   │       ├── PortableText.tsx      # Sanity rich-text renderer
│   │       ├── ImageWithFallback.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── RoleGuard.tsx         # Client-side role check wrapper
│   │       └── ErrorBoundary.tsx
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts             # Base fetch wrapper (auth + error handling)
│   │   │   ├── auth.ts               # Auth endpoint calls
│   │   │   ├── contact.ts            # Contact + leads endpoints
│   │   │   ├── portfolio.ts          # Portfolio endpoints
│   │   │   ├── testimonials.ts       # Testimonials endpoints
│   │   │   └── admin.ts              # Admin dashboard + users + media + audit
│   │   ├── sanity/
│   │   │   ├── client.ts             # Sanity CDN client
│   │   │   ├── queries.ts            # GROQ query strings
│   │   │   └── image.ts              # urlForImage helper
│   │   ├── auth/
│   │   │   ├── session.ts            # Cookie read/decode helpers
│   │   │   └── permissions.ts        # Role matrix constants
│   │   └── utils/
│   │       ├── cn.ts                 # clsx + tailwind-merge
│   │       ├── format.ts             # Date, currency, number formatters
│   │       └── recaptcha.ts          # grecaptcha.execute wrapper
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                # Auth state from Zustand
│   │   ├── useToast.ts               # Toast notification trigger
│   │   ├── useDebounce.ts
│   │   ├── useIntersectionObserver.ts # For scroll-triggered animations
│   │   └── useMediaQuery.ts
│   │
│   ├── store/
│   │   ├── authStore.ts              # Zustand — user, token, role
│   │   ├── toastStore.ts             # Zustand — toast queue
│   │   └── uiStore.ts                # Zustand — mobile menu, modals
│   │
│   ├── types/
│   │   ├── api.ts                    # API response envelopes + entity types
│   │   ├── auth.ts                   # AdminUser, Session, Role
│   │   ├── lead.ts                   # ContactLead, LeadStatus enum
│   │   ├── portfolio.ts              # PortfolioProject, Category
│   │   ├── testimonial.ts            # Testimonial, VideoTestimonial
│   │   ├── media.ts                  # MediaAsset, ScanStatus
│   │   └── sanity.ts                 # Sanity document shapes
│   │
│   ├── validators/
│   │   ├── contactForm.schema.ts     # Zod — matches API validation rules
│   │   ├── loginForm.schema.ts
│   │   ├── passwordChange.schema.ts
│   │   ├── projectForm.schema.ts
│   │   ├── testimonialForm.schema.ts
│   │   └── userForm.schema.ts
│   │
│   ├── middleware.ts                 # Next.js middleware — JWT route guard
│   └── styles/
│       └── globals.css               # Tailwind base + custom CSS vars
│
├── public/
│   ├── fonts/                        # Self-hosted WOFF2 files
│   ├── icons/                        # SVG service icons
│   └── og/                           # OG images per page
│
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 2. Page Structure

### Public Pages

| Route | Rendering | Revalidate | Data Sources |
|---|---|---|---|
| `/` | SSG + ISR | 3600 s | Sanity (hero, services, portfolio previews, stats) |
| `/about` | SSG | — | Sanity (team, values, awards) |
| `/services` | SSG | — | Sanity (all service types) |
| `/services/[slug]` | SSG + ISR | on-demand | Sanity (service detail) |
| `/portfolio` | SSG + ISR | 1800 s | Sanity + `/api/v1/portfolio` (view counts) |
| `/portfolio/[slug]` | SSG + ISR | on-demand | Sanity (case study) |
| `/testimonials` | SSG + ISR | 3600 s | `/api/v1/testimonials` (public) |
| `/contact` | SSG shell | — | CSR form → `/api/v1/contact` |

### Admin Pages (CSR, JWT-protected)

| Route | Guard | API Endpoints Used |
|---|---|---|
| `/login` | Public | `POST /auth/login` |
| `/admin/dashboard` | any role | `GET /admin/dashboard?period=30d` |
| `/admin/leads` | any role | `GET /contact/leads` |
| `/admin/leads/[id]` | editor+ | `GET /contact/leads/:id`, `PATCH /contact/leads/:id` |
| `/admin/portfolio` | editor+ | `GET /portfolio`, `DELETE /portfolio/:id` |
| `/admin/portfolio/new` | editor+ | `POST /portfolio` |
| `/admin/portfolio/[id]` | editor+ | `GET /portfolio/:slug`, `PATCH /portfolio/:id` |
| `/admin/testimonials` | editor+ | `GET /testimonials`, `PATCH /testimonials/reorder` |
| `/admin/testimonials/new` | editor+ | `POST /testimonials` |
| `/admin/testimonials/[id]` | editor+ | `PATCH /testimonials/:id`, `DELETE /testimonials/:id` |
| `/admin/media` | editor+ | `GET /admin/media`, `POST /admin/media` |
| `/admin/users` | super_admin | `GET/POST/PATCH/DELETE /admin/users` |
| `/admin/audit-log` | any role | `GET /admin/audit-log` |
| `/admin/settings` | any role | `GET /auth/me`, `PATCH /auth/password`, MFA setup |

---

## 3. Component Architecture

### Design System Atoms (`components/ui/`)

All atoms accept `className` prop and compose with Tailwind via `cn()` (clsx + tailwind-merge). They never carry business logic.

```tsx
// components/ui/Button.tsx
type ButtonProps = {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;
```

**Key atoms:** `Button`, `Badge` (status colours for `LeadStatus`), `Input`, `Textarea`, `Select`, `Modal` (portal + focus trap), `Toast` (connects to `toastStore`), `Skeleton`, `Spinner`, `Pagination`, `Tooltip`, `Avatar`.

### Section Components (`components/sections/`)

Page-specific sections that receive pre-fetched data as props. They are Server Components by default; only leaf interactive pieces (`ContactForm`, `PortfolioFilter`) are Client Components.

```tsx
// Server Component — zero client JS
export default function HeroSection({ data }: { data: SanityHero }) { ... }

// Client Component — event handling
'use client';
export default function ContactForm() { ... }
```

### Admin Components (`components/admin/`)

All admin components are Client Components. They receive data via TanStack Query hooks and mutate through the API client layer.

```
LeadsTable      → useLeads()     → api/contact.ts
ProjectForm     → useProject()   → api/portfolio.ts
MediaUploader   → useUpload()    → api/admin.ts (multipart)
DraggableTestimonialList → useSortable (dnd-kit) → PATCH /testimonials/reorder
```

---

## 4. Layout System

### Root Layout (`app/layout.tsx`)

```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(displayFont.variable, bodyFont.variable)}>
        <Providers>           {/* Zustand + TanStack Query */}
          <ToastRenderer />
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

### Public Layout (`app/(public)/layout.tsx`)

```
┌─────────────────────────────────────────┐
│  <Navbar />  (Server Component)          │
│    Logo | Nav Links | CTA Button         │
├─────────────────────────────────────────┤
│  {children}                              │
│  (full-width sections, variable height)  │
├─────────────────────────────────────────┤
│  <Footer />  (Server Component)          │
│    Links | Social | Legal                │
└─────────────────────────────────────────┘
```

### Admin Layout (`app/(admin)/layout.tsx`)

```
┌──────────┬──────────────────────────────────┐
│          │  <AdminTopBar />                  │
│  Admin   │  Breadcrumbs | User Menu | Notif  │
│ Sidebar  ├──────────────────────────────────┤
│          │                                   │
│ - Dash   │  {children}                       │
│ - Leads  │  (scrollable content area)        │
│ - Port.  │                                   │
│ - Test.  │                                   │
│ - Media  │                                   │
│ - Users* │                                   │
│ - Audit  │                                   │
│ - Sett.  │                                   │
└──────────┴──────────────────────────────────┘
* Sidebar items filtered by role via RoleGuard
```

### Tailwind Spacing / Container System

```ts
// tailwind.config.ts
theme: {
  container: { center: true, padding: { DEFAULT: '1rem', sm: '2rem', lg: '4rem' } },
  screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
  extend: {
    colors: {
      brand: { 50: '...', 500: '#0F4C81', 900: '...' },  // Outpro navy
      accent: { DEFAULT: '#F5A623' },                      // Outpro gold
    },
    fontFamily: {
      display: ['var(--font-display)'],
      body: ['var(--font-body)'],
    },
  }
}
```

---

## 5. Routing

### Middleware (JWT Route Guard)

```ts
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED = ['/admin'];
const PUBLIC_AUTH = ['/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('session')?.value;

  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  const isPublicAuth = PUBLIC_AUTH.some(p => pathname.startsWith(p));

  if (isProtected) {
    if (!token) return NextResponse.redirect(new URL('/login', req.url));
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      const res = NextResponse.next();
      res.headers.set('x-user-role', payload.role as string);
      return res;
    } catch {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  if (isPublicAuth && token) {
    return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
```

### Static Generation Helpers

```ts
// app/(public)/portfolio/[slug]/page.tsx
export async function generateStaticParams() {
  const projects = await sanityClient.fetch(`*[_type == "portfolioProject"]{ slug }`);
  return projects.map(p => ({ slug: p.slug.current }));
}

export const revalidate = 1800; // 30 min ISR
```

### Navigation Route Map

```ts
// lib/routes.ts
export const routes = {
  home: '/',
  about: '/about',
  services: (slug?: string) => slug ? `/services/${slug}` : '/services',
  portfolio: (slug?: string) => slug ? `/portfolio/${slug}` : '/portfolio',
  testimonials: '/testimonials',
  contact: '/contact',
  login: '/login',
  admin: {
    dashboard: '/admin/dashboard',
    leads: '/admin/leads',
    lead: (id: string) => `/admin/leads/${id}`,
    portfolio: '/admin/portfolio',
    newProject: '/admin/portfolio/new',
    editProject: (id: string) => `/admin/portfolio/${id}`,
    testimonials: '/admin/testimonials',
    media: '/admin/media',
    users: '/admin/users',
    auditLog: '/admin/audit-log',
    settings: '/admin/settings',
  },
} as const;
```

---

## 6. State Management

### Zustand Stores

**`store/authStore.ts`** — Persisted to memory only (no localStorage for security).

```ts
type AuthState = {
  user: AdminUser | null;
  token: string | null;
  expiresAt: string | null;
  role: AdminRole | null;
  isAuthenticated: boolean;
  setAuth: (data: LoginResponse) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  expiresAt: null,
  role: null,
  isAuthenticated: false,
  setAuth: (data) => set({ user: data.user, token: data.token,
    expiresAt: data.expiresAt, role: data.user.role, isAuthenticated: true }),
  clearAuth: () => set({ user: null, token: null, expiresAt: null,
    role: null, isAuthenticated: false }),
}));
```

**`store/toastStore.ts`** — Global toast queue.

```ts
type Toast = { id: string; type: 'success' | 'error' | 'info'; message: string };
type ToastState = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
};
```

**`store/uiStore.ts`** — Ephemeral UI state.

```ts
type UiState = {
  mobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  activeModal: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;
};
```

### Server State — TanStack Query

All admin data fetching uses TanStack Query v5 for caching, background refetching, and optimistic updates.

```ts
// hooks/useLeads.ts
export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: () => api.contact.getLeads(filters),
    staleTime: 30_000,
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      api.contact.updateLead(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
    onError: (err) => useToastStore.getState().addToast({ type: 'error', message: err.message }),
  });
}
```

---

## 7. Form Handling

All forms use **React Hook Form** + **Zod** validation. Client-side validation mirrors server-side API rules exactly.

### Contact Form (Public)

```ts
// validators/contactForm.schema.ts
export const contactFormSchema = z.object({
  fullName:        z.string().min(2).max(120),
  businessEmail:   z.string().email().max(255),
  companyName:     z.string().max(200).optional(),
  phoneNumber:     z.string().max(30).regex(/^\+?[1-9]\d{1,14}$/).optional(),
  serviceInterest: z.enum(['Website Development','Digital Marketing','UI/UX Design',
                            'Mobile App','SEO','Other']).optional(),
  budgetRange:     z.string().max(80).optional(),
  message:         z.string().min(10).max(2000),
  recaptchaToken:  z.string().min(1),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
```

```tsx
// components/sections/contact/ContactForm.tsx
'use client';
export default function ContactForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } =
    useForm<ContactFormValues>({ resolver: zodResolver(contactFormSchema) });

  const onSubmit = async (data: ContactFormValues) => {
    const token = await grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_KEY!, { action: 'contact' });
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, recaptchaToken: token }),
    });
    if (!res.ok) throw new Error('Submission failed');
    reset();
    toast.success('Message sent! We will reply within 24 hours.');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Input {...register('fullName')} error={errors.fullName?.message} label="Full Name" />
      <Input {...register('businessEmail')} type="email" label="Business Email" />
      {/* ... */}
      <Button type="submit" loading={isSubmitting}>Send Message</Button>
    </form>
  );
}
```

### Admin Forms

```ts
// validators/passwordChange.schema.ts
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(12)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/, 'Must include uppercase, lowercase, digit, and special character'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
```

### Form Error Display Strategy

API error envelopes (`{ error: { code, message, details } }`) are parsed in the API client and mapped to React Hook Form field errors using `setError()`, providing inline field-level feedback alongside the global toast notification.

---

## 8. API Integration Strategy

### Base API Client (`lib/api/client.ts`)

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://www.outpro.india/api/v1';

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',                      // send HttpOnly session cookie
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    // Map API error envelope to typed Error
    const apiError = body as ApiErrorEnvelope;
    const err = new ApiError(apiError.error.message, apiError.error.code, res.status);
    if (res.status === 401) useAuthStore.getState().clearAuth();
    throw err;
  }

  return (body as ApiSuccessEnvelope<T>).data;
}

export const api = { get, post, patch, del }; // thin wrappers around request()
```

### Typed API Modules

```ts
// lib/api/contact.ts
export const contactApi = {
  submit: (body: ContactFormValues) =>
    api.post<{ message: string }>('/contact', body),

  getLeads: (params: LeadFilters) =>
    api.get<PaginatedResponse<ContactLead>>('/contact/leads', { params }),

  getLead: (id: string) =>
    api.get<ContactLead>(`/contact/leads/${id}`),

  updateLead: (id: string, body: Partial<ContactLead>) =>
    api.patch<ContactLead>(`/contact/leads/${id}`, body),

  deleteLead: (id: string) =>
    api.del<void>(`/contact/leads/${id}`),

  getStats: () =>
    api.get<LeadStats>('/contact/leads/stats'),
};
```

### Pagination Pattern

All paginated endpoints share a consistent query params structure:

```ts
type PaginationParams = { page: number; limit: number };
type PaginatedResponse<T> = {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
```

### Optimistic Updates (Lead Status)

```ts
useMutation({
  mutationFn: ({ id, status }) => contactApi.updateLead(id, { status }),
  onMutate: async ({ id, status }) => {
    await qc.cancelQueries({ queryKey: ['leads'] });
    const prev = qc.getQueryData<PaginatedResponse<ContactLead>>(['leads']);
    qc.setQueryData(['leads'], (old) => ({
      ...old,
      items: old.items.map(l => l.id === id ? { ...l, status } : l),
    }));
    return { prev };
  },
  onError: (_, __, ctx) => qc.setQueryData(['leads'], ctx?.prev),
  onSettled: () => qc.invalidateQueries({ queryKey: ['leads'] }),
});
```

### ISR Webhook Handler

```ts
// app/api/revalidate/route.ts
export async function POST(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { _type, slug } = await req.json();
  const pathMap: Record<string, string[]> = {
    portfolioProject: ['/portfolio', `/portfolio/${slug?.current}`],
    testimonial:      ['/testimonials', '/'],
    service:          ['/services', `/services/${slug?.current}`],
  };
  const paths = pathMap[_type] ?? ['/'];
  await Promise.all(paths.map(p => revalidatePath(p)));
  return Response.json({ revalidated: true, paths });
}
```

---

## 9. Responsive Design Strategy

### Breakpoint Grid System

```
Mobile-first. Tailwind sm/md/lg/xl/2xl breakpoints.

xs  (< 640px):  1 column, 16px gutter, full-width cards
sm  (640px+):   1–2 columns, 24px gutter
md  (768px+):   2 columns, navigation switch to horizontal
lg  (1024px+):  3 columns, sidebar appears in admin
xl  (1280px+):  4 columns, max-width container (1280px)
2xl (1536px+):  Same layout, looser spacing
```

### Typography Scaling

```ts
// Fluid type scale with Tailwind clamp utilities
// Display: clamp(2rem, 5vw, 4rem)
// H1:      clamp(1.75rem, 4vw, 3rem)
// H2:      clamp(1.5rem, 3vw, 2.25rem)
// Body:    clamp(0.875rem, 1.5vw, 1rem)

className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl"
```

### Responsive Component Patterns

**Navbar:** horizontal links on `lg+`, hamburger + drawer on mobile.  
**Admin Sidebar:** full sidebar on `lg+`, collapsible icon rail on `md`, bottom nav on mobile.  
**Tables:** horizontal scroll container on `< md`, full table on `lg+`. Mobile alternative: stacked card view.  
**Portfolio Grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.  
**Testimonial Carousel:** 1 card mobile → Embla CSS infinite carousel with touch support.

### Accessibility

- WCAG 2.1 AA enforced via `eslint-plugin-jsx-a11y`
- `prefers-reduced-motion` respected: all Framer Motion animations wrapped with `useReducedMotion()` check
- Focus-visible outlines on all interactive elements
- `aria-label`, `aria-describedby` on all form controls
- Skip-to-main link as first focusable element
- Semantic HTML5: `<main>`, `<nav>`, `<section aria-labelledby>`, `<article>`

---

## 10. Performance Optimization

### Image Strategy

```tsx
// Always use next/image — never <img>
<Image
  src={urlForImage(project.coverImage).width(800).url()}
  alt={project.title}
  width={800}
  height={600}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  placeholder="blur"
  blurDataURL={project.coverImage.lqip}   // Sanity LQIP
  priority={isAboveFold}
/>
```

### Font Loading

```ts
// app/layout.tsx — next/font, zero CLS
import { DM_Sans, DM_Serif_Display } from 'next/font/google';
const body    = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const display = DM_Serif_Display({ weight: '400', subsets: ['latin'], variable: '--font-display', display: 'swap' });
```

### Code Splitting

```tsx
// Heavy components loaded only when needed
const Lightbox         = dynamic(() => import('@/components/shared/Lightbox'), { ssr: false });
const VideoPlayer      = dynamic(() => import('@/components/shared/VideoPlayer'), { ssr: false });
const LeadsChart       = dynamic(() => import('@/components/admin/dashboard/LeadsChart'), { loading: () => <Skeleton h={200} /> });
const DraggableList    = dynamic(() => import('@/components/admin/testimonials/DraggableTestimonialList'), { ssr: false });
```

### Bundle Budget

```ts
// next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({ enabled: process.env.ANALYZE === 'true' });

module.exports = withBundleAnalyzer({
  experimental: { optimizeCss: true },
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: ['cdn.sanity.io', 'storage.googleapis.com'],
  },
  headers: async () => securityHeaders,  // CSP, HSTS, etc.
});
```

Target: **< 200 kB first-load JS** (checked in CI via `@next/bundle-analyzer`).

### Caching Strategy

```
Static HTML (SSG):         Cache-Control: public, max-age=31536000, immutable
ISR pages (revalidated):   s-maxage=3600, stale-while-revalidate
API routes (public GET):   Cache-Control: public, s-maxage=60
API routes (auth):         Cache-Control: no-store, no-cache
Assets (/_next/static/):   Cloudflare CDN — immutable, 1 year TTL
```

### TanStack Query Caching

```ts
// lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s before background refetch
      gcTime: 300_000,         // 5min cache lifetime
      retry: (count, err) => count < 2 && (err as ApiError).status >= 500,
    },
  },
});
```

### Core Web Vitals Mapping

| Target | Implementation |
|---|---|
| LCP < 2.5 s | SSG + Cloudflare edge cache → TTFB < 200ms; hero image `priority` prop |
| CLS < 0.10 | `next/image` with explicit `width`/`height`; Tailwind `aspect-ratio` containers |
| FID < 100 ms | Server Components by default; heavy libs deferred with `dynamic()` |
| PageSpeed ≥ 95 desktop | SSG + WebP/AVIF + PurgeCSS + `font-display:swap` + inline critical CSS |
| PageSpeed ≥ 90 mobile | Responsive srcsets + reduced animations on `prefers-reduced-motion` |

---

## Appendix — Environment Variables

```bash
# Public (exposed to browser)
NEXT_PUBLIC_API_URL=https://www.outpro.india/api/v1
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
NEXT_PUBLIC_GA4_MEASUREMENT_ID=

# Server-only (never exposed to browser)
JWT_SECRET=
REVALIDATION_SECRET=
RECAPTCHA_SECRET_KEY=
SANITY_API_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
```

---

## Appendix — Key Dependencies

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "typescript": "5.x",
    "tailwindcss": "3.x",
    "framer-motion": "11.x",
    "zustand": "4.x",
    "@tanstack/react-query": "5.x",
    "react-hook-form": "7.x",
    "@hookform/resolvers": "3.x",
    "zod": "3.x",
    "next-sanity": "7.x",
    "@supabase/supabase-js": "2.x",
    "@dnd-kit/core": "6.x",
    "@dnd-kit/sortable": "8.x",
    "embla-carousel-react": "8.x",
    "jose": "5.x",
    "clsx": "2.x",
    "tailwind-merge": "2.x"
  },
  "devDependencies": {
    "@next/bundle-analyzer": "*",
    "eslint-plugin-jsx-a11y": "*",
    "vitest": "*",
    "@playwright/test": "*"
  }
}
```
