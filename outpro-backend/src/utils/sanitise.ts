// src/utils/sanitise.ts
// Input sanitisation utilities — strips HTML to prevent XSS before any DB write

import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const { window } = new JSDOM('');
const purify = DOMPurify(window as unknown as Window & typeof globalThis);

/**
 * Strip all HTML tags and sanitise a string value.
 * Collapses multiple whitespace and trims.
 */
export function sanitiseString(input: string): string {
  const cleaned = purify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Sanitise an object's string fields in-place.
 * Non-string fields are left unchanged.
 */
export function sanitiseObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      (result as any)[key] = sanitiseString(result[key] as string) as T[typeof key];
    }
  }
  return result;
}

/**
 * Mask an IP address for non-admin users (partial redaction).
 * "192.168.1.100" → "192.168.x.x"
 */
export function redactIp(ip: string | null): string | null {
  if (!ip) return null;
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  // IPv6 — redact last 4 segments
  const v6parts = ip.split(':');
  if (v6parts.length > 4) {
    return v6parts.slice(0, 4).join(':') + ':xxxx:xxxx:xxxx:xxxx';
  }
  return '**redacted**';
}

/**
 * Constant-time string comparison (prevents timing attacks on secret comparison).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare anyway to avoid leaking length info
    let result = 1;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      result |= (a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length));
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return result === 0;
}
