import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { CohortsPanel } from "./cohorts-panel";
import { CoursePricingForm } from "./course-pricing-form";
import { CourseSettingsForm } from "./course-settings-form";
import { CurriculumBuilder } from "./curriculum-builder";
import { PublishControls } from "./publish-controls";

export const metadata = { title: "Edit course" };

export default async function CourseEditorPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; courseId: string }>;
}) {
  const { tenantSlug, courseId } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, [
    "owner",
    "admin",
    "instructor",
  ]);

  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: { videoAsset: { select: { status: true, provider: true } } },
          },
        },
      },
      prices: { where: { currency: "INR", region: null, cohortId: null } },
      cohorts: {
        orderBy: { startsAt: "desc" },
        include: { prices: { where: { currency: "INR", region: null } } },
      },
    },
  });
  if (!course || course.tenantId !== tenant.id) notFound();

  const categories = await db.category.findMany({ orderBy: { sort: "asc" } });
  const price = course.prices.find((p) => p.active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
            <Badge variant="outline">{course.status.toLowerCase().replace("_", " ")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/c/${tenantSlug}`} className="hover:underline">
              /c/{tenantSlug}
            </Link>
            /{course.slug}
          </p>
        </div>
        <PublishControls
          tenantSlug={tenantSlug}
          courseId={course.id}
          status={course.status}
        />
      </div>

      <Tabs defaultValue="curriculum">
        <TabsList>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
        </TabsList>
        <TabsContent value="curriculum" className="mt-6">
          <CurriculumBuilder
            tenantSlug={tenantSlug}
            courseId={course.id}
            sections={course.sections.map((s) => ({
              id: s.id,
              title: s.title,
              lessons: s.lessons.map((l) => ({
                id: l.id,
                title: l.title,
                type: l.type,
                isFreePreview: l.isFreePreview,
                releaseAfterDays: l.releaseAfterDays,
                durationSec: l.durationSec,
                videoStatus: l.videoAsset?.status ?? null,
                labRef:
                  (l.labConfig as { labRef?: string } | null)?.labRef ?? null,
              })),
            }))}
          />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <CourseSettingsForm
            tenantSlug={tenantSlug}
            courseId={course.id}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            defaults={{
              title: course.title,
              subtitle: course.subtitle ?? "",
              level: course.level,
              categoryId: course.categoryId ?? "",
              tags: course.tags.join(", "),
              outcomes: course.outcomes.join("\n"),
              prerequisites: course.prerequisites.join("\n"),
              visibility: course.visibility,
              selfPacedEnabled: course.selfPacedEnabled,
              liveEnabled: course.liveEnabled,
              estimatedHours: course.estimatedHours,
              certificateEnabled: course.certificateEnabled,
            }}
          />
        </TabsContent>
        <TabsContent value="pricing" className="mt-6">
          <CoursePricingForm
            tenantSlug={tenantSlug}
            courseId={course.id}
            defaults={{
              amountRupees: price ? Number(price.amountMinor) / 100 : null,
              compareAtRupees: price?.compareAtMinor
                ? Number(price.compareAtMinor) / 100
                : null,
            }}
          />
        </TabsContent>
        <TabsContent value="cohorts" className="mt-6">
          <CohortsPanel
            tenantSlug={tenantSlug}
            courseId={course.id}
            cohorts={course.cohorts.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              startsAt: c.startsAt.toISOString(),
              endsAt: c.endsAt?.toISOString() ?? null,
              capacity: c.capacity,
              status: c.status,
              seatPriceRupees: c.prices[0] ? Number(c.prices[0].amountMinor) / 100 : null,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
