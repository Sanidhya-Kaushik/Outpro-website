// src/app/(public)/testimonials/page.tsx
import type { Metadata } from 'next';
import { testimonialsApi } from '@/lib/api/client';
import { TestimonialsView } from '@/components/sections/testimonials/TestimonialsView';
import { CtaBanner } from '@/components/shared/CtaBanner';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Client Reviews & Testimonials',
  description:
    'See what our clients say about working with Outpro.India. ' +
    '18 reviews, 4.8★ average rating. Real results from real businesses.',
  openGraph: {
    title: 'Client Testimonials | Outpro.India',
    description: '4.8★ average across 18 client reviews.',
  },
};

async function getData() {
  const [testimonialsData, stats] = await Promise.all([
    testimonialsApi.list({ sortBy: 'displayOrder', limit: 20 }).catch(() => ({
      items: [],
      pagination: { total: 0, totalPages: 1, page: 1, limit: 20 },
    })),
    testimonialsApi.getStats().catch(() => ({
      total: 0,
      avgRating: 0,
      featuredCount: 0,
      videoCount: 0,
      byRating: {},
    })),
  ]);
  return { testimonials: testimonialsData.items, stats };
}

export default async function TestimonialsPage() {
  const { testimonials, stats } = await getData();

  return (
    <>
      {/* Hero */}
      <section className="section-y bg-white">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <p className="eyebrow mb-4">Client stories</p>
            <h1 className="heading-1 mb-5">What our clients say.</h1>
            <p className="body-lead">
              Real feedback from real businesses. We let the results speak.
            </p>
          </div>

          {/* Stats row */}
          {stats.total > 0 && (
            <div className="flex flex-wrap gap-6 pb-12 border-b border-neutral-100">
              <div>
                <p className="font-display text-4xl text-neutral-900">{stats.avgRating}★</p>
                <p className="text-sm text-neutral-500 mt-1">Average rating</p>
              </div>
              <div className="w-px bg-neutral-100" />
              <div>
                <p className="font-display text-4xl text-neutral-900">{stats.total}</p>
                <p className="text-sm text-neutral-500 mt-1">Total reviews</p>
              </div>
              <div className="w-px bg-neutral-100" />
              <div>
                <p className="font-display text-4xl text-neutral-900">{stats.videoCount}</p>
                <p className="text-sm text-neutral-500 mt-1">Video testimonials</p>
              </div>
              {/* Rating breakdown */}
              <div className="flex-1 min-w-48">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = stats.byRating[rating] ?? 0;
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={rating} className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-neutral-400 w-4 text-right">{rating}</span>
                      <span className="text-accent-400 text-xs">★</span>
                      <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-400 w-6">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials list */}
      <section className="section-y bg-neutral-50">
        <div className="container-site">
          <TestimonialsView testimonials={testimonials} />
        </div>
      </section>

      <CtaBanner
        title="Ready to become our next success story?"
        subtitle="Let's discuss your project — free consultation."
      />
    </>
  );
}
