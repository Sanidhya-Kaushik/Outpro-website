// src/app/(public)/page.tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HeroSection } from '@/components/sections/home/HeroSection';
import { StatsSection } from '@/components/sections/home/StatsSection';
import { ServicesPreview } from '@/components/sections/home/ServicesPreview';
import { PortfolioPreview } from '@/components/sections/home/PortfolioPreview';
import { TestimonialsCarousel } from '@/components/sections/home/TestimonialsCarousel';
import { CtaBanner } from '@/components/shared/CtaBanner';
import { SkeletonCard } from '@/components/ui';
import { portfolioApi, testimonialsApi } from '@/lib/api/client';

export const revalidate = 3600; // ISR — revalidate every hour

export const metadata: Metadata = {
  title: 'Outpro.India — Corporate Digital Presence Platform',
  description:
    'We build digital presence that drives real business growth. ' +
    'Website Development, UI/UX Design, SEO, Digital Marketing and Mobile Apps — Delhi, India.',
  openGraph: {
    title: 'Outpro.India — Corporate Digital Presence Platform',
    description: 'Digital presence that drives real business growth — Delhi, India.',
    images: [{ url: '/og/home.jpg', width: 1200, height: 630 }],
  },
};

async function getFeaturedPortfolio() {
  try {
    const data = await portfolioApi.list({ featured: true, published: true, limit: 3 });
    return data.items;
  } catch {
    return [];
  }
}

async function getFeaturedTestimonials() {
  try {
    const data = await testimonialsApi.list({ featured: true, limit: 3 });
    return data.items;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [portfolioItems, testimonials] = await Promise.all([
    getFeaturedPortfolio(),
    getFeaturedTestimonials(),
  ]);

  return (
    <>
      <HeroSection />
      <StatsSection />
      <ServicesPreview />
      <Suspense fallback={<div className="section-y container-site grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>}>
        <PortfolioPreview items={portfolioItems} />
      </Suspense>
      <Suspense fallback={<div className="section-y bg-neutral-50" />}>
        <TestimonialsCarousel testimonials={testimonials} />
      </Suspense>
      <CtaBanner />
    </>
  );
}
