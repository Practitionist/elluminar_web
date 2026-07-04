import { Pill, type PillTone } from "@/components/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

import { LicenseAdminButtons } from "./license-admin-buttons";

export const metadata = { title: "Enterprise licenses" };

const LICENSE_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "distinction",
  ACTIVE: "success",
  EXPIRED: "destructive",
  CANCELLED: "destructive",
};

export default async function AdminLicensesPage() {
  const licenses = await db.orgLicense.findMany({
    orderBy: { endsAt: "asc" },
    include: {
      tenant: { select: { displayName: true, slug: true, type: true } },
      program: { select: { title: true } },
      payments: { select: { amountMinor: true } },
    },
  });

  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 86400_000);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Enterprise licenses
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record contract payments (activates drafts). Licenses ending within 60
          days are flagged for renewal.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Organization
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Kind
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Window
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Value / paid
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {licenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No licenses yet.
                </TableCell>
              </TableRow>
            ) : (
              licenses.map((l) => {
                const paid = l.payments.reduce((s, p) => s + p.amountMinor, 0n);
                const renewalDue = l.status === "ACTIVE" && l.endsAt < soon;
                return (
                  <TableRow key={l.id} className="border-t border-border">
                    <TableCell>
                      <div className="font-medium">{l.tenant.displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.tenant.type.toLowerCase()} · /org/{l.tenant.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Pill tone="neutral">{l.kind.toLowerCase().replace("_", " ")}</Pill>
                      {l.program && (
                        <div className="text-xs text-muted-foreground">{l.program.title}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.startsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} →{" "}
                      {l.endsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      {renewalDue && (
                        <Pill tone="destructive" className="ml-2">
                          renewal due
                        </Pill>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.contractValueMinor ? formatMoney(l.contractValueMinor) : "—"}
                      {paid > 0n && (
                        <div className="text-xs text-muted-foreground">
                          paid {formatMoney(paid)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Pill tone={LICENSE_STATUS_TONE[l.status] ?? "neutral"}>
                        {l.status.toLowerCase()}
                      </Pill>
                    </TableCell>
                    <TableCell className="text-right">
                      <LicenseAdminButtons
                        licenseId={l.id}
                        status={l.status}
                        suggestedRupees={
                          l.contractValueMinor ? Number(l.contractValueMinor) / 100 : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
