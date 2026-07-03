import { requireTenantMember } from "@/lib/auth/session";
import { tiptapToPlainText } from "@/lib/richtext";

import { TenantSettingsForm } from "./tenant-settings-form";

export const metadata = { title: "Settings" };

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const socials = (tenant.socials ?? {}) as Record<string, string>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Storefront identity and contact details.
        </p>
      </div>
      <TenantSettingsForm
        tenantSlug={tenantSlug}
        defaults={{
          displayName: tenant.displayName,
          about: tiptapToPlainText(tenant.about),
          supportEmail: tenant.supportEmail ?? "",
          website: socials.website ?? "",
          youtube: socials.youtube ?? "",
        }}
      />
    </div>
  );
}
