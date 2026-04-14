// src/components/sections/portfolio/PortfolioGrid.tsx
'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Pagination, SkeletonCard, EmptyState } from '@/components/ui';
import { portfolioApi } from '@/lib/api/client';
import type { PortfolioProject, PaginationMeta } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  initialItems: PortfolioProject[];
  initialPagination: PaginationMeta;
  categories: Array<{ category: string; count: number }>;
}

export function PortfolioGrid({ initialItems, initialPagination, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['portfolio', { category: activeCategory, page }],
    queryFn: () => portfolioApi.list({ category: activeCategory, published: true, page, limit: 9 }),
    initialData: activeCategory === undefined && page === 1 ? { items: initialItems, pagination: initialPagination } : undefined,
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination ?? initialPagination;

  const handleCategory = (cat: string | undefined) => {
    startTransition(() => {
      setActiveCategory(cat);
      setPage(1);
    });
  };

  const allCategories = [
    { category: 'All', count: categories.reduce((sum, c) => sum + c.count, 0) },
    ...categories,
  ];

  return (
    <div>
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-10" role="group" aria-label="Filter by category">
        {allCategories.map((c) => (
          <button
            key={c.category}
            onClick={() => handleCategory(c.category === 'All' ? undefined : c.category)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border',
              (c.category === 'All' && !activeCategory) || c.category === activeCategory
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50',
            )}
            aria-pressed={c.category === 'All' ? !activeCategory : c.category === activeCategory}
          >
            {c.category}
            <span className="ml-1.5 text-xs opacity-60">{c.count}</span>
          </button>
        ))}
        {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-neutral-400 self-center ml-2" />}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No projects in this category"
          description="Try selecting a different filter or view all projects."
          action={<button onClick={() => handleCategory(undefined)} className="btn-secondary">View All</button>}
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {items.map((project, i) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link href={`/portfolio/${project.slug}`} className="group card block overflow-hidden h-full">
                  {/* Cover image */}
                  <div className="relative overflow-hidden img-hover-zoom bg-neutral-100 aspect-[4/3]">
                    {project.coverImageId ? (
                      <Image
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media-public/${project.coverImageId}`}
                        alt={project.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
                        <span className="font-display text-4xl text-brand-200">{project.title[0]}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium text-neutral-900">
                        View case study <ArrowUpRight size={12} />
                      </span>
                    </div>
                    {project.isFeatured && (
                      <div className="absolute top-3 left-3">
                        <span className="px-2 py-0.5 rounded-full bg-accent-500 text-neutral-900 text-xs font-medium">Featured</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <span className="eyebrow text-[10px] mb-1.5 block">{project.category}</span>
                    <h3 className="font-display text-lg text-neutral-900 group-hover:text-brand-600 transition-colors leading-snug mb-1">
                      {project.title}
                    </h3>
                    <p className="text-xs text-neutral-400">{project.clientName}</p>
                    {project.description && (
                      <p className="text-xs text-neutral-500 mt-2 line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-12">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
