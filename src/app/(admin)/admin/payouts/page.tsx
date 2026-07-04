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

import { RecordPayoutDialog } from "./record-payout-dialog";

export const metadata = { title: "Payouts" };

const PAYOUT_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "distinction",
  PROCESSING: "info",
  PAID: "success",
  FAILED: "destructive",
  CANCELLED: "destructive",
};

export default async function AdminPayoutsPage() {
  const [accounts, recentPayouts] = await Promise.all([
    db.ledgerAccount.findMany({
      where: {
        ownerType: { in: ["TENANT", "MENTOR"] },
        balanceCachedMinor: { gt: 0 },
      },
      include: {
        tenant: { select: { displayName: true } },
        mentorProfile: { include: { user: { select: { name: true } } } },
      },
      orderBy: { balanceCachedMinor: "desc" },
    }),
    db.payout.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        account: {
          include: {
            tenant: { select: { displayName: true } },
            mentorProfile: { include: { user: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  const ownerName = (a: (typeof accounts)[number]) =>
    a.tenant?.displayName ?? a.mentorProfile?.user.name ?? "—";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Payouts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Balances owed to creators and mentors. Manual payouts at MVP —
          RazorpayX automation is issue #14.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Owner
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Type
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Balance
              </TableHead>
              <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No outstanding balances.
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((a) => (
                <TableRow key={a.id} className="border-t border-border">
                  <TableCell className="font-medium">{ownerName(a)}</TableCell>
                  <TableCell>
                    <Pill tone="neutral">{a.ownerType.toLowerCase()}</Pill>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatMoney(a.balanceCachedMinor, a.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <RecordPayoutDialog
                      ledgerAccountId={a.id}
                      ownerName={ownerName(a)}
                      balanceRupees={Number(a.balanceCachedMinor) / 100}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <section>
        <h2 className="mb-3 text-base font-extrabold">Recent payouts</h2>
        <div className="space-y-2 text-sm">
          {recentPayouts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
            >
              <span>
                {p.account.tenant?.displayName ?? p.account.mentorProfile?.user.name}
                {p.providerRef ? ` · ${p.providerRef}` : ""}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium">{formatMoney(p.amountMinor, p.currency)}</span>
                <Pill tone={PAYOUT_STATUS_TONE[p.status] ?? "neutral"}>
                  {p.status.toLowerCase()}
                </Pill>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
