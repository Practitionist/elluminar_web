import { db } from "@/lib/db";

import { FlagToggle } from "./flag-toggle";

export const metadata = { title: "Feature flags" };

export default async function AdminFlagsPage() {
  const flags = await db.featureFlag.findMany({ orderBy: { key: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Feature flags</h1>
        <p className="text-sm text-muted-foreground">
          Launch gates for tiers and post-MVP features — no deploy needed.
        </p>
      </div>
      <div className="space-y-2">
        {flags.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between rounded-md border px-4 py-3"
          >
            <div>
              <p className="font-mono text-sm font-medium">{f.key}</p>
              {f.description && (
                <p className="text-xs text-muted-foreground">{f.description}</p>
              )}
            </div>
            <FlagToggle flagKey={f.key} enabled={f.enabled} />
          </div>
        ))}
      </div>
    </div>
  );
}
