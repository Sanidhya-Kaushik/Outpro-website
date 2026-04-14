// src/services/isr.service.ts
// Next.js ISR path mapping for Sanity CMS webhook revalidation

import { logger } from '../utils/logger';

const PATH_MAP: Record<string, (slug?: string) => string[]> = {
  portfolioProject: (slug) =>
    slug ? ['/portfolio', `/portfolio/${slug}`] : ['/portfolio'],
  testimonial: () => ['/', '/testimonials'],
  service: (slug) =>
    slug ? ['/', '/services', `/services/${slug}`] : ['/', '/services'],
  siteSettings: () => ['/'],
  teamMember: () => ['/about'],
  award: () => ['/about'],
};

export async function revalidatePath(
  contentType?: string,
  slug?: string,
): Promise<string[]> {
  const mapper = PATH_MAP[contentType ?? ''];
  const paths = mapper ? mapper(slug) : ['/'];

  logger.info('ISR revalidation triggered', { contentType, slug, paths });
  return paths;
}
