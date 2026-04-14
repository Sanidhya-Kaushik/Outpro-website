// src/components/sections/testimonials/TestimonialsView.tsx
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, Play, X } from 'lucide-react';
import { Avatar, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Testimonial } from '@/types';

interface Props {
  testimonials: Testimonial[];
}

type Filter = 'all' | 'featured' | 'video' | '5star';

const FILTER_LABELS: Record<Filter, string> = {
  all:      'All reviews',
  featured: 'Featured',
  video:    'Video',
  '5star':  '5 stars only',
};

export function TestimonialsView({ testimonials }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [videoModal, setVideoModal] = useState<string | null>(null);

  const filtered = testimonials.filter((t) => {
    if (filter === 'featured') return t.isFeatured;
    if (filter === 'video')    return t.isVideoTestimonial;
    if (filter === '5star')    return t.starRating === 5;
    return true;
  });

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-10" role="group" aria-label="Filter testimonials">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150',
              f === filter
                ? 'bg-brand-600 text-white border-brand-600'
                : 'text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:bg-white',
            )}
            aria-pressed={f === filter}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState title="No reviews match this filter" />
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filtered.map((t, i) => (
              <motion.article
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="card p-6 flex flex-col gap-4"
              >
                {/* Stars */}
                <div className="flex gap-0.5" aria-label={`${t.starRating} out of 5 stars`}>
                  {[...Array(5)].map((_, idx) => (
                    <Star
                      key={idx}
                      size={14}
                      className={idx < t.starRating ? 'text-accent-500 fill-accent-500' : 'text-neutral-200 fill-neutral-200'}
                      aria-hidden="true"
                    />
                  ))}
                </div>

                {/* Video thumbnail */}
                {t.isVideoTestimonial && t.videoUrl && (
                  <button
                    onClick={() => setVideoModal(t.videoUrl!)}
                    className="group relative overflow-hidden rounded-xl bg-neutral-100 aspect-video flex items-center justify-center hover:bg-neutral-200 transition-colors"
                    aria-label={`Play video testimonial from ${t.authorName}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play size={20} className="text-white ml-1" />
                    </div>
                    <span className="absolute bottom-2 left-2 text-xs text-neutral-500 bg-white/80 px-2 py-0.5 rounded">
                      Video review
                    </span>
                  </button>
                )}

                {/* Quote */}
                <blockquote className="flex-1 text-sm text-neutral-700 leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                {/* Author */}
                <footer className="flex items-center gap-3 pt-4 border-t border-neutral-100">
                  <Avatar name={t.authorName} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{t.authorName}</p>
                    <p className="text-xs text-neutral-400 truncate">
                      {t.authorTitle}{t.company ? ` · ${t.company}` : ''}
                    </p>
                  </div>
                  {t.isFeatured && (
                    <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 text-[10px] font-medium border border-accent-100">
                      Featured
                    </span>
                  )}
                </footer>
              </motion.article>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Video modal */}
      <AnimatePresence>
        {videoModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Video testimonial"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl"
            >
              <button
                onClick={() => setVideoModal(null)}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                aria-label="Close video"
              >
                <X size={18} />
              </button>
              <iframe
                src={videoModal.replace('watch?v=', 'embed/').replace('player.vimeo.com/video', 'player.vimeo.com/video') + '?autoplay=1'}
                className="w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                title="Client video testimonial"
              />
            </motion.div>
            <button
              className="absolute inset-0 -z-10"
              onClick={() => setVideoModal(null)}
              aria-label="Close modal"
            />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
