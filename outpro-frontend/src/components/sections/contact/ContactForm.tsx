// src/components/sections/contact/ContactForm.tsx
'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input, Textarea, Select, Button } from '@/components/ui';
import { contactFormSchema, type ContactFormValues } from '@/validators';
import { contactApi, ApiClientError } from '@/lib/api/client';
import { useToastStore } from '@/store';

const SERVICE_OPTIONS = [
  { value: 'Website Development', label: 'Website Development' },
  { value: 'UI/UX Design',        label: 'UI/UX Design' },
  { value: 'Mobile App',          label: 'Mobile App' },
  { value: 'Digital Marketing',   label: 'Digital Marketing' },
  { value: 'SEO',                 label: 'SEO' },
  { value: 'Branding',            label: 'Branding' },
  { value: 'Other',               label: 'Other' },
];

const BUDGET_OPTIONS = [
  { value: '₹50K – ₹2L',   label: '₹50K – ₹2L' },
  { value: '₹2L – ₹5L',    label: '₹2L – ₹5L' },
  { value: '₹5L – ₹15L',   label: '₹5L – ₹15L' },
  { value: '₹15L – ₹50L',  label: '₹15L – ₹50L' },
  { value: '₹50L+',         label: '₹50L+' },
  { value: 'Not sure yet',  label: 'Not sure yet' },
];

async function executeRecaptcha(action: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.grecaptcha) {
      resolve(''); // Skip in SSR or if not loaded
      return;
    }
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '', { action })
        .then(resolve)
        .catch(() => resolve(''));
    });
  });
}

// Augment window type
declare global {
  interface Window {
    grecaptcha: {
      ready: (fn: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { recaptchaToken: '' },
  });

  const messageVal = watch('message') ?? '';
  const charsLeft = 2000 - messageVal.length;

  const onSubmit = useCallback(
    async (data: ContactFormValues) => {
      try {
        const token = await executeRecaptcha('contact');
        await contactApi.submit({ ...data, recaptchaToken: token });
        setSubmitted(true);
      } catch (err) {
        if (err instanceof ApiClientError) {
          // Map API field errors back into the form
          if (err.details) {
            err.details.forEach((d) => {
              setError(d.field as keyof ContactFormValues, { message: d.issue });
            });
          } else {
            addToast({
              type: 'error',
              title: 'Submission failed',
              message: err.message,
              duration: 6000,
            });
          }
        } else {
          addToast({
            type: 'error',
            title: 'Something went wrong',
            message: 'Please try again in a moment.',
            duration: 6000,
          });
        }
      }
    },
    [setError, addToast],
  );

  if (submitted) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center text-center py-16 px-8 bg-green-50 rounded-2xl border border-green-200"
        >
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-5">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h2 className="font-display text-2xl text-neutral-900 mb-3">Message sent!</h2>
          <p className="text-neutral-600 max-w-sm leading-relaxed">
            Thank you for reaching out. We'll reply to your message within{' '}
            <strong>24 hours</strong> on business days.
          </p>
          <p className="text-sm text-neutral-400 mt-4">
            Urgent? Call us: <a href="tel:+919876543210" className="text-brand-600 hover:underline">+91 98765 43210</a>
          </p>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5"
      aria-label="Contact form"
    >
      {/* Name + Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Full name"
          required
          placeholder="Neha Kapoor"
          error={errors.fullName?.message}
          autoComplete="name"
          {...register('fullName')}
        />
        <Input
          label="Business email"
          type="email"
          required
          placeholder="neha@company.in"
          error={errors.businessEmail?.message}
          autoComplete="email"
          {...register('businessEmail')}
        />
      </div>

      {/* Company + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Company name"
          placeholder="TechStart Pvt Ltd"
          error={errors.companyName?.message}
          autoComplete="organization"
          {...register('companyName')}
        />
        <Input
          label="Phone number"
          type="tel"
          placeholder="+91 98765 43210"
          hint="E.164 format, e.g. +919876543210"
          error={errors.phoneNumber?.message}
          autoComplete="tel"
          {...register('phoneNumber')}
        />
      </div>

      {/* Service + Budget */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Service interest"
          placeholder="Select a service…"
          options={SERVICE_OPTIONS}
          error={errors.serviceInterest?.message}
          {...register('serviceInterest')}
        />
        <Select
          label="Budget range"
          placeholder="Select budget…"
          options={BUDGET_OPTIONS}
          error={errors.budgetRange?.message}
          {...register('budgetRange')}
        />
      </div>

      {/* Message */}
      <div>
        <Textarea
          label="Message"
          required
          rows={5}
          placeholder="Tell us about your project — goals, timeline, challenges…"
          error={errors.message?.message}
          {...register('message')}
        />
        <p className={`text-xs mt-1.5 text-right ${charsLeft < 100 ? 'text-amber-500' : 'text-neutral-400'}`}>
          {charsLeft} characters remaining
        </p>
      </div>

      {/* reCAPTCHA notice */}
      <p className="text-xs text-neutral-400">
        Protected by Google reCAPTCHA v3.{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-600">
          Privacy Policy
        </a>
      </p>

      <Button
        type="submit"
        size="lg"
        loading={isSubmitting}
        rightIcon={<Send size={16} />}
        className="w-full sm:w-auto"
      >
        Send Message
      </Button>
    </form>
  );
}
