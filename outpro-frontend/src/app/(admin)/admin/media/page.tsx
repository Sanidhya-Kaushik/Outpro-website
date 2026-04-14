// src/app/(admin)/admin/media/page.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, X, ImageIcon, FileText, Video, Loader2 } from 'lucide-react';
import { adminApi, ApiClientError } from '@/lib/api/client';
import { Button, Skeleton, EmptyState, ConfirmDialog, Badge } from '@/components/ui';
import { useToast } from '@/hooks';
import { formatBytes, timeAgo, scanStatusConfig, cn } from '@/lib/utils';
import type { MediaAsset } from '@/types';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf,video/mp4,video/quicktime';
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;

function MimeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <ImageIcon size={18} className="text-blue-500" />;
  if (mimeType.startsWith('video/')) return <Video size={18} className="text-purple-500" />;
  return <FileText size={18} className="text-neutral-400" />;
}

export default function MediaPage() {
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => adminApi.listMedia({ limit: 48 }),
    refetchInterval: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteMedia(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media'] });
      toast.success('Asset deleted');
      setDeleteTarget(null);
    },
    onError: (err) => toast.error('Delete failed', err instanceof Error ? err.message : undefined),
  });

  const uploadFile = useCallback(
    async (file: File) => {
      // Client-side size validation
      const maxMB = file.type.startsWith('video/') ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (file.size > maxMB * 1024 * 1024) {
        toast.error(`File too large`, `Maximum size: ${maxMB} MB`);
        return;
      }
      setUploading(true);
      try {
        await adminApi.uploadMedia(file);
        qc.invalidateQueries({ queryKey: ['media'] });
        toast.success('Upload complete', file.name);
      } catch (err) {
        toast.error(
          'Upload failed',
          err instanceof ApiClientError ? err.message : 'Please try again.',
        );
      } finally {
        setUploading(false);
      }
    },
    [qc, toast],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach(uploadFile);
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const items = data?.items ?? [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200',
          isDragging
            ? 'border-brand-400 bg-brand-50'
            : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          aria-label="Upload files"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-brand-600 animate-spin" />
            <p className="text-sm font-medium text-neutral-700">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm">
              <Upload size={22} className="text-neutral-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900">Drop files here or{' '}
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-brand-600 hover:text-brand-700 underline transition-colors"
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Images up to {MAX_IMAGE_MB} MB · Videos up to {MAX_VIDEO_MB} MB
              </p>
              <p className="text-xs text-neutral-400">
                JPEG, PNG, WebP, GIF, SVG, PDF, MP4, MOV
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {data && (
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span>{data.pagination.total} assets</span>
          <span>·</span>
          <span className="text-amber-600">
            {items.filter((a) => a.scanStatus === 'pending').length} pending scan
          </span>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ImageIcon size={24} />}
          title="No media assets"
          description="Upload images, videos, or documents using the drop zone above."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {items.map((asset) => {
            const scanCfg = scanStatusConfig[asset.scanStatus];
            const isImage = asset.mimeType.startsWith('image/');
            return (
              <div
                key={asset.id}
                className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 hover:border-neutral-300 transition-all"
              >
                {/* Preview */}
                {isImage && asset.publicUrl ? (
                  <img
                    src={asset.publicUrl}
                    alt={asset.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                    <MimeIcon mimeType={asset.mimeType} />
                    <p className="text-[10px] text-neutral-500 text-center truncate w-full px-1">
                      {asset.filename}
                    </p>
                  </div>
                )}

                {/* Scan status badge */}
                {asset.scanStatus !== 'clean' && (
                  <div className="absolute top-1.5 left-1.5">
                    <span className={cn('badge text-[9px]', scanCfg.className)}>
                      {scanCfg.label}
                    </span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-neutral-900/0 group-hover:bg-neutral-900/60 transition-colors flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <p className="text-[10px] text-white text-center px-2 truncate w-full">{asset.filename}</p>
                  <p className="text-[9px] text-white/60">{formatBytes(asset.fileSizeBytes)}</p>
                  <button
                    onClick={() => setDeleteTarget(asset)}
                    className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                    aria-label={`Delete ${asset.filename}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
        title="Delete media asset"
        message={`Permanently delete "${deleteTarget?.filename}"? This cannot be undone.`}
        confirmLabel="Delete asset"
      />
    </div>
  );
}
