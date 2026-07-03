import { Badge } from "@/components/ui/badge";
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
        <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Balances owed to creators and mentors. Manual payouts at MVP —
          RazorpayX automation is issue #14.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Owner</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead className="text-right">Action</TableHead>
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
              <TableRow key={a.id}>
                <TableCell className="font-medium">{ownerName(a)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{a.ownerType.toLowerCase()}</Badge>
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

      <div>
        <h2 className="text-lg font-semibold">Recent payouts</h2>
        <div className="mt-3 space-y-2 text-sm">
          {recentPayouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>
                {p.account.tenant?.displayName ?? p.account.mentorProfile?.user.name}
                {p.providerRef ? ` · ${p.providerRef}` : ""}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium">{formatMoney(p.amountMinor, p.currency)}</span>
                <Badge variant="outline">{p.status.toLowerCase()}</Badge>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
