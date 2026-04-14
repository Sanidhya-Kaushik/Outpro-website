// src/components/admin/AdminSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Briefcase, MessageSquareQuote,
  Image, Shield, ScrollText, Settings, LogOut, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks';
import type { AdminRole } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: AdminRole[];
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    href: '/admin/dashboard',   icon: LayoutDashboard,      roles: ['super_admin', 'editor', 'viewer'] },
  { label: 'Leads',        href: '/admin/leads',        icon: Users,               roles: ['super_admin', 'editor', 'viewer'] },
  { label: 'Portfolio',    href: '/admin/portfolio',    icon: Briefcase,            roles: ['super_admin', 'editor', 'viewer'] },
  { label: 'Testimonials', href: '/admin/testimonials', icon: MessageSquareQuote,   roles: ['super_admin', 'editor', 'viewer'] },
  { label: 'Media',        href: '/admin/media',        icon: Image,               roles: ['super_admin', 'editor', 'viewer'] },
  { label: 'Users',        href: '/admin/users',        icon: Shield,              roles: ['super_admin'] },
  { label: 'Audit Log',    href: '/admin/audit-log',    icon: ScrollText,          roles: ['super_admin', 'editor', 'viewer'] },
  { label: 'Settings',     href: '/admin/settings',     icon: Settings,            roles: ['super_admin', 'editor', 'viewer'] },
];

interface Props { role: AdminRole }

export function AdminSidebar({ role }: Props) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-60 bg-neutral-900 border-r border-neutral-800 h-full shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-neutral-800">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white font-display text-sm italic">
          O
        </div>
        <span className="font-display text-sm text-white">
          Outpro<span className="text-brand-400">.India</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto" aria-label="Admin navigation">
        <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-600 px-2 mb-2 mt-2">
          Main
        </p>
        <ul className="space-y-0.5" role="list">
          {visibleItems.slice(0, 5).map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
        <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-600 px-2 mb-2 mt-6">
          Admin
        </p>
        <ul className="space-y-0.5" role="list">
          {visibleItems.slice(5).map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-neutral-800">
        <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-neutral-800 transition-colors group cursor-default">
          <div className="w-7 h-7 rounded-lg bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-xs font-medium text-brand-400">
            {(user?.fullName ?? user?.email ?? 'A').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.fullName ?? 'Admin'}</p>
            <p className="text-[10px] text-neutral-500 truncate capitalize">{role.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 mt-1 rounded-xl text-xs text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-all"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 group',
          isActive
            ? 'bg-brand-600/15 text-brand-400 border border-brand-600/20'
            : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        <item.icon
          size={15}
          className={cn('shrink-0', isActive ? 'text-brand-400' : 'text-neutral-500 group-hover:text-neutral-300')}
        />
        <span className="flex-1 truncate font-body">{item.label}</span>
        {item.badge && (
          <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">
            {item.badge}
          </span>
        )}
        {isActive && <ChevronRight size={12} className="text-brand-500 shrink-0" />}
      </Link>
    </li>
  );
}
