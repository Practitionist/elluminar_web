"use client";

import { Check, Leaf, Rocket, Sparkles, Zap } from "lucide-react";
import { useState } from "react";

import { Pill } from "@/components/shared";
import { cn } from "@/lib/utils";

import { SubscribeButton } from "./subscribe-button";

export type PricingPlanData = {
  code: string;
  name: string;
  tagline: string | null;
  monthly: string | null;
  annualTotal: string | null;
  annualPerMonth: string | null;
  highlights: string[];
  isCurrent: boolean;
  hasAnnual: boolean;
  disabled: boolean;
  popular: boolean;
  dark: boolean;
};

const ICON: Record<string, typeof Zap> = {
  FREE: Leaf,
  LEARN: Zap,
  MENTOR: Sparkles,
  CAREER: Rocket,
};

export function PricingPlans({
  plans,
  signedIn,
}: {
  plans: PricingPlanData[];
  signedIn: boolean;
}) {
  const [annual, setAnnual] = useState(false);
  const interval = annual ? "ANNUAL" : "MONTHLY";

  return (
    <>
      <div className="mt-8 flex items-center justify-center gap-3">
        <div className="inline-flex rounded-full bg-muted p-1">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={cn(
              "rounded-full px-5 py-1.5 text-sm font-bold transition-colors",
              !annual
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={cn(
              "rounded-full px-5 py-1.5 text-sm font-bold transition-colors",
              annual
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            Annual
          </button>
        </div>
        <Pill tone="success">Save 20% yearly</Pill>
      </div>

      <div className="mt-10 grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const Icon = ICON[plan.code] ?? Zap;
          const isFree = plan.code === "FREE";
          const priceMain = isFree
            ? "₹0"
            : annual
              ? (plan.annualPerMonth ?? plan.monthly)
              : plan.monthly;
          const note = isFree
            ? "Free forever"
            : annual
              ? plan.annualTotal
                ? `billed ${plan.annualTotal}/yr`
                : ""
              : plan.annualTotal
                ? `or ${plan.annualTotal}/yr`
                : "";

          return (
            <div
              key={plan.code}
              className={cn(
                "relative flex flex-col rounded-3xl border p-6",
                plan.dark
                  ? "border-transparent bg-ink text-ink-foreground"
                  : plan.popular
                    ? "border-2 border-primary bg-card shadow-xl shadow-primary/10 lg:-translate-y-2"
                    : "border-border bg-card",
              )}
            >
              {plan.popular ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3.5 py-1 text-[11px] font-extrabold whitespace-nowrap text-primary-foreground shadow-lg shadow-primary/30">
                  MOST POPULAR
                </span>
              ) : null}

              <span
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-xl",
                  plan.dark
                    ? "bg-white/10 text-primary"
                    : plan.popular
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary-subtle text-primary-subtle-foreground",
                )}
              >
                <Icon className="size-5" />
              </span>

              <div className="mt-4 flex items-center gap-2">
                <span
                  className={cn(
                    "text-[0.95rem] font-extrabold",
                    plan.dark && "text-primary",
                  )}
                >
                  {plan.name}
                </span>
                {plan.isCurrent ? (
                  <Pill tone="success" className="px-2 py-0.5 text-[10px]">
                    Current
                  </Pill>
                ) : null}
              </div>
              <p
                className={cn(
                  "mt-0.5 text-xs font-semibold",
                  plan.dark ? "text-ink-muted" : "text-muted-foreground",
                )}
              >
                {plan.tagline}
              </p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight">
                  {priceMain}
                </span>
                {!isFree ? (
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      plan.dark ? "text-ink-muted" : "text-muted-foreground",
                    )}
                  >
                    /mo
                  </span>
                ) : null}
              </div>
              <div
                className={cn(
                  "mt-1 min-h-4 text-xs font-semibold",
                  plan.dark ? "text-emerald-400" : "text-success-subtle-foreground",
                )}
              >
                {note}
              </div>

              <div className="mt-5">
                <SubscribeButton
                  planCode={plan.code}
                  planName={plan.name}
                  signedIn={signedIn}
                  isCurrent={plan.isCurrent}
                  hasAnnual={plan.hasAnnual}
                  disabled={plan.disabled}
                  interval={interval}
                />
              </div>

              <ul
                className={cn(
                  "mt-6 space-y-2.5 border-t pt-5 text-sm",
                  plan.dark ? "border-white/15" : "border-border",
                )}
              >
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2.5">
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        plan.dark ? "text-emerald-400" : "text-success",
                      )}
                    />
                    <span
                      className={cn(
                        plan.dark
                          ? "text-ink-foreground/85"
                          : "text-muted-foreground",
                      )}
                    >
                      {h}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
