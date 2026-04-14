// src/components/admin/LoginForm.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { Input, Button } from '@/components/ui';
import { loginFormSchema, type LoginFormValues } from '@/validators';
import { authApi, ApiClientError } from '@/lib/api/client';
import { useAuthStore } from '@/store';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [requireMfa, setRequireMfa] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      const result = await authApi.login({
        email: data.email,
        password: data.password,
        totpCode: data.totpCode ?? undefined,
      });
      setAuth(result);
      const from = searchParams.get('from') ?? '/admin/dashboard';
      router.push(from);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'MFA_REQUIRED') {
          setRequireMfa(true);
          return;
        }
        const messages: Record<string, string> = {
          INVALID_CREDENTIALS: 'Incorrect email or password.',
          INVALID_TOTP: 'Invalid or expired verification code.',
          ACCOUNT_LOCKED: 'Account temporarily locked. Try again later.',
          ACCOUNT_INACTIVE: 'This account has been deactivated.',
          RATE_LIMIT_EXCEEDED: 'Too many attempts. Please wait a minute.',
        };
        setServerError(messages[err.code] ?? err.message);
      } else {
        setServerError('Unable to connect. Please try again.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-label="Admin login form">
      {serverError && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20" role="alert">
          <Shield size={16} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-300">{serverError}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-1.5">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="arjun@outpro.india"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
            aria-invalid={errors.email ? 'true' : undefined}
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-red-400 mt-1.5" role="alert">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-neutral-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 pr-12 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
              aria-invalid={errors.password ? 'true' : undefined}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-400 mt-1.5" role="alert">{errors.password.message}</p>}
        </div>

        {requireMfa && (
          <div>
            <label htmlFor="totpCode" className="block text-sm font-medium text-neutral-300 mb-1.5">
              Authenticator code
            </label>
            <input
              id="totpCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-full rounded-xl border border-brand-700 bg-neutral-800 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all tracking-[0.3em] text-center font-mono"
              aria-invalid={errors.totpCode ? 'true' : undefined}
              aria-describedby="totp-hint"
              {...register('totpCode')}
            />
            <p id="totp-hint" className="text-xs text-neutral-500 mt-1.5">
              Enter the 6-digit code from your authenticator app.
            </p>
            {errors.totpCode && <p className="text-xs text-red-400 mt-1" role="alert">{errors.totpCode.message}</p>}
          </div>
        )}
      </div>

      <Button type="submit" loading={isSubmitting} className="w-full mt-6 rounded-xl" size="lg">
        {requireMfa ? 'Verify & Sign in' : 'Sign in'}
      </Button>
    </form>
  );
}
