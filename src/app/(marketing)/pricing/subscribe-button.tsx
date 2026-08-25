"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { confirmSubscription, subscribeToPlan } from "@/actions/subscribe";
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

export function SubscribeButton({
  planCode,
  planName,
  signedIn,
  isCurrent,
  hasAnnual,
  disabled,
  interval: controlledInterval,
}: {
  planCode: string;
  planName: string;
  signedIn: boolean;
  isCurrent: boolean;
  hasAnnual: boolean;
  disabled: boolean;
  /** When provided, the button follows this interval and hides its own toggle. */
  interval?: "MONTHLY" | "ANNUAL";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [internalInterval, setInternalInterval] = useState<
    "MONTHLY" | "ANNUAL"
  >("MONTHLY");
  const interval = controlledInterval ?? internalInterval;

  const confirm = useAction(confirmSubscription, {
    onSuccess: () => {
      toast.success(`Welcome to ${planName}!`);
      router.push("/billing");
      router.refresh();
    },
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Verification failed — support will follow up."),
  });

  const subscribe = useAction(subscribeToPlan, {
    async onSuccess({ data }) {
      if (!data) return;
      const ok = await loadRazorpayScript();
      if (!ok) {
        toast.error("Could not load the payment window.");
        setBusy(false);
        return;
      }
      const payload = data.checkout as { keyId: string; razorpaySubscriptionId: string };
      const rzp = new window.Razorpay!({
        key: payload.keyId,
        subscription_id: payload.razorpaySubscriptionId,
        name: "elluminar",
        description: `${planName} membership`,
        handler: (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          confirm.execute({
            subscriptionId: data.subscriptionId,
            providerPaymentRef: response.razorpay_payment_id,
            providerSubRef: response.razorpay_subscription_id,
            signature: response.razorpay_signature,
          });
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: "#0a0a0a" },
      });
      rzp.open();
    },
    onError({ error }) {
      toast.error(error.serverError ?? "Could not start subscription");
      setBusy(false);
    },
  });

  if (planCode === "FREE") {
    return signedIn ? (
      <Button variant="outline" className="w-full" disabled>
        Included for everyone
      </Button>
    ) : (
      <Button render={<Link href="/sign-up" />} variant="outline" className="w-full">
        Create free account
      </Button>
    );
  }

  if (!signedIn) {
    return (
      <Button render={<Link href={`/sign-in?next=/pricing`} />} className="w-full">
        Sign in to subscribe
      </Button>
    );
  }
  if (isCurrent) {
    return (
      <Button render={<Link href="/billing" />} variant="outline" className="w-full">
        Manage in Billing
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {hasAnnual && controlledInterval === undefined && (
        <div className="flex gap-1 rounded-md border p-0.5 text-xs">
          {(["MONTHLY", "ANNUAL"] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInternalInterval(i)}
              className={`flex-1 rounded px-2 py-1 ${interval === i ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {i === "MONTHLY" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
      )}
      <Button
        className="w-full"
        disabled={disabled || busy || subscribe.isPending || confirm.isPending}
        onClick={() => {
          setBusy(true);
          subscribe.execute({ planCode, interval });
        }}
      >
        {busy || subscribe.isPending
          ? "Opening…"
          : confirm.isPending
            ? "Confirming…"
            : disabled
              ? "Switch from Billing"
              : `Get ${planName}`}
      </Button>
    </div>
  );
}
