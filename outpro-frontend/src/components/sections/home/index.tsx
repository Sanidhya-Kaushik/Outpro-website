// src/components/sections/home/StatsSection.tsx
'use client';

import { useIntersectionObserver, useCountUp } from '@/hooks';

const STATS = [
  { value: 150, suffix: '+', label: 'Projects Delivered',      description: 'Across 12+ industries' },
  { value: 8,   suffix: '+', label: 'Years Experience',        description: 'Since 2018' },
  { value: 95,  suffix: '%', label: 'Client Retention Rate',   description: 'Long-term partnerships' },
  { value: 40,  suffix: '+', label: 'Team Members',            description: 'Specialists & experts' },
];

function StatItem({ value, suffix, label, description, trigger }: (typeof STATS[0]) & { trigger: boolean }) {
  const count = useCountUp(value, 1800, trigger);
  return (
    <div className="text-center px-6 py-8 border-r border-neutral-100 last:border-r-0">
      <p className="font-display text-5xl lg:text-6xl text-brand-600 mb-2">
        {count}<span className="text-accent-500">{suffix}</span>
      </p>
      <p className="font-medium text-sm text-neutral-900 mb-1">{label}</p>
      <p className="text-xs text-neutral-500">{description}</p>
    </div>
  );
}

export function StatsSection() {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({ threshold: 0.3, once: true });
  return (
    <section className="bg-white border-y border-neutral-100 py-4" aria-label="Company statistics">
      <div ref={ref} className="container-site">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <StatItem key={s.label} {...s} trigger={isIntersecting} />
          ))}
        </div>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────

// src/components/sections/home/ServicesPreview.tsx
import Link from 'next/link';
import { ArrowUpRight, Globe, Smartphone, TrendingUp, Search, Palette, Megaphone } from 'lucide-react';
import { SectionHeading } from '@/components/ui';

const SERVICES = [
  { icon: Globe,       label: 'Web Development',  desc: 'Next.js, React, Headless CMS, eCommerce', href: '/services/website-development', color: 'text-blue-600 bg-blue-50' },
  { icon: Palette,     label: 'UI/UX Design',     desc: 'Figma, design systems, prototyping',       href: '/services/ui-ux-design',          color: 'text-purple-600 bg-purple-50' },
  { icon: Smartphone,  label: 'Mobile Apps',      desc: 'React Native, iOS, Android',               href: '/services/mobile-app',             color: 'text-green-600 bg-green-50' },
  { icon: Megaphone,   label: 'Digital Marketing',desc: 'Google Ads, Meta, LinkedIn',               href: '/services/digital-marketing',      color: 'text-orange-600 bg-orange-50' },
  { icon: Search,      label: 'SEO',              desc: 'Technical, on-page, link building',        href: '/services/seo',                    color: 'text-teal-600 bg-teal-50' },
  { icon: TrendingUp,  label: 'Branding',         desc: 'Strategy, identity, guidelines',           href: '/services/branding',               color: 'text-pink-600 bg-pink-50' },
];

export function ServicesPreview() {
  return (
    <section className="section-y bg-neutral-50" aria-labelledby="services-heading">
      <div className="container-site">
        <SectionHeading
          eyebrow="What we do"
          title="End-to-end digital services"
          subtitle="From strategy to execution — every discipline under one roof, so your project moves without friction."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className="group card p-6 flex flex-col gap-4 cursor-pointer hover:shadow-card-hover hover:-translate-y-1"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon size={20} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg text-neutral-900 mb-1 group-hover:text-brand-600 transition-colors">{s.label}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{s.desc}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-brand-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowUpRight size={12} />
              </div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/services" className="btn-secondary">
            View All Services
          </Link>
        </div>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────

// src/components/sections/home/PortfolioPreview.tsx
import Image from 'next/image';
import type { PortfolioProject } from '@/types';

interface Props { items: PortfolioProject[] }

export function PortfolioPreview({ items }: Props) {
  if (!items.length) return null;
  return (
    <section className="section-y" aria-labelledby="portfolio-heading">
      <div className="container-site">
        <SectionHeading
          eyebrow="Our work"
          title="Projects that moved the needle"
          subtitle="150+ projects delivered. Every industry. Proven results."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((project) => (
            <Link
              key={project.id}
              href={`/portfolio/${project.slug}`}
              className="group card overflow-hidden cursor-pointer"
            >
              <div className="relative overflow-hidden img-hover-zoom aspect-[4/3] bg-neutral-100">
                {project.coverImageId ? (
                  <Image
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media-public/${project.coverImageId}`}
                    alt={project.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
                    <span className="font-display text-3xl text-brand-400">{project.title[0]}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-brand-900/0 group-hover:bg-brand-900/40 transition-colors duration-300 flex items-end justify-end p-4">
                  <ArrowUpRight
                    size={24}
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                </div>
              </div>
              <div className="p-5">
                <span className="eyebrow text-[10px] mb-1 block">{project.category}</span>
                <h3 className="font-display text-lg text-neutral-900 group-hover:text-brand-600 transition-colors">{project.title}</h3>
                <p className="text-xs text-neutral-400 mt-1">{project.clientName}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/portfolio" className="btn-primary">
            View All Projects
          </Link>
        </div>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────

// src/components/sections/home/TestimonialsCarousel.tsx
'use client';

import { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { Testimonial } from '@/types';
import { Avatar, SectionHeading } from '@/components/ui';

interface Props { testimonials: Testimonial[] }

export function TestimonialsCarousel({ testimonials }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' }, [Autoplay({ delay: 4000 })]);
  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (!testimonials.length) return null;

  return (
    <section className="section-y bg-neutral-50" aria-labelledby="testimonials-heading">
      <div className="container-site">
        <div className="flex items-end justify-between mb-14">
          <SectionHeading
            eyebrow="Client stories"
            title="What our clients say"
            align="left"
            className="mb-0 max-w-lg"
          />
          <div className="hidden sm:flex items-center gap-2">
            <button onClick={prev} className="p-2 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-white transition-all" aria-label="Previous testimonial">
              <ChevronLeft size={18} />
            </button>
            <button onClick={next} className="p-2 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-white transition-all" aria-label="Next testimonial">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-hidden -mx-2" ref={emblaRef}>
          <div className="flex gap-4 px-2">
            {testimonials.map((t) => (
              <div key={t.id} className="flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] min-w-0">
                <div className="card p-6 h-full flex flex-col">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} className={i < t.starRating ? 'text-accent-500 fill-accent-500' : 'text-neutral-200 fill-neutral-200'} />
                    ))}
                  </div>
                  <blockquote className="text-sm text-neutral-700 leading-relaxed flex-1 italic mb-6">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-3 pt-4 border-t border-neutral-100">
                    <Avatar name={t.authorName} size="md" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{t.authorName}</p>
                      <p className="text-xs text-neutral-400">{t.authorTitle}{t.company ? ` · ${t.company}` : ''}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-10">
          <Link href="/testimonials" className="btn-secondary">View All Reviews</Link>
        </div>
      </div>
    </section>
  );
}
