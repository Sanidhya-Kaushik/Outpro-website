// src/app/(public)/portfolio/page.tsx
import type { Metadata } from 'next';
import { portfolioApi } from '@/lib/api/client';
import { PortfolioGrid } from '@/components/sections/portfolio/PortfolioGrid';
import { CtaBanner } from '@/components/shared/CtaBanner';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Portfolio — Our Work',
  description: '150+ projects delivered across web development, branding, mobile apps, SEO and digital marketing. Browse our case studies.',
  openGraph: { title: 'Portfolio | Outpro.India', description: 'Browse 150+ projects across every industry.' },
};

export default async function PortfolioPage() {
  const [projectsData, categories] = await Promise.all([
    portfolioApi.list({ published: true, page: 1, limit: 9 }).catch(() => ({ items: [], pagination: { total: 0, totalPages: 1, page: 1, limit: 9 } })),
    portfolioApi.categories().catch(() => []),
  ]);

  return (
    <>
      <div className="section-y">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <p className="eyebrow mb-3">Our work</p>
            <h1 className="heading-1">150+ projects. Every industry.</h1>
            <p className="body-lead mt-4">Real results for real businesses. Browse case studies across web, mobile, design, and marketing.</p>
          </div>
          <PortfolioGrid
            initialItems={projectsData.items}
            initialPagination={projectsData.pagination}
            categories={categories}
          />
        </div>
      </div>
      <CtaBanner title="Impressed by our work?" subtitle="Let's create something great for your business." />
    </>
  );
}
