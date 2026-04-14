// src/components/admin/AdminTopBar.tsx
'use client';

import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useAuthStore } from '@/store';
import { Avatar } from '@/components/ui';

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard':   'Dashboard',
  '/admin/leads':       'Leads',
  '/admin/portfolio':   'Portfolio',
  '/admin/testimonials':'Testimonials',
  '/admin/media':       'Media Library',
  '/admin/users':       'Admin Users',
  '/admin/audit-log':   'Audit Log',
  '/admin/settings':    'Settings',
};

export function AdminTopBar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const title =
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ?? 'Admin';

  return (
    <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6 lg:px-8 shrink-0">
      <div>
        <h1 className="font-display text-xl text-neutral-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="relative p-2 rounded-xl text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <Avatar
            name={user?.fullName ?? user?.email ?? 'Admin'}
            size="sm"
          />
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-neutral-900">{user?.fullName ?? 'Admin'}</p>
            <p className="text-[10px] text-neutral-400 capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
