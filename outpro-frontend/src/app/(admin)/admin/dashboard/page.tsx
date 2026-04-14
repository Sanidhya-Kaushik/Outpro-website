// src/app/(admin)/admin/dashboard/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  TrendingUp, Users, Briefcase, Star, HardDrive,
  ArrowUpRight, BarChart2, Activity,
} from 'lucide-react';
import { adminApi } from '@/lib/api/client';
import { StatCard, Badge, Skeleton, Avatar } from '@/components/ui';
import { formatDate, timeAgo, leadStatusConfig, cn } from '@/lib/utils';
import type { DashboardKpis } from '@/types';

type Period = '7d' | '30d' | '90d';

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => adminApi.dashboard(period),
    refetchInterval: 60_000, // Refresh every minute
  });

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-neutral-900">Overview</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Performance metrics at a glance.</p>
        </div>
        <div className="flex rounded-xl border border-neutral-200 bg-white overflow-hidden">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-4 py-2 text-xs font-medium transition-all duration-150',
                p === period
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="New leads"
              value={data?.leads.new ?? 0}
              delta={`${data?.leads.total ?? 0} total`}
            />
            <StatCard
              label="Conversion rate"
              value={`${data?.leads.conversionRate ?? 0}%`}
              delta={`${data?.leads.converted ?? 0} converted`}
              deltaPositive
            />
            <StatCard
              label="Avg rating"
              value={`${data?.testimonials.avgRating ?? 0}★`}
              delta={`${data?.testimonials.total ?? 0} reviews`}
              deltaPositive
            />
            <StatCard
              label="Portfolio views"
              value={data?.portfolio.totalViews?.toLocaleString('en-IN') ?? 0}
              delta={`${data?.portfolio.total ?? 0} projects`}
            />
          </>
        )}
      </div>

      {/* Secondary metrics */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: TrendingUp,  label: 'Total leads',    value: data.leads.total,          href: '/admin/leads' },
            { icon: Briefcase,   label: 'Projects',       value: data.portfolio.total,       href: '/admin/portfolio' },
            { icon: Star,        label: 'Testimonials',   value: data.testimonials.total,    href: '/admin/testimonials' },
            { icon: HardDrive,   label: 'Media assets',   value: data.media.totalAssets,     href: '/admin/media' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group flex items-center gap-3 p-4 bg-white rounded-xl border border-neutral-200 hover:border-brand-200 hover:shadow-sm transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <item.icon size={15} className="text-brand-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">{item.label}</p>
                <p className="font-display text-lg text-neutral-900">{item.value}</p>
              </div>
              <ArrowUpRight size={14} className="text-neutral-300 group-hover:text-brand-500 ml-auto shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent leads */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-neutral-400" />
              <h3 className="font-medium text-sm text-neutral-900">Recent leads</h3>
            </div>
            <Link href="/admin/leads" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              View all →
            </Link>
          </div>
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <ul role="list">
              {data?.recentLeads.map((lead) => {
                const cfg = leadStatusConfig[lead.status];
                return (
                  <li key={lead.id}>
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors group"
                    >
                      <Avatar name={lead.fullName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate group-hover:text-brand-600 transition-colors">
                          {lead.fullName}
                        </p>
                        <p className="text-xs text-neutral-400 truncate">{lead.businessEmail}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('badge text-[10px]', cfg.className)}>{cfg.label}</span>
                        <span className="text-xs text-neutral-300">{timeAgo(lead.createdAt)}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
              {data?.recentLeads.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-neutral-400">No leads yet.</li>
              )}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-neutral-400" />
              <h3 className="font-medium text-sm text-neutral-900">Recent activity</h3>
            </div>
            <Link href="/admin/audit-log" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              Full log →
            </Link>
          </div>
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-9" />)}
            </div>
          ) : (
            <ul role="list" className="divide-y divide-neutral-50">
              {data?.recentActivity.map((entry, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-6 h-6 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-neutral-700 truncate">{entry.action}</p>
                    <p className="text-[10px] text-neutral-400">{entry.actorEmail}</p>
                  </div>
                  <span className="text-[10px] text-neutral-300 shrink-0">{timeAgo(entry.createdAt)}</span>
                </li>
              ))}
              {data?.recentActivity.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-neutral-400">No activity yet.</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Media + storage summary */}
      {!isLoading && data && data.media.pendingScan > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <HardDrive size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{data.media.pendingScan}</strong> media asset{data.media.pendingScan > 1 ? 's are' : ' is'} pending virus scan.{' '}
            <Link href="/admin/media" className="underline hover:no-underline">
              View media library →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
