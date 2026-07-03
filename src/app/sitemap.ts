import type { MetadataRoute } from "next";

import { env } from "@/env";
import { db } from "@/lib/db";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL;

  const [courses, projects, tenants] = await Promise.all([
    db.course.findMany({
      where: { status: "PUBLISHED", visibility: "MARKETPLACE" },
      select: { slug: true, updatedAt: true, tenant: { select: { slug: true } } },
      take: 5000,
    }),
    db.project.findMany({
      where: { status: "PUBLISHED", visibility: "MARKETPLACE" },
      select: { slug: true, updatedAt: true, tenant: { select: { slug: true } } },
      take: 5000,
    }),
    db.tenant.findMany({
      where: { status: "APPROVED" },
      select: { slug: true, updatedAt: true },
      take: 5000,
    }),
  ]);

  return [
    { url: base, priority: 1 },
    { url: `${base}/courses`, priority: 0.9 },
    { url: `${base}/projects`, priority: 0.9 },
    { url: `${base}/pricing`, priority: 0.8 },
    ...tenants.map((t) => ({
      url: `${base}/c/${t.slug}`,
      lastModified: t.updatedAt,
      priority: 0.7,
    })),
    ...courses.map((c) => ({
      url: `${base}/courses/${c.tenant.slug}/${c.slug}`,
      lastModified: c.updatedAt,
      priority: 0.8,
    })),
    ...projects.map((p) => ({
      url: `${base}/projects/${p.tenant.slug}/${p.slug}`,
      lastModified: p.updatedAt,
      priority: 0.8,
    })),
  ];
}
