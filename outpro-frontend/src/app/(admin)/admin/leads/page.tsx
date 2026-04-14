// src/app/(admin)/admin/leads/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, ChevronRight, Loader2 } from 'lucide-react';
import { Input, Pagination, Badge, Skeleton, EmptyState, ConfirmDialog } from '@/components/ui';
import { contactApi, ApiClientError } from '@/lib/api/client';
import { useDebounce, useToast } from '@/hooks';
import { leadStatusConfig, timeAgo, cn } from '@/lib/utils';
import type { LeadStatus, ContactLead } from '@/types';

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'replied', label: 'Replied' },
  { value: 'converted', label: 'Converted' },
];

export default function LeadsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ContactLead | null>(null);
  const debouncedSearch = useDebounce(search, 350);
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['leads', { page, search: debouncedSearch, status: statusFilter }],
    queryFn: () =>
      contactApi.getLeads({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        sortBy: 'createdAt',
        sortDir: 'desc',
      }),
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      contactApi.updateLead(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['leads'] });
      const prev = qc.getQueryData(['leads', { page, search: debouncedSearch, status: statusFilter }]);
      qc.setQueryData(
        ['leads', { page, search: debouncedSearch, status: statusFilter }],
        (old: typeof data) =>
          old ? { ...old, items: old.items.map((l) => l.id === id ? { ...l, status } : l) } : old,
      );
      return { prev };
    },
    onError: (err, _, ctx) => {
      qc.setQueryData(['leads', { page, search: debouncedSearch, status: statusFilter }], ctx?.prev);
      toast.error('Update failed', err instanceof Error ? err.message : 'Try again');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactApi.deleteLead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted');
      setDeleteTarget(null);
    },
    onError: (err) => toast.error('Delete failed', err instanceof Error ? err.message : undefined),
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                f.value === statusFilter
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            placeholder="Search name, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input pl-9 h-9 text-xs"
          />
          {isFetching && (
            <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No leads found" description={search ? 'Try a different search term.' : 'Leads will appear here when someone submits the contact form.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  {['Name', 'Email', 'Service', 'Status', 'Received', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map((lead) => {
                  const cfg = leadStatusConfig[lead.status];
                  return (
                    <tr key={lead.id} className="hover:bg-neutral-50 transition-colors group">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-neutral-900">{lead.fullName}</p>
                        {lead.companyName && <p className="text-xs text-neutral-400">{lead.companyName}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500 truncate max-w-[160px]">{lead.businessEmail}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500">{lead.serviceInterest ?? '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onChange={(e) => updateMutation.mutate({ id: lead.id, status: e.target.value as LeadStatus })}
                          className={cn('badge text-[10px] cursor-pointer border-0 outline-none bg-transparent', cfg.className)}
                          aria-label={`Status for ${lead.fullName}`}
                        >
                          {Object.entries(leadStatusConfig).map(([val, c]) => (
                            <option key={val} value={val}>{c.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-400">{timeAgo(lead.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/admin/leads/${lead.id}`}
                            className="p-1 rounded text-neutral-400 hover:text-brand-600 transition-colors"
                            aria-label={`View ${lead.fullName}`}
                          >
                            <ChevronRight size={14} />
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(lead)}
                            className="p-1 rounded text-neutral-400 hover:text-red-500 transition-colors text-xs"
                            aria-label={`Delete lead from ${lead.fullName}`}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            {pagination.total} leads · Page {pagination.page} of {pagination.totalPages}
          </p>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
        title="Delete lead"
        message={`Permanently delete the lead from ${deleteTarget?.fullName}? This cannot be undone.`}
        confirmLabel="Delete lead"
      />
    </div>
  );
}
