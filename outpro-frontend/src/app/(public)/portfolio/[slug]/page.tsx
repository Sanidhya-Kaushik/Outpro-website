// src/app/(public)/portfolio/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ExternalLink, Eye, Calendar } from 'lucide-react';
import { portfolioApi } from '@/lib/api/client';
import { CtaBanner } from '@/components/shared/CtaBanner';
import { formatDate } from '@/lib/utils';

export const revalidate = 1800;

// generateStaticParams — pre-renders all published slugs at build time
export async function generateStaticParams() {
  try {
    const data = await portfolioApi.list({ published: true, limit: 100 });
    return data.items.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  try {
    const project = await portfolioApi.getBySlug(params.slug);
    return {
      title: `${project.title} — Portfolio`,
      description: project.description
        ? project.description.slice(0, 155)
        : `${project.title} — a project by Outpro.India for ${project.clientName}.`,
      openGraph: {
        title: project.title,
        description: project.description ?? `A ${project.category} project for ${project.clientName}.`,
      },
    };
  } catch {
    return { title: 'Project Not Found' };
  }
}

// Placeholder result metrics (in production these would come from Sanity CMS)
const MOCK_RESULTS = [
  { label: 'Organic traffic', value: '+180%', context: 'in 4 months' },
  { label: 'PageSpeed score', value: '97',    context: 'desktop' },
  { label: 'Conversion rate', value: '3×',    context: 'improvement' },
  { label: 'Delivered in',    value: '6 wks', context: 'on budget' },
];

export default async function CaseStudyPage({
  params,
}: {
  params: { slug: string };
}) {
  let project;
  try {
    project = await portfolioApi.getBySlug(params.slug);
  } catch {
    notFound();
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-neutral-50 border-b border-neutral-100 py-3">
        <div className="container-site">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-neutral-500">
            <Link href="/" className="hover:text-neutral-900 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/portfolio" className="hover:text-neutral-900 transition-colors">Portfolio</Link>
            <span>/</span>
            <span className="text-neutral-900" aria-current="page">{project.title}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="section-y bg-white">
        <div className="container-site">
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 mb-10 transition-colors group"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            All projects
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Main content */}
            <div className="lg:col-span-2">
              <p className="eyebrow mb-3">{project.category}</p>
              <h1 className="heading-1 mb-4">{project.title}</h1>
              <p className="text-lg text-neutral-600 mb-8 leading-relaxed">
                {project.description ?? `A ${project.category.toLowerCase()} project for ${project.clientName}.`}
              </p>

              {/* Cover image */}
              <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-gradient-to-br from-brand-50 to-brand-100 mb-10">
                {project.coverImageId ? (
                  <Image
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media-public/${project.coverImageId}`}
                    alt={`${project.title} cover image`}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 66vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display text-6xl text-brand-200">{project.title[0]}</span>
                  </div>
                )}
              </div>

              {/* Case study body — in production this is PortableText from Sanity */}
              <div className="prose prose-neutral max-w-none">
                <h2 className="font-display text-2xl text-neutral-900 mb-4">The challenge</h2>
                <p className="text-neutral-600 leading-relaxed mb-6">
                  {project.clientName} needed a modern digital presence that could handle their growth trajectory
                  while maintaining the brand equity they'd built over the years. Their existing solution was
                  slow, hard to update, and wasn't converting visitors into leads.
                </p>

                <h2 className="font-display text-2xl text-neutral-900 mb-4">Our approach</h2>
                <p className="text-neutral-600 leading-relaxed mb-6">
                  We started with a two-week discovery sprint — user interviews, analytics review, and
                  competitive analysis — before writing a single line of code. The insights shaped every
                  architectural and design decision that followed.
                </p>

                <h2 className="font-display text-2xl text-neutral-900 mb-4">The result</h2>
                <p className="text-neutral-600 leading-relaxed">
                  A performant, accessible, and maintainable digital platform that their team now owns
                  confidently. The numbers speak for themselves.
                </p>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              {/* Project details */}
              <div className="card p-6 space-y-4">
                <h2 className="font-display text-lg text-neutral-900">Project details</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs text-neutral-400">Client</dt>
                    <dd className="text-sm font-medium text-neutral-900">{project.clientName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-neutral-400">Category</dt>
                    <dd className="text-sm font-medium text-neutral-900">{project.category}</dd>
                  </div>
                  {project.completedAt && (
                    <div>
                      <dt className="text-xs text-neutral-400">Completed</dt>
                      <dd className="text-sm font-medium text-neutral-900 flex items-center gap-1">
                        <Calendar size={13} className="text-neutral-400" />
                        {formatDate(project.completedAt, 'MMMM yyyy')}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-neutral-400">Views</dt>
                    <dd className="text-sm font-medium text-neutral-900 flex items-center gap-1">
                      <Eye size={13} className="text-neutral-400" />
                      {project.viewCount.toLocaleString('en-IN')}
                    </dd>
                  </div>
                  {project.projectUrl && (
                    <a
                      href={project.projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium mt-2"
                    >
                      Visit live site <ExternalLink size={13} />
                    </a>
                  )}
                </dl>
              </div>

              {/* Results */}
              <div className="card p-6">
                <h2 className="font-display text-lg text-neutral-900 mb-4">Results achieved</h2>
                <div className="grid grid-cols-2 gap-3">
                  {MOCK_RESULTS.map((r) => (
                    <div key={r.label} className="bg-green-50 border border-green-100 rounded-xl p-4">
                      <p className="font-display text-2xl text-green-700">{r.value}</p>
                      <p className="text-xs font-medium text-green-800 mt-0.5">{r.label}</p>
                      <p className="text-[10px] text-green-600">{r.context}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="card p-6 bg-brand-50 border-brand-100">
                <p className="font-display text-lg text-brand-900 mb-2">Like what you see?</p>
                <p className="text-sm text-brand-700 mb-4">Let's create something like this for your business.</p>
                <Link href="/contact" className="btn-primary w-full justify-center text-sm">
                  Start a Project
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <CtaBanner
        title="Want results like these?"
        subtitle="We'd love to hear about your project."
      />
    </>
  );
}
