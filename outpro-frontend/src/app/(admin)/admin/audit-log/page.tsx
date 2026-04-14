// src/app/(admin)/admin/audit-log/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api/client';
import { Pagination, Skeleton, EmptyState } from '@/components/ui';
import { useDebounce } from '@/hooks';
import { timeAgo, formatDate } from '@/lib/utils';

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const debouncedAction = useDebounce(actionFilter, 400);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['audit-log', { page, action: debouncedAction }],
    queryFn: () =>
      adminApi.auditLog({
        page,
        limit: 50,
        action: debouncedAction || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  // Action colour coding
  const actionColor = (action: string): string => {
    if (action.includes('delete')) return 'text-red-600';
    if (action.includes('create')) return 'text-green-600';
    if (action.includes('login') || action.includes('logout')) return 'text-blue-600';
    if (action.includes('update') || action.includes('reorder')) return 'text-amber-600';
    return 'text-neutral-600';
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            placeholder="Filter by action…"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="input pl-9 h-9 text-xs"
          />
          {isFetching && !isLoading && (
            <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 animate-spin" />
          )}
        </div>
        {pagination && (
          <span className="text-xs text-neutral-400 ml-auto">
            {pagination.total.toLocaleString('en-IN')} entries
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No audit entries found" description="Audit entries will appear here as admin actions are performed." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  {['Time', 'Actor', 'Action', 'Target', 'IP'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs text-neutral-900">{timeAgo(entry.createdAt)}</p>
                      <p className="text-[10px] text-neutral-400">{formatDate(entry.createdAt, 'MMM d, HH:mm')}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-xs text-neutral-900 truncate">{entry.actorEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <code className={`text-xs font-mono ${actionColor(entry.action)}`}>
                        {entry.action}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      {entry.targetTable && (
                        <div>
                          <p className="text-xs text-neutral-600 font-mono">{entry.targetTable}</p>
                          {entry.targetId && (
                            <p className="text-[10px] text-neutral-400 font-mono truncate max-w-[120px]">
                              {entry.targetId.slice(0, 8)}…
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-neutral-400 font-mono">
                        {entry.ipAddress ?? '—'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
