// src/app/(public)/about/page.tsx
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2, Award, Users, Globe } from 'lucide-react';
import { SectionHeading } from '@/components/ui';
import { CtaBanner } from '@/components/shared/CtaBanner';

export const revalidate = 86400; // 24 h — team data changes rarely

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Outpro.India is a full-service digital agency based in New Delhi, India. ' +
    'Founded in 2018, we help businesses build digital presence that drives real growth.',
  openGraph: {
    title: 'About Outpro.India',
    description: 'Meet the team behind 150+ successful digital projects.',
    images: [{ url: '/og/about.jpg', width: 1200, height: 630 }],
  },
};

const VALUES = [
  {
    icon: '🎯',
    title: 'Results-first',
    description:
      'Every decision is anchored in measurable outcomes. We don\'t ship beautiful work that doesn\'t convert.',
  },
  {
    icon: '🔬',
    title: 'Evidence-based',
    description:
      'We use data, usability research, and real user feedback — not gut instinct — to guide our design choices.',
  },
  {
    icon: '🤝',
    title: 'True partnership',
    description:
      'We treat your project as our own. You get a team that cares deeply about what comes after launch.',
  },
  {
    icon: '⚡',
    title: 'Agile delivery',
    description:
      'Two-week sprints, transparent milestones, and weekly demos. You always know exactly where we stand.',
  },
  {
    icon: '🛡️',
    title: 'Security by design',
    description:
      'Performance and security are non-negotiable defaults, not afterthoughts bolted on at the end.',
  },
  {
    icon: '♾️',
    title: 'Long-term thinking',
    description:
      'We build systems that scale. Our average client engagement is 3+ years because the work keeps paying dividends.',
  },
];

const TEAM = [
  {
    name: 'Arjun Mehta',
    role: 'CEO & Founder',
    bio: '15 years in digital product. Previously Director of Engineering at a Series B FinTech startup.',
    initials: 'AM',
    color: 'bg-blue-100 text-blue-800',
  },
  {
    name: 'Priya Singh',
    role: 'CTO',
    bio: 'Full-stack engineer and system architect. Led engineering at two successful product exits.',
    initials: 'PS',
    color: 'bg-purple-100 text-purple-800',
  },
  {
    name: 'Rajan Desai',
    role: 'Creative Director',
    bio: 'Award-winning designer with roots in print and a decade of digital product design.',
    initials: 'RD',
    color: 'bg-amber-100 text-amber-800',
  },
  {
    name: 'Kavya Nair',
    role: 'Head of Growth',
    bio: 'Performance marketer who has managed ₹10Cr+ in ad spend across Google, Meta, and LinkedIn.',
    initials: 'KN',
    color: 'bg-pink-100 text-pink-800',
  },
  {
    name: 'Siddharth Rao',
    role: 'Lead Engineer',
    bio: 'Next.js and React specialist. Open source contributor, conference speaker.',
    initials: 'SR',
    color: 'bg-green-100 text-green-800',
  },
  {
    name: 'Ananya Iyer',
    role: 'Head of SEO',
    bio: 'Technical SEO strategist. Has taken 12+ brands from page 3 to top 3 in competitive verticals.',
    initials: 'AI',
    color: 'bg-teal-100 text-teal-800',
  },
];

const AWARDS = [
  { year: '2024', title: 'Best Digital Agency', body: 'WebAwards India' },
  { year: '2023', title: 'Google Premier Partner', body: 'Google' },
  { year: '2023', title: 'Top 10 Design Studios', body: 'NASSCOM' },
  { year: '2022', title: 'Clutch Top Developer', body: 'Clutch.co' },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="section-y bg-white" aria-labelledby="about-hero-heading">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="eyebrow mb-4">Who we are</p>
              <h1
                id="about-hero-heading"
                className="heading-1 mb-6"
              >
                Architects of digital growth — since 2018.
              </h1>
              <p className="body-lead mb-6">
                We started as a two-person studio in Delhi. Six years later, we're a
                40-strong team delivering end-to-end digital strategy, design, and
                engineering to businesses across India and beyond.
              </p>
              <p className="text-neutral-600 leading-relaxed mb-8">
                Our work spans industries — from FinTech dashboards to healthcare portals,
                from eCommerce brands to SaaS startups. The constant: we build digital
                presence that actually drives business results.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/portfolio" className="btn-primary">See Our Work</Link>
                <Link href="/contact" className="btn-secondary">Work With Us</Link>
              </div>
            </div>

            {/* Stats column */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Globe, value: '150+', label: 'Projects delivered', sub: 'Across 12+ industries' },
                { icon: Users, value: '40+', label: 'Team members', sub: 'Specialists & creatives' },
                { icon: CheckCircle2, value: '95%', label: 'Client retention', sub: 'Long-term partnerships' },
                { icon: Award, value: '8 yrs', label: 'In business', sub: 'Founded 2018, Delhi' },
              ].map((s) => (
                <div key={s.label} className="card p-6 flex flex-col gap-4">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                    <s.icon size={18} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="font-display text-3xl text-neutral-900">{s.value}</p>
                    <p className="text-sm font-medium text-neutral-700 mt-0.5">{s.label}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-y bg-neutral-50" aria-labelledby="values-heading">
        <div className="container-site">
          <SectionHeading
            id="values-heading"
            eyebrow="How we work"
            title="Values that guide every project"
            subtitle="These aren't aspirations. They're commitments baked into how we operate."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUES.map((v, i) => (
              <div
                key={v.title}
                className="bg-white rounded-2xl border border-neutral-100 p-6 hover:border-brand-200 hover:shadow-soft transition-all duration-300"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="text-2xl mb-3 block" role="img" aria-hidden="true">
                  {v.icon}
                </span>
                <h3 className="font-display text-lg text-neutral-900 mb-2">{v.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section-y bg-white" aria-labelledby="team-heading">
        <div className="container-site">
          <SectionHeading
            id="team-heading"
            eyebrow="The team"
            title="The people behind the work"
            subtitle="Senior practitioners — not juniors handed off to once the brief is signed."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TEAM.map((member) => (
              <article key={member.name} className="card p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${member.color}`}
                    aria-hidden="true"
                  >
                    {member.initials}
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-neutral-900 leading-snug">
                      {member.name}
                    </h3>
                    <p className="text-xs text-brand-600 font-medium">{member.role}</p>
                  </div>
                </div>
                <p className="text-sm text-neutral-500 leading-relaxed">{member.bio}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Awards */}
      <section className="section-y bg-neutral-50" aria-labelledby="awards-heading">
        <div className="container-site">
          <SectionHeading
            id="awards-heading"
            eyebrow="Recognition"
            title="Industry recognition"
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {AWARDS.map((a) => (
              <div
                key={a.title}
                className="bg-white rounded-2xl border border-neutral-100 p-6 text-center hover:border-accent-200 hover:shadow-soft transition-all"
              >
                <p className="text-xs font-medium text-neutral-400 mb-3">{a.year}</p>
                <p className="font-display text-lg text-neutral-900 mb-1 leading-snug">{a.title}</p>
                <p className="text-xs text-neutral-500">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        title="Ready to work together?"
        subtitle="We'd love to hear about your project."
        primaryLabel="Start the conversation"
      />
    </>
  );
}
