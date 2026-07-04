import Link from "next/link";

import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

import { MarkAllReadButton } from "./mark-all-read-button";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireUser("/learn/notifications");
  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
            Notifications
          </h1>
          <MarkAllReadButton />
        </div>
        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            Nothing yet.
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.actionUrl ?? "/learn"}
                className={cn(
                  "block rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
                  n.readAt ? "border-border opacity-70" : "border-primary/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{n.title}</span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {n.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </span>
                </div>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
