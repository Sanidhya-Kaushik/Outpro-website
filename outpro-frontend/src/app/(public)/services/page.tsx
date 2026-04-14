// src/app/(public)/services/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SectionHeading } from '@/components/ui';
import { CtaBanner } from '@/components/shared/CtaBanner';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Website development, UI/UX design, mobile apps, SEO, digital marketing and branding. ' +
    'Full-service digital agency in Delhi, India.',
  openGraph: {
    title: 'Services | Outpro.India',
    description: 'End-to-end digital services for modern businesses.',
  },
};

const SERVICES = [
  {
    slug: 'website-development',
    emoji: '🌐',
    title: 'Website Development',
    tagline: 'Fast, accessible, built to convert.',
    description:
      'We build Next.js sites and React applications that score 95+ on PageSpeed — not as an afterthought, but as a baseline requirement. Every project ships with a CMS your team can actually use.',
    deliverables: [
      'Next.js 14 with App Router',
      'Headless CMS integration (Sanity, Contentful)',
      'Performance budget: < 2.5s LCP',
      'WCAG 2.1 AA accessibility',
      'Comprehensive SEO foundation',
      '3 months post-launch support',
    ],
    color: 'bg-blue-50 border-blue-100',
    accent: 'text-blue-600',
    timeline: '4–12 weeks',
    starting: '₹3L',
  },
  {
    slug: 'ui-ux-design',
    emoji: '🎨',
    title: 'UI/UX Design',
    tagline: 'Design systems that scale with your team.',
    description:
      'We combine user research, information architecture, and pixel-perfect Figma execution to deliver interfaces that users love and developers can implement efficiently.',
    deliverables: [
      'User research & usability testing',
      'Information architecture',
      'Figma design system',
      'Interactive prototype',
      'Developer handoff with specs',
      'WCAG 2.1 AA compliance audit',
    ],
    color: 'bg-purple-50 border-purple-100',
    accent: 'text-purple-600',
    timeline: '3–8 weeks',
    starting: '₹2L',
  },
  {
    slug: 'mobile-app',
    emoji: '📱',
    title: 'Mobile App Development',
    tagline: 'One codebase. iOS and Android.',
    description:
      'React Native applications that feel native on both platforms. We handle everything from architecture and API integration to App Store submission and ongoing maintenance.',
    deliverables: [
      'React Native (iOS + Android)',
      'Offline-first data architecture',
      'Push notifications',
      'Analytics integration',
      'App Store & Play Store submission',
      'CI/CD pipeline setup',
    ],
    color: 'bg-green-50 border-green-100',
    accent: 'text-green-600',
    timeline: '8–20 weeks',
    starting: '₹8L',
  },
  {
    slug: 'digital-marketing',
    emoji: '📣',
    title: 'Digital Marketing',
    tagline: 'Paid campaigns that pay for themselves.',
    description:
      'From Google Search to Meta Reels to LinkedIn ABM — we manage full-funnel paid campaigns with obsessive attention to ROAS. No vanity metrics. Only revenue-linked outcomes.',
    deliverables: [
      'Google Search, Display & Shopping',
      'Meta (Facebook & Instagram) Ads',
      'LinkedIn B2B campaigns',
      'Conversion rate optimisation',
      'Weekly performance reports',
      'Monthly strategy review',
    ],
    color: 'bg-orange-50 border-orange-100',
    accent: 'text-orange-600',
    timeline: 'Ongoing',
    starting: '₹75K/mo',
  },
  {
    slug: 'seo',
    emoji: '🔍',
    title: 'SEO',
    tagline: 'Organic visibility that compounds over time.',
    description:
      'Technical SEO, content strategy, and authority building that moves rankings and sustains them. We\'ve taken 12+ brands from page 3 to the top 3 positions in competitive verticals.',
    deliverables: [
      'Technical SEO audit & remediation',
      'Keyword research & content mapping',
      'On-page optimisation',
      'Core Web Vitals improvement',
      'Link building strategy',
      'Monthly ranking & traffic reports',
    ],
    color: 'bg-teal-50 border-teal-100',
    accent: 'text-teal-600',
    timeline: 'Ongoing (3-month min)',
    starting: '₹50K/mo',
  },
  {
    slug: 'branding',
    emoji: '✨',
    title: 'Branding',
    tagline: 'Identity that makes you impossible to ignore.',
    description:
      'Brand strategy, visual identity, and brand guidelines that give your business a distinctive point of view. We work from positioning strategy through to production-ready assets.',
    deliverables: [
      'Brand strategy & positioning',
      'Logo design (3 concepts)',
      'Full visual identity system',
      'Typography & colour palette',
      'Brand guidelines document',
      'Social & digital asset kit',
    ],
    color: 'bg-pink-50 border-pink-100',
    accent: 'text-pink-600',
    timeline: '4–8 weeks',
    starting: '₹2.5L',
  },
];

const PROCESS = [
  { step: '01', title: 'Discovery', desc: 'Deep-dive into your goals, constraints, and competitive landscape.' },
  { step: '02', title: 'Strategy', desc: 'A documented plan — deliverables, timeline, success metrics.' },
  { step: '03', title: 'Design', desc: 'Iterative design with your team\'s feedback built into every cycle.' },
  { step: '04', title: 'Build', desc: 'Engineering in two-week sprints with weekly demos and progress updates.' },
  { step: '05', title: 'Launch', desc: 'Staged rollout with monitoring, and post-launch optimisation.' },
];

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <section className="section-y bg-white">
        <div className="container-site max-w-4xl">
          <p className="eyebrow mb-4">What we do</p>
          <h1 className="heading-1 mb-6 text-balance">
            End-to-end digital services for businesses that mean business.
          </h1>
          <p className="body-lead mb-8">
            Six disciplines. One team. One accountability structure. No agency ping-pong
            between your web developers, your designers, and your SEO agency.
          </p>
          <Link href="/contact" className="btn-primary">
            Discuss Your Project <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Services grid */}
      <section className="section-y bg-neutral-50" aria-label="Our services">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {SERVICES.map((s) => (
              <article
                key={s.slug}
                className={`rounded-2xl border p-8 ${s.color} flex flex-col gap-5 hover:shadow-card transition-all duration-300`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl" role="img" aria-label={s.title}>{s.emoji}</span>
                  <div className="text-right">
                    <p className="text-xs text-neutral-400">{s.timeline}</p>
                    <p className="text-xs font-medium text-neutral-600">From {s.starting}</p>
                  </div>
                </div>

                <div>
                  <h2 className={`font-display text-2xl text-neutral-900 mb-1`}>{s.title}</h2>
                  <p className={`text-sm font-medium ${s.accent} mb-3`}>{s.tagline}</p>
                  <p className="text-sm text-neutral-600 leading-relaxed">{s.description}</p>
                </div>

                <ul className="space-y-2" role="list">
                  {s.deliverables.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-sm text-neutral-700">
                      <CheckCircle2 size={14} className={`${s.accent} mt-0.5 shrink-0`} />
                      {d}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/services/${s.slug}`}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${s.accent} mt-auto hover:underline group`}
                >
                  Learn more
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="section-y bg-white" aria-labelledby="process-heading">
        <div className="container-site">
          <SectionHeading
            id="process-heading"
            eyebrow="How we work"
            title="Our five-step process"
            subtitle="A predictable, transparent engagement model — no surprises."
          />
          <div className="relative">
            {/* Connector line (desktop) */}
            <div
              className="hidden lg:block absolute top-8 left-[5.5rem] right-[5.5rem] h-px bg-neutral-200"
              aria-hidden="true"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-8">
              {PROCESS.map((p) => (
                <div key={p.step} className="flex flex-col items-center text-center">
                  <div className="relative z-10 w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mb-4 shadow-glow">
                    <span className="font-mono text-sm font-bold text-white">{p.step}</span>
                  </div>
                  <h3 className="font-display text-lg text-neutral-900 mb-2">{p.title}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
