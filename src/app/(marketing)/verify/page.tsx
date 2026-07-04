import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { SectionEyebrow } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Verify a certificate" };

async function verifyAction(formData: FormData) {
  "use server";
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  redirect(`/verify/${encodeURIComponent(code)}`);
}

export default function VerifyIndexPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center px-4 py-16">
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <span className="mx-auto mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-success-subtle text-success-subtle-foreground">
          <ShieldCheck className="size-7" />
        </span>
        <div className="flex justify-center">
          <SectionEyebrow tone="success">Trust</SectionEyebrow>
        </div>
        <h1 className="mt-4 font-display text-3xl font-medium tracking-tight">
          Verify a credential
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
          Every {BRAND.name} credential carries a unique code. Enter it to
          confirm authenticity — no account needed.
        </p>
        <form action={verifyAction} className="mt-6 flex gap-2">
          <Input
            name="code"
            placeholder="XXXX-XXXX-XXXX"
            required
            className="rounded-full text-center font-mono uppercase"
          />
          <Button type="submit" className="rounded-full px-6">
            Verify
          </Button>
        </form>
      </div>
    </div>
  );
}
