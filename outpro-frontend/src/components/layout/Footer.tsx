// src/components/layout/Footer.tsx
import Link from 'next/link';

const SERVICES = [
  { label: 'Web Development',  href: '/services/website-development' },
  { label: 'UI/UX Design',     href: '/services/ui-ux-design' },
  { label: 'Mobile Apps',      href: '/services/mobile-app' },
  { label: 'Digital Marketing',href: '/services/digital-marketing' },
  { label: 'SEO',              href: '/services/seo' },
  { label: 'Branding',         href: '/services/branding' },
];

const COMPANY = [
  { label: 'About',        href: '/about' },
  { label: 'Portfolio',    href: '/portfolio' },
  { label: 'Testimonials', href: '/testimonials' },
  { label: 'Contact',      href: '/contact' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-neutral-950 text-neutral-400">
      <div className="container-site pt-16 pb-8">
        {/* Main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4" aria-label="Outpro.India">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-display text-sm italic">
                O
              </div>
              <span className="font-display text-lg text-white">
                Outpro<span className="text-brand-400">.India</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-neutral-500 mb-5">
              Building digital presence that drives real business growth.
              Delhi · India.
            </p>
            <address className="not-italic space-y-1">
              <p className="text-xs text-neutral-600">hello@outpro.india</p>
              <p className="text-xs text-neutral-600">+91 98765 43210</p>
            </address>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-4">
              Services
            </h3>
            <ul className="space-y-2.5" role="list">
              {SERVICES.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="text-sm text-neutral-500 hover:text-white transition-colors duration-150"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-4">
              Company
            </h3>
            <ul className="space-y-2.5" role="list">
              {COMPANY.map((c) => (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    className="text-sm text-neutral-500 hover:text-white transition-colors duration-150"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA column */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-4">
              Start a Project
            </h3>
            <p className="text-sm text-neutral-500 mb-5 leading-relaxed">
              Ready to build something great? Let's talk.
            </p>
            <Link href="/contact" className="btn-accent text-sm">
              Get a Free Estimate
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-600">
          <p>© {year} Outpro.India. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-neutral-400 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-neutral-400 transition-colors">
              Terms of Use
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
