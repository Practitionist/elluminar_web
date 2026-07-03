"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(false);

  async function onResend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setLoading(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/learn",
    });
    setLoading(false);
    if (error) toast.error(error.message ?? "Could not resend");
    else toast.success("Verification email sent.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your inbox</CardTitle>
        <CardDescription>
          We sent you a verification link. Click it to activate your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onResend} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Didn&apos;t get it? Resend to</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <Button type="submit" variant="outline" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Resend verification email"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-medium text-foreground hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
