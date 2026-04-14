// src/components/sections/contact/ContactInfo.tsx
import { Mail, Phone, MapPin, Clock } from 'lucide-react';

const INFO = [
  { icon: Mail,    label: 'Email',        value: 'hello@outpro.india',  href: 'mailto:hello@outpro.india' },
  { icon: Phone,   label: 'Phone',        value: '+91 98765 43210',     href: 'tel:+919876543210' },
  { icon: MapPin,  label: 'Address',      value: 'New Delhi, India 110001', href: undefined },
  { icon: Clock,   label: 'Office hours', value: 'Mon–Fri 9am–7pm IST', href: undefined },
];

export function ContactInfo() {
  return (
    <aside className="space-y-6">
      <div className="card p-6 space-y-5">
        <h2 className="font-display text-xl text-neutral-900">Get in touch</h2>
        {INFO.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
              <item.icon size={16} className="text-brand-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-0.5">{item.label}</p>
              {item.href ? (
                <a href={item.href} className="text-sm font-medium text-neutral-900 hover:text-brand-600 transition-colors">
                  {item.value}
                </a>
              ) : (
                <p className="text-sm font-medium text-neutral-900">{item.value}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden border border-neutral-200 h-52 bg-neutral-100 flex items-center justify-center">
        <p className="text-xs text-neutral-400">Google Maps embed</p>
      </div>

      <div className="card p-5 bg-brand-50 border-brand-100">
        <p className="text-sm font-medium text-brand-900 mb-1">Quick response guaranteed</p>
        <p className="text-xs text-brand-700 leading-relaxed">
          We reply to every message within 24 hours on business days. For urgent enquiries, call us directly.
        </p>
      </div>
    </aside>
  );
}
