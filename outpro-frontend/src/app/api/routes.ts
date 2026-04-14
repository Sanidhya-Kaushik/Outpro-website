// src/app/api/contact/route.ts
// BFF proxy — adds server-side reCAPTCHA verification before forwarding to backend

import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://www.outpro.india/api/v1';
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY ?? '';
const MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE ?? '0.5');

async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!token || !RECAPTCHA_SECRET) return false;
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token }),
  });
  const data = (await res.json()) as { success: boolean; score: number };
  return data.success && data.score >= MIN_SCORE;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const { recaptchaToken, ...leadData } = body;

    if (!recaptchaToken || typeof recaptchaToken !== 'string') {
      return NextResponse.json({ success: false, error: { code: 'CAPTCHA_REQUIRED', message: 'reCAPTCHA token is required' } }, { status: 400 });
    }

    const captchaOk = await verifyRecaptcha(recaptchaToken);
    if (!captchaOk) {
      return NextResponse.json({ success: false, error: { code: 'CAPTCHA_FAILED', message: 'reCAPTCHA verification failed' } }, { status: 403 });
    }

    const backendRes = await fetch(`${BACKEND}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': req.ip ?? '' },
      body: JSON.stringify({ ...leadData, recaptchaToken }),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } }, { status: 500 });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/revalidate/route.ts
// Sanity CMS ISR webhook

import { revalidatePath, revalidateTag } from 'next/cache';

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET ?? '';

const PATH_MAP: Record<string, (slug?: string) => string[]> = {
  portfolioProject: (slug) => slug ? ['/portfolio', `/portfolio/${slug}`] : ['/portfolio'],
  testimonial: () => ['/', '/testimonials'],
  service: (slug) => slug ? ['/', '/services', `/services/${slug}`] : ['/', '/services'],
  siteSettings: () => ['/'],
  teamMember: () => ['/about'],
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as { _type?: string; slug?: { current?: string } };
    const mapper = PATH_MAP[body._type ?? ''];
    const paths = mapper ? mapper(body.slug?.current) : ['/'];

    for (const path of paths) {
      revalidatePath(path);
    }

    return NextResponse.json({ revalidated: true, paths });
  } catch {
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/health/route.ts

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    version: process.env.npm_package_version ?? '1.0.0',
    timestamp: new Date().toISOString(),
  });
}
