// src/app/(admin)/admin/settings/page.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Shield, Key, User, QrCode, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import { Input, Button } from '@/components/ui';
import { passwordChangeSchema, type PasswordChangeValues } from '@/validators';
import { authApi, ApiClientError } from '@/lib/api/client';
import { useAuthStore } from '@/store';
import { useToast } from '@/hooks';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'verify' | 'done'>('idle');
  const [totpCode, setTotpCode] = useState('');
  const [qrData, setQrData] = useState<{ qrCode: string; manualKey: string } | null>(null);

  // Password form
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeValues>({ resolver: zodResolver(passwordChangeSchema) });

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordChangeValues) => authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Password updated', 'You have been signed out on all other devices.');
      reset();
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === 'INVALID_CREDENTIALS') {
        setError('currentPassword', { message: 'Incorrect current password.' });
      } else {
        toast.error('Update failed', err instanceof Error ? err.message : undefined);
      }
    },
  });

  const setupMfaMutation = useMutation({
    mutationFn: () => authApi.mfaSetup(),
    onSuccess: (data) => {
      setQrData(data);
      setMfaStep('setup');
    },
    onError: () => toast.error('MFA setup failed'),
  });

  const verifyMfaMutation = useMutation({
    mutationFn: (code: string) => authApi.mfaVerify(code),
    onSuccess: () => {
      setMfaStep('done');
      toast.success('MFA enabled', 'Two-factor authentication is now active on your account.');
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === 'INVALID_TOTP') {
        toast.error('Invalid code', 'Check your authenticator app and try again.');
      } else {
        toast.error('Verification failed');
      }
    },
  });

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Profile section */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-neutral-100">
          <User size={16} className="text-neutral-400" />
          <h2 className="font-medium text-sm text-neutral-900">Profile</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center text-xl font-bold text-brand-700">
              {(user?.fullName ?? user?.email ?? 'A').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-neutral-900">{user?.fullName ?? 'No name set'}</p>
              <p className="text-sm text-neutral-500">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-medium border border-brand-100 capitalize">
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            To update your name or email, contact your super admin.
          </p>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-neutral-100">
          <Key size={16} className="text-neutral-400" />
          <h2 className="font-medium text-sm text-neutral-900">Change password</h2>
        </div>
        <form
          onSubmit={handleSubmit((data) => changePasswordMutation.mutate(data))}
          noValidate
          className="p-6 space-y-4"
        >
          <Input
            label="Current password"
            type="password"
            required
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <Input
            label="New password"
            type="password"
            required
            autoComplete="new-password"
            hint="Min 12 chars · uppercase · lowercase · digit · special character"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Input
            label="Confirm new password"
            type="password"
            required
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" loading={changePasswordMutation.isPending || isSubmitting}>
            Update password
          </Button>
        </form>
      </div>

      {/* MFA */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-neutral-100">
          <Shield size={16} className="text-neutral-400" />
          <h2 className="font-medium text-sm text-neutral-900">Two-factor authentication</h2>
        </div>
        <div className="p-6">
          {user?.mfaEnabled || mfaStep === 'done' ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle2 size={20} className="text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-900">MFA is enabled</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Your account is protected with TOTP two-factor authentication.
                </p>
              </div>
            </div>
          ) : mfaStep === 'idle' ? (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600 leading-relaxed">
                Add an extra layer of security. Use Google Authenticator, Authy, or any
                TOTP-compatible app.
              </p>
              <Button
                onClick={() => setupMfaMutation.mutate()}
                loading={setupMfaMutation.isPending}
                leftIcon={<QrCode size={15} />}
                variant="secondary"
              >
                Set up MFA
              </Button>
            </div>
          ) : mfaStep === 'setup' && qrData ? (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-neutral-900 mb-3">1. Scan this QR code</p>
                <div className="w-44 h-44 rounded-xl overflow-hidden border border-neutral-200 bg-white p-2">
                  <Image
                    src={qrData.qrCode}
                    alt="TOTP QR code"
                    width={160}
                    height={160}
                    unoptimized
                  />
                </div>
              </div>
              <div>
                <p className="text-sm text-neutral-500 mb-1">Or enter this key manually:</p>
                <code className="font-mono text-sm bg-neutral-100 px-3 py-1.5 rounded-lg text-neutral-900 select-all">
                  {qrData.manualKey}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900 mb-3">2. Enter verification code</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="input w-36 text-center font-mono tracking-[0.3em] text-lg"
                    aria-label="TOTP verification code"
                  />
                  <Button
                    onClick={() => verifyMfaMutation.mutate(totpCode)}
                    loading={verifyMfaMutation.isPending}
                    disabled={totpCode.length !== 6}
                  >
                    Verify & Enable
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
