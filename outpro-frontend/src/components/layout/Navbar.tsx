// src/components/layout/Navbar.tsx
import Link from 'next/link';
import Image from 'next/image';
import { MobileMenu } from './MobileMenu';

const NAV_LINKS = [
  { label: 'About',        href: '/about' },
  { label: 'Services',     href: '/services' },
  { label: 'Portfolio',    href: '/portfolio' },
  { label: 'Testimonials', href: '/testimonials' },
  { label: 'Contact',      href: '/contact' },
];

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-100">
      <nav
        className="container-site flex items-center justify-between h-16 lg:h-18"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-lg"
          aria-label="Outpro.India — Home"
        >
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-display text-sm font-normal italic">
            O
          </div>
          <span className="font-display text-lg text-neutral-900">
            Outpro<span className="text-brand-600">.India</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <ul className="hidden lg:flex items-center gap-1" role="list">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="px-3 py-2 text-sm font-body font-medium text-neutral-600 rounded-lg
                           hover:text-neutral-900 hover:bg-neutral-50 transition-all duration-150
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* CTA + mobile trigger */}
        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className="hidden sm:inline-flex btn-primary text-sm"
          >
            Get in Touch
          </Link>
          <MobileMenu links={NAV_LINKS} />
        </div>
      </nav>
    </header>
  );
}
