// src/services/storage.service.ts
// Supabase Storage adapter — upload, delete, signed URL generation

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function buildStoragePath(filename: string, mimeType: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const category = mimeType.startsWith('video/') ? 'videos'
    : mimeType.startsWith('image/') ? 'images'
    : 'documents';
  const sanitised = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${category}/${date}/${Date.now()}_${sanitised}`;
}

export const StorageService = {
  /**
   * Upload a file buffer to the private bucket (before virus scan).
   * Returns the storage path for later reference.
   */
  async uploadToPrivate(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
  ): Promise<string> {
    const path = buildStoragePath(originalFilename, mimeType);

    const { error } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET_PRIVATE)
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: false,
        duplex: 'half',
      });

    if (error) {
      logger.error('Supabase Storage upload failed', { path, error: error.message });
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    logger.info('File uploaded to private bucket', { path, mimeType, bytes: buffer.length });
    return path;
  },

  /**
   * Move a file from private → public bucket after a clean ClamAV scan.
   * Returns the public CDN URL.
   */
  async promoteToPublic(privatePath: string): Promise<string> {
    // Copy to public bucket
    const { error: copyError } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET_PRIVATE)
      .copy(privatePath, privatePath.replace('/', '/pub_'));

    if (copyError) {
      logger.error('Failed to copy to public bucket', { privatePath, error: copyError.message });
      throw new Error(`Storage promotion failed: ${copyError.message}`);
    }

    const publicPath = privatePath.replace('/', '/pub_');
    const { data } = supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET_PUBLIC)
      .getPublicUrl(publicPath);

    return data.publicUrl;
  },

  /**
   * Generate a short-lived signed URL for admin preview of private assets.
   */
  async getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET_PRIVATE)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data) {
      throw new Error(`Failed to generate signed URL: ${error?.message}`);
    }
    return data.signedUrl;
  },

  /**
   * Delete a file from both buckets (best-effort).
   */
  async delete(storagePath: string): Promise<void> {
    await Promise.allSettled([
      supabase.storage.from(env.SUPABASE_STORAGE_BUCKET_PRIVATE).remove([storagePath]),
      supabase.storage.from(env.SUPABASE_STORAGE_BUCKET_PUBLIC).remove([storagePath]),
    ]);
    logger.info('Storage file deleted', { storagePath });
  },
};
