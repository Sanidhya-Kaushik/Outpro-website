// src/app/(public)/contact/page.tsx
import type { Metadata } from 'next';
import { ContactForm } from '@/components/sections/contact/ContactForm';
import { ContactInfo } from '@/components/sections/contact/ContactInfo';
import { SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with Outpro.India. Start a project, request a quote, or ask us anything. We reply within 24 hours.',
  openGraph: {
    title: 'Contact Outpro.India',
    description: 'Start your project today. We reply within 24 hours.',
  },
};

export default function ContactPage() {
  return (
    <div className="section-y">
      <div className="container-site">
        <div className="max-w-2xl mb-14">
          <p className="eyebrow mb-3">Get in touch</p>
          <h1 className="heading-1">Let's build something great together.</h1>
          <p className="body-lead mt-4">
            Tell us about your project. We'll reply within 24 hours on business days.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <ContactForm />
          </div>
          <div>
            <ContactInfo />
          </div>
        </div>
      </div>
    </div>
  );
}
