// src/app/(admin)/login/page.tsx
import type { Metadata } from 'next';
import { LoginForm } from '@/components/admin/LoginForm';

export const metadata: Metadata = {
  title: 'Admin Login — Outpro.India',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4 text-white font-display text-xl italic">
            O
          </div>
          <h1 className="font-display text-2xl text-white mb-1">
            Outpro<span className="text-brand-400">.India</span>
          </h1>
          <p className="text-sm text-neutral-500">Admin Dashboard</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
          <h2 className="font-display text-xl text-white mb-6">Sign in</h2>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-neutral-600 mt-8">
          Protected by JWT + TOTP MFA · Rate limited to 10 req/min
        </p>
      </div>
    </div>
  );
}
