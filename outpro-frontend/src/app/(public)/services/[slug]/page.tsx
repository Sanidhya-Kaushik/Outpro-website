// src/app/(public)/services/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';
import { CtaBanner } from '@/components/shared/CtaBanner';

// ── Static data (would come from Sanity in production) ────────────────────────

const SERVICES_DATA: Record<string, {
  slug: string;
  emoji: string;
  title: string;
  tagline: string;
  longDescription: string[];
  deliverables: string[];
  timeline: string;
  starting: string;
  faq: Array<{ q: string; a: string }>;
  relatedSlugs: string[];
}> = {
  'website-development': {
    slug: 'website-development',
    emoji: '🌐',
    title: 'Website Development',
    tagline: 'Fast, accessible, and built to convert.',
    longDescription: [
      'We build Next.js 14 websites and React applications that score 95+ on Google PageSpeed — not because we optimise after the fact, but because performance is baked into our architecture from day one.',
      'Every site ships with a headless CMS your marketing team can update without engineering involvement. No ticket queue. No developer bottleneck. Just content velocity.',
      'Our engagements run in two-week sprints with weekly demos, so you always know exactly where your project stands. And when we launch, we stick around — three months of post-launch support is included in every engagement.',
    ],
    deliverables: [
      'Next.js 14 with App Router',
      'Headless CMS (Sanity or Contentful)',
      'PageSpeed ≥ 95 desktop / ≥ 90 mobile',
      'WCAG 2.1 AA accessibility compliance',
      'SEO foundation (schema, sitemaps, OG)',
      'Vercel + Cloudflare deployment',
      'Google Analytics 4 integration',
      '3 months post-launch support',
    ],
    timeline: '4–12 weeks',
    starting: '₹3L',
    faq: [
      { q: 'Do you build eCommerce sites?', a: 'Yes — we build on Next.js Commerce with Shopify or custom checkout flows for high-volume merchants.' },
      { q: 'Can we update content ourselves?', a: 'Absolutely. We configure a headless CMS that non-technical team members can use comfortably. We include training sessions in every handoff.' },
      { q: 'What if we already have a design?', a: 'We can build from your existing Figma files, or we can handle both design and engineering as a single engagement.' },
    ],
    relatedSlugs: ['ui-ux-design', 'seo'],
  },
  'ui-ux-design': {
    slug: 'ui-ux-design',
    emoji: '🎨',
    title: 'UI/UX Design',
    tagline: 'Design systems that your users love and your developers can build.',
    longDescription: [
      'Great design starts with understanding users — not assumptions about them. Our process always begins with research: user interviews, competitive analysis, and data review before a single wireframe is drawn.',
      'We deliver Figma design systems, not just individual screens. That means your engineers get consistent components, documented interactions, and a shared language for building UI — not a flat mockup that\'s impossible to maintain.',
      'Every design engagement ends with a WCAG 2.1 AA audit. Accessibility isn\'t a compliance checkbox for us — it\'s how good design works.',
    ],
    deliverables: [
      'User research & interview synthesis',
      'Information architecture',
      'Low-fidelity wireframes',
      'High-fidelity Figma designs',
      'Interactive prototype for stakeholder review',
      'Component library & design system',
      'Developer handoff with redlines & specs',
      'WCAG 2.1 AA accessibility audit',
    ],
    timeline: '3–8 weeks',
    starting: '₹2L',
    faq: [
      { q: 'Do you do mobile app design too?', a: 'Yes — we design for iOS, Android, and React Native with platform-native conventions and gesture patterns.' },
      { q: 'What do you deliver in Figma?', a: 'A fully documented component library, annotated interactive prototype, and handoff-ready screens with all specs and design tokens.' },
      { q: 'Can you improve an existing design?', a: 'Yes — we run design audits that identify usability and conversion issues, then redesign the highest-impact areas first.' },
    ],
    relatedSlugs: ['website-development', 'mobile-app'],
  },
  'mobile-app': {
    slug: 'mobile-app',
    emoji: '📱',
    title: 'Mobile App Development',
    tagline: 'One codebase. Native feel. iOS and Android.',
    longDescription: [
      'We build React Native applications that feel genuinely native on both platforms — not like a web wrapper masquerading as an app. We use the platform\'s own navigation patterns, gestures, and transitions.',
      'Our architecture is API-first and offline-capable by design. Users expect apps to work in the Delhi metro — we build for intermittent connectivity as a baseline assumption, not an edge case.',
      'We handle everything from architecture through App Store submission — and stay engaged for ongoing maintenance so you have a technical partner, not just a vendor who disappears after launch.',
    ],
    deliverables: [
      'React Native (iOS + Android)',
      'Offline-first data architecture',
      'Push notification infrastructure',
      'Biometric authentication integration',
      'Analytics & crash reporting (Sentry)',
      'CI/CD pipeline (GitHub Actions)',
      'App Store & Play Store submission',
      '6 months post-launch maintenance',
    ],
    timeline: '8–20 weeks',
    starting: '₹8L',
    faq: [
      { q: 'Why React Native instead of native Swift/Kotlin?', a: 'For most business applications, React Native delivers 95% of native performance at 50% of the engineering cost. We recommend native only when there is a specific technical requirement that demands it.' },
      { q: 'Do you handle the App Store review process?', a: 'Yes — we manage the full submission, and if Apple or Google rejects the build we handle the resubmission at no additional cost.' },
      { q: 'What if we already have a web app?', a: 'We can share business logic and API clients between your web and mobile apps, significantly reducing total development time.' },
    ],
    relatedSlugs: ['website-development', 'ui-ux-design'],
  },
  'digital-marketing': {
    slug: 'digital-marketing',
    emoji: '📣',
    title: 'Digital Marketing',
    tagline: 'Paid campaigns that pay for themselves.',
    longDescription: [
      'We manage paid media the same way we\'d invest our own money — with obsessive attention to ROAS, not vanity metrics. Every campaign we run is tied to a revenue outcome, and we report on it weekly without being asked.',
      'Our media mix spans Google Search and Shopping, Meta Reels and carousels, LinkedIn ABM campaigns, and YouTube. We pick the channels that actually reach your buyers — not the channels that are easiest to run.',
      'Conversion rate optimisation is built into every engagement. Sending traffic to a page that doesn\'t convert is burning money twice.',
    ],
    deliverables: [
      'Account audit & competitor analysis',
      'Google Search, Shopping & Display',
      'Meta (Facebook & Instagram) Ads',
      'LinkedIn B2B campaign management',
      'Conversion rate optimisation',
      'Landing page design & A/B testing',
      'Weekly performance report',
      'Monthly strategy review session',
    ],
    timeline: 'Ongoing (3-month minimum)',
    starting: '₹75K/month',
    faq: [
      { q: 'What\'s included in your management fee?', a: 'Strategy, creative production, campaign management, bid optimisation, weekly reporting, and monthly strategy sessions. Ad spend is billed separately and goes directly to the platforms.' },
      { q: 'What ROAS can we expect?', a: 'It depends entirely on your category and funnel, which is why we don\'t make upfront promises. We run a 4-week analysis period to establish a baseline before making projections.' },
      { q: 'Do you do social media management too?', a: 'Organic social management is a separate service — we focus on paid performance. We can introduce you to partners who handle organic if needed.' },
    ],
    relatedSlugs: ['seo', 'branding'],
  },
  'seo': {
    slug: 'seo',
    emoji: '🔍',
    title: 'SEO',
    tagline: 'Organic visibility that compounds over time.',
    longDescription: [
      'We\'ve taken 12+ brands from page 3 to the top 3 positions in verticals with genuine competition. The approach is always the same: fix the technical foundations first, then build content authority, then earn links at scale.',
      'Technical SEO is non-negotiable. Broken crawlability, thin content, and Core Web Vitals failures will cap your rankings regardless of how much content you publish. We audit and fix the foundations before anything else.',
      'Content strategy means understanding search intent, not just keyword volume. We map content to every stage of your funnel and build a publishing cadence your team can sustain for years.',
    ],
    deliverables: [
      'Full technical SEO audit (150+ checks)',
      'Core Web Vitals diagnosis & remediation',
      'Keyword research & content mapping',
      'On-page optimisation for existing content',
      'Content calendar & brief production',
      'Schema markup implementation',
      'Link building outreach',
      'Monthly ranking & traffic report',
    ],
    timeline: 'Ongoing (3-month minimum)',
    starting: '₹50K/month',
    faq: [
      { q: 'How long does it take to see results?', a: 'Technical fixes can move rankings in 4–8 weeks. Content and authority building takes 3–6 months to show meaningful organic traffic growth. We set realistic expectations from day one.' },
      { q: 'Do you guarantee rankings?', a: 'No. Anyone who guarantees specific rankings is misleading you. We guarantee a rigorous, transparent process and we report on inputs as well as outputs every month.' },
      { q: 'Do you do local SEO?', a: 'Yes — Google Business Profile optimisation, local citation building, and review management are part of our local SEO offering.' },
    ],
    relatedSlugs: ['website-development', 'digital-marketing'],
  },
  'branding': {
    slug: 'branding',
    emoji: '✨',
    title: 'Branding',
    tagline: 'Identity that makes you impossible to ignore.',
    longDescription: [
      'A logo is not a brand. We start with positioning strategy — who you are, who you\'re for, and why anyone should care — before we draw a single shape.',
      'The visual identity we produce is comprehensive: logo family, colour system, typography, iconography, photography art direction, and a set of brand guidelines that tells everyone on your team how to use it consistently.',
      'Every brand engagement ends with a production-ready digital asset kit — social templates, email signatures, presentation templates — so your team can apply the identity from day one.',
    ],
    deliverables: [
      'Brand strategy & positioning workshop',
      'Competitive landscape analysis',
      'Brand architecture',
      'Logo design (3 concepts, 2 revision rounds)',
      'Full visual identity system',
      'Typography & colour specification',
      'Brand guidelines PDF',
      'Digital & social asset kit',
    ],
    timeline: '4–8 weeks',
    starting: '₹2.5L',
    faq: [
      { q: 'What if we just need a logo refresh?', a: 'We can scope a logo-only engagement, but we strongly recommend at minimum a brand positioning session first so the visual identity is grounded in strategy.' },
      { q: 'Do you handle print materials?', a: 'We design for print — business cards, stationery, packaging — but we use your preferred print vendor for production. We can recommend vendors in Delhi/NCR.' },
      { q: 'What\'s involved in the strategy workshop?', a: 'A half-day (or two shorter) session with your founding team, covering audience, differentiation, personality, and brand promise. We facilitate; you provide the raw material.' },
    ],
    relatedSlugs: ['ui-ux-design', 'website-development'],
  },
};

// ── generateStaticParams ──────────────────────────────────────────────────────

export async function generateStaticParams() {
  return Object.keys(SERVICES_DATA).map((slug) => ({ slug }));
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const service = SERVICES_DATA[params.slug];
  if (!service) return { title: 'Service Not Found' };
  return {
    title: `${service.title} — Services`,
    description: `${service.tagline} ${service.longDescription[0].slice(0, 120)}…`,
    openGraph: {
      title: `${service.title} | Outpro.India`,
      description: service.tagline,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const service = SERVICES_DATA[params.slug];
  if (!service) notFound();

  const related = service.relatedSlugs
    .map((s) => SERVICES_DATA[s])
    .filter(Boolean);

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-neutral-50 border-b border-neutral-100 py-3">
        <div className="container-site">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-neutral-500">
            <Link href="/" className="hover:text-neutral-900 transition-colors">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/services" className="hover:text-neutral-900 transition-colors">Services</Link>
            <span aria-hidden="true">/</span>
            <span className="text-neutral-900" aria-current="page">{service.title}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="section-y bg-white">
        <div className="container-site">
          <Link href="/services" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 mb-8 transition-colors group">
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            All services
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <span className="text-4xl mb-4 block" role="img" aria-label={service.title}>{service.emoji}</span>
              <p className="eyebrow mb-3">Service</p>
              <h1 className="heading-1 mb-4">{service.title}</h1>
              <p className="text-xl text-brand-600 font-medium mb-8">{service.tagline}</p>
              {service.longDescription.map((para, i) => (
                <p key={i} className="text-neutral-600 leading-relaxed mb-4 last:mb-0">{para}</p>
              ))}
            </div>

            {/* Details card */}
            <div className="space-y-6">
              <div className="card p-8">
                <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-neutral-100">
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Timeline</p>
                    <p className="font-display text-lg text-neutral-900">{service.timeline}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Starting from</p>
                    <p className="font-display text-lg text-neutral-900">{service.starting}</p>
                  </div>
                </div>

                <h3 className="font-display text-lg text-neutral-900 mb-4">What's included</h3>
                <ul className="space-y-3 mb-8" role="list">
                  {service.deliverables.map((d) => (
                    <li key={d} className="flex items-start gap-2.5 text-sm text-neutral-700">
                      <CheckCircle2 size={15} className="text-brand-500 mt-0.5 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>

                <Link href={`/contact?service=${encodeURIComponent(service.title)}`} className="btn-primary w-full justify-center">
                  Get a Quote <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-y bg-neutral-50" aria-labelledby="faq-heading">
        <div className="container-site max-w-3xl">
          <h2 id="faq-heading" className="heading-2 mb-10 text-center">Frequently asked questions</h2>
          <div className="space-y-4">
            {service.faq.map((item) => (
              <details
                key={item.q}
                className="bg-white rounded-2xl border border-neutral-100 p-6 group"
              >
                <summary className="font-display text-lg text-neutral-900 cursor-pointer marker:hidden flex items-center justify-between gap-4 select-none">
                  {item.q}
                  <span className="text-neutral-400 text-xl shrink-0 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-neutral-600 text-sm leading-relaxed mt-4 pt-4 border-t border-neutral-100">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Related services */}
      {related.length > 0 && (
        <section className="section-y bg-white" aria-labelledby="related-heading">
          <div className="container-site">
            <h2 id="related-heading" className="heading-3 mb-8">Related services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/services/${r.slug}`}
                  className="group card p-6 flex items-start gap-4"
                >
                  <span className="text-2xl shrink-0" role="img" aria-label={r.title}>{r.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg text-neutral-900 group-hover:text-brand-600 transition-colors mb-1">
                      {r.title}
                    </h3>
                    <p className="text-sm text-neutral-500">{r.tagline}</p>
                  </div>
                  <ArrowRight size={16} className="text-neutral-300 group-hover:text-brand-600 shrink-0 mt-1 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBanner
        title={`Ready to start your ${service.title.toLowerCase()} project?`}
        subtitle="Let's talk — free 30-minute consultation."
      />
    </>
  );
}
