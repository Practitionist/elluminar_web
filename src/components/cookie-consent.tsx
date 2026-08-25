"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const CONSENT_COOKIE = "cookie_consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export type CookieConsentValue = "all" | "essential";

export function getCookieConsent(): CookieConsentValue | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CONSENT_COOKIE}=(all|essential)`),
  );
  return (match?.[1] as CookieConsentValue) ?? null;
}

let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// Re-open requests (e.g. the footer "Cookie settings" control) — lets users
// review or withdraw a previously stored choice (DPDP).
let reopenListeners: Array<() => void> = [];

export function openCookieSettings() {
  for (const listener of reopenListeners) listener();
}

function setCookieConsent(value: CookieConsentValue) {
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${CONSENT_MAX_AGE}; SameSite=Lax`;
  for (const listener of listeners) listener();
}

/**
 * DPDP/cookie consent banner. Strictly-necessary cookies (session, cart) need no
 * consent; analytics (PostHog, issue #12) must check getCookieConsent() === "all"
 * before initializing.
 */
export function CookieConsent() {
  // Server snapshot pretends consent exists so the banner never flashes during
  // SSR/hydration; the client snapshot takes over after mount.
  const consent = useSyncExternalStore(
    subscribe,
    getCookieConsent,
    () => "essential" as const,
  );
  const [reopen, setReopen] = useState(false);
  useEffect(
    () => {
      reopenListeners.push(() => setReopen(true));
      return () => {
        reopenListeners = [];
      };
    },
    [],
  );

  if (consent !== null && !reopen) return null;

  const choose = (value: CookieConsentValue) => {
    setCookieConsent(value);
    setReopen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-50 border-t shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="container flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <p className="text-muted-foreground text-sm">
          We use essential cookies to run the site (sign-in, cart) and, with
          your consent, analytics cookies to improve it. See our{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => choose("essential")}
          >
            Essential only
          </Button>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => choose("all")}
          >
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Footer control that reopens the consent banner so users can change/withdraw consent. */
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="cursor-pointer transition-colors hover:text-white"
    >
      Cookie settings
    </button>
  );
}
