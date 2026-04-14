// src/components/sections/home/HeroSection.tsx
'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, PlayCircle } from 'lucide-react';

const WORDS = ['Websites', 'Brands', 'Experiences', 'Products', 'Futures'];

export function HeroSection() {
  const wordRef = useRef<HTMLSpanElement>(null);
  const wordIdx = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function cycle() {
      const el = wordRef.current;
      if (!el) return;

      // Fade out
      el.style.transition = 'opacity 300ms, transform 300ms';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';

      timer = setTimeout(() => {
        wordIdx.current = (wordIdx.current + 1) % WORDS.length;
        el.textContent = WORDS[wordIdx.current];
        el.style.transform = 'translateY(8px)';
        el.style.opacity = '0';

        // Fade in
        requestAnimationFrame(() => {
          el.style.transition = 'opacity 300ms, transform 300ms';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        });

        timer = setTimeout(cycle, 2600);
      }, 300);
    }

    timer = setTimeout(cycle, 2600);
    return () => clearTimeout(timer);
  }, []);

  const stagger = {
    container: { animate: { transition: { staggerChildren: 0.12 } } },
    item: {
      initial: { opacity: 0, y: 24 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
    },
  };

  return (
    <section
      className="relative min-h-[90vh] flex items-center overflow-hidden bg-neutral-950"
      aria-label="Hero"
    >
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" aria-hidden="true" />

      {/* Radial gradient spotlight */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(15,76,129,0.35) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Accent orb bottom-right */}
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #F5A623 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="container-site relative z-10 py-28 lg:py-40">
        <motion.div
          variants={stagger.container}
          initial="initial"
          animate="animate"
          className="max-w-4xl"
        >
          {/* Eyebrow */}
          <motion.div variants={stagger.item} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-600/30 bg-brand-600/10 text-xs font-medium text-brand-300 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse-slow" />
              Delhi · India · Est. 2018
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={stagger.item}
            className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-white leading-[1.05] mb-6"
            style={{ letterSpacing: '-0.035em' }}
          >
            We build digital{' '}
            <span
              ref={wordRef}
              className="text-accent-400 inline-block"
              style={{
                opacity: 1,
                transform: 'translateY(0)',
                minWidth: '6ch',
                display: 'inline-block',
              }}
              aria-live="polite"
              aria-atomic="true"
            >
              {WORDS[0]}
            </span>
            <br className="hidden sm:block" />
            that drive growth.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={stagger.item}
            className="text-lg sm:text-xl text-neutral-400 font-light leading-relaxed max-w-2xl mb-10"
          >
            Website Development · UI/UX Design · Mobile Apps · SEO · Branding.{' '}
            <span className="text-neutral-300">150+ projects delivered.</span>
          </motion.p>

          {/* CTAs */}
          <motion.div variants={stagger.item} className="flex flex-wrap items-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-accent-500 text-neutral-900 font-medium text-sm hover:bg-accent-400 transition-all duration-150 active:scale-[0.98] group"
            >
              Start Your Project
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full border border-white/20 text-white/80 font-medium text-sm hover:border-white/40 hover:text-white hover:bg-white/5 transition-all duration-150 active:scale-[0.98] group"
            >
              <PlayCircle size={16} className="text-white/60 group-hover:text-white/80" />
              View Our Work
            </Link>
          </motion.div>

          {/* Social proof bar */}
          <motion.div
            variants={stagger.item}
            className="flex flex-wrap items-center gap-6 mt-14 pt-10 border-t border-white/10"
          >
            {[
              { value: '150+', label: 'Projects' },
              { value: '8 yrs', label: 'Experience' },
              { value: '95%', label: 'Retention' },
              { value: '4.8★', label: 'Rating' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-2xl text-white">{stat.value}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        aria-hidden="true"
      >
        <span className="text-xs text-neutral-600 tracking-widest uppercase">Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-neutral-600 to-transparent animate-float" />
      </motion.div>
    </section>
  );
}
