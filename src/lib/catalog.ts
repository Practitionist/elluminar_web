import "server-only";

import { db } from "@/lib/db";

/** Marketplace course search: Postgres FTS over the GIN index, ILIKE fallback. */
export async function searchPublishedCourseIds(q: string): Promise<string[]> {
  const query = q.trim();
  if (!query) return [];
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Course"
    WHERE status = 'PUBLISHED' AND visibility = 'MARKETPLACE'
      AND (
        to_tsvector('english', coalesce(title,'') || ' ' || coalesce(subtitle,''))
          @@ plainto_tsquery('english', ${query})
        OR title ILIKE ${"%" + query + "%"}
      )
    LIMIT 60
  `;
  return rows.map((r) => r.id);
}

export async function searchPublishedProjectIds(q: string): Promise<string[]> {
  const query = q.trim();
  if (!query) return [];
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Project"
    WHERE status = 'PUBLISHED' AND visibility = 'MARKETPLACE'
      AND (
        to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,''))
          @@ plainto_tsquery('english', ${query})
        OR title ILIKE ${"%" + query + "%"}
      )
    LIMIT 60
  `;
  return rows.map((r) => r.id);
}
