// src/components/shared/CtaBanner.tsx
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface CtaBannerProps {
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export function CtaBanner({
  title = 'Ready to build your digital presence?',
  subtitle = "Let's discuss your project — free 30-minute consultation.",
  primaryLabel = 'Start a Project',
  primaryHref = '/contact',
  secondaryLabel = 'View Our Work',
  secondaryHref = '/portfolio',
}: CtaBannerProps) {
  return (
    <section
      className="relative overflow-hidden bg-brand-600 py-20 lg:py-28"
      aria-label="Call to action"
    >
      {/* Background decoration */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 100% 50%, rgba(245,166,35,0.15) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-white/5 -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />

      <div className="container-site relative z-10 text-center">
        <p className="eyebrow text-accent-400 mb-4">Work with us</p>
        <h2
          className="font-display text-4xl sm:text-5xl lg:text-6xl text-white mb-5"
          style={{ letterSpacing: '-0.025em' }}
        >
          {title}
        </h2>
        <p className="text-brand-200 text-lg mb-10 max-w-xl mx-auto">{subtitle}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-accent-500 text-neutral-900 font-medium text-sm hover:bg-accent-400 transition-all active:scale-[0.98] group"
          >
            {primaryLabel}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full border border-white/25 text-white/80 font-medium text-sm hover:border-white/40 hover:text-white hover:bg-white/5 transition-all active:scale-[0.98]"
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
