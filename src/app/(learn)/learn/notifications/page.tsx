import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <MarkAllReadButton />
      </div>
      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Link key={n.id} href={n.actionUrl ?? "/learn"}>
              <Card className={n.readAt ? "opacity-70" : "border-primary/40"}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {n.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
