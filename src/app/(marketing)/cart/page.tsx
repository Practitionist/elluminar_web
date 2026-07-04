import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { getActiveCart } from "@/actions/cart";
import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveCartPricing } from "@/lib/commerce/pricing";
import { formatMoney } from "@/lib/money";

import { CartLines } from "./cart-lines";
import { CheckoutButton } from "./checkout-button";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const session = await getSession();
  const cart = await getActiveCart();
  const pricing = cart
    ? await resolveCartPricing(cart.id, { userId: session?.user.id })
    : null;

  if (!pricing || pricing.lines.length === 0) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col justify-center px-4 py-16 text-center">
        <div className="rounded-3xl border border-border bg-card p-8">
          <span className="mx-auto mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-primary-subtle text-primary-subtle-foreground">
            <ShoppingBag className="size-7" />
          </span>
          <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
            Your cart is empty
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Courses and projects are independent line items — add exactly what
            you need.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button render={<Link href="/courses" />} className="rounded-full">
              Browse courses
            </Button>
            <Button
              render={<Link href="/projects" />}
              variant="outline"
              className="rounded-full"
            >
              Explore projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const buyerEmail = session
    ? (await db.user.findUnique({ where: { id: session.user.id } }))?.email
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Cart
      </h1>
      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_320px]">
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
        <aside>
          <div className="sticky top-20 rounded-2xl border border-border bg-card p-6">
            <div className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
              Order summary
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatMoney(pricing.subtotalMinor)}</span>
              </div>
              {pricing.discountMinor > 0n && (
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    Discount
                    {pricing.appliedEntitlement && (
                      <Pill tone="success" className="px-2 py-0.5 text-[10px]">
                        Member
                      </Pill>
                    )}
                  </span>
                  <span className="font-semibold text-success-subtle-foreground">
                    −{formatMoney(pricing.discountMinor)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Includes GST</span>
                <span>{formatMoney(pricing.taxMinor)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <span className="font-display text-lg font-medium">Total</span>
                <span className="font-display text-lg font-medium">
                  {formatMoney(pricing.totalMinor)}
                </span>
              </div>
            </div>
            <div className="mt-5">
              {session ? (
                <CheckoutButton email={buyerEmail ?? ""} />
              ) : (
                <Button
                  render={<Link href="/sign-in?next=/cart" />}
                  className="w-full rounded-full"
                >
                  Sign in to checkout
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              14-day refund window on courses. Projects refundable until
              mentor kickoff.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
