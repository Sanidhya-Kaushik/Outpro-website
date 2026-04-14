// src/lib/utils/index.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

/** Merge Tailwind classes without conflicts */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format date to readable string */
export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  return format(new Date(date), fmt);
}

/** Format relative time: "3 hours ago" */
export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/** Truncate text to maxLength with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/** Format file size in human-readable form */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format number with commas */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

/** Format currency in INR */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Slugify a string */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Generate initials from full name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Check if a URL is external */
export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

/** Lead status badge config */
export const leadStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  new:       { label: 'New',       className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  read:      { label: 'Read',      className: 'bg-neutral-50 text-neutral-600 border border-neutral-200' },
  replied:   { label: 'Replied',   className: 'bg-green-50 text-green-700 border border-green-200' },
  converted: { label: 'Converted', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

/** Scan status badge config */
export const scanStatusConfig: Record<string, { label: string; className: string }> = {
  pending:  { label: 'Scanning…', className: 'bg-blue-50 text-blue-600 border border-blue-200' },
  clean:    { label: 'Clean',     className: 'bg-green-50 text-green-700 border border-green-200' },
  infected: { label: 'Infected',  className: 'bg-red-50 text-red-700 border border-red-200' },
  error:    { label: 'Error',     className: 'bg-orange-50 text-orange-700 border border-orange-200' },
};
