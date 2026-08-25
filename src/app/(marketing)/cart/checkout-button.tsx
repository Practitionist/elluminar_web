"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { confirmCheckout, createCheckout } from "@/actions/checkout";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

async function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutButton({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const confirm = useAction(confirmCheckout, {
    onSuccess: () => {
      toast.success("Payment confirmed — you're in!");
      router.push("/learn");
      router.refresh();
    },
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Verification failed — support will follow up."),
  });

  const create = useAction(createCheckout, {
    async onSuccess({ data }) {
      if (!data) return;
      const ok = await loadRazorpayScript();
      if (!ok) {
        toast.error("Could not load the payment window.");
        setBusy(false);
        return;
      }
      const payload = data.checkout as {
        keyId: string;
        razorpayOrderId: string;
        amount: number;
        currency: string;
        prefill?: Record<string, string>;
      };
      const rzp = new window.Razorpay!({
        key: payload.keyId,
        order_id: payload.razorpayOrderId,
        amount: payload.amount,
        currency: payload.currency,
        name: "elluminar",
        prefill: { email, ...payload.prefill },
        handler: (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          confirm.execute({
            orderId: data.orderId,
            providerOrderRef: response.razorpay_order_id,
            providerPaymentRef: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: "#0a0a0a" },
      });
      rzp.open();
    },
    onError({ error }) {
      toast.error(error.serverError ?? "Checkout failed");
      setBusy(false);
    },
  });

  return (
    <Button
      className="w-full rounded-full"
      disabled={busy || create.isPending || confirm.isPending}
      onClick={() => {
        setBusy(true);
        create.execute({});
      }}
    >
      {busy || create.isPending
        ? "Opening checkout…"
        : confirm.isPending
          ? "Confirming…"
          : "Checkout"}
    </Button>
  );
}
