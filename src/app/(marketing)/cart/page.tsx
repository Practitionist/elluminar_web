import Link from "next/link";

import { getOrCreateActiveCart } from "@/actions/cart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveCartPricing } from "@/lib/commerce/pricing";
import { formatMoney } from "@/lib/money";

import { CartLines } from "./cart-lines";
import { CheckoutButton } from "./checkout-button";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const session = await getSession();
  const cart = await getOrCreateActiveCart();
  const pricing = await resolveCartPricing(cart.id, {
    userId: session?.user.id,
  });

  if (pricing.lines.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">
          Courses and projects are independent line items — add exactly what you need.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button render={<Link href="/courses" />}>Browse courses</Button>
          <Button render={<Link href="/projects" />} variant="outline">
            Explore projects
          </Button>
        </div>
      </div>
    );
  }

  const buyerEmail = session
    ? (await db.user.findUnique({ where: { id: session.user.id } }))?.email
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <CartLines
          lines={pricing.lines.map((l) => ({
            cartItemId: l.cartItemId,
            title: l.title,
            kind: l.itemType,
            detail: l.detail,
            amount: formatMoney(l.unitAmountMinor),
            discounted:
              l.discountMinor > 0n ? formatMoney(l.unitAmountMinor - l.discountMinor) : null,
          }))}
        />
        <Card className="h-fit">
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(pricing.subtotalMinor)}</span>
            </div>
            {pricing.discountMinor > 0n && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Discounts{" "}
                  {pricing.appliedEntitlement && <Badge variant="outline">member</Badge>}
                </span>
                <span>−{formatMoney(pricing.discountMinor)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Includes GST</span>
              <span>{formatMoney(pricing.taxMinor)}</span>
            </div>
            <div className="flex justify-between border-t pt-3 text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(pricing.totalMinor)}</span>
            </div>
            {session ? (
              <CheckoutButton email={buyerEmail ?? ""} />
            ) : (
              <Button render={<Link href="/sign-in?next=/cart" />} className="w-full">
                Sign in to checkout
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              14-day refund window on courses. Projects refundable until mentor kickoff.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
