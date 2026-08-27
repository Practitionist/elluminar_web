"use client";

import { Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AuthHeader,
  FormAlert,
  GoogleIcon,
  OrDivider,
  PasswordField,
  PasswordStrengthMeter,
  SubmitButton,
  TextField,
} from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FadeIn } from "@/components/ui/fade-in";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { signUpSchema } from "@/lib/validation/auth";

export function SignUpForm({
  initialEmail,
  googleEnabled,
}: {
  initialEmail: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<null | "email" | "google">(null);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const parsed = signUpSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
      // An unchecked box is absent from FormData entirely, so `=== "on"` is
      // what turns it into the literal `true` the schema demands.
      acceptTerms: form.get("acceptTerms") === "on",
      marketingOptIn: form.get("marketingOptIn") === "on",
    });

    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
        ),
      );
      return;
    }

    setErrors({});
    setFormMessage(undefined);
    setPending("email");

    const { error } = await authClient.signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      // `marketingOptIn` is declared in `user.additionalFields`, so BetterAuth
      // persists it as part of the sign-up rather than needing a second write.
      marketingOptIn: parsed.data.marketingOptIn,
    });
    setPending(null);

    if (error) {
      if (error.status === 422 || error.code === "USER_ALREADY_EXISTS") {
        setErrors({ email: "An account with this email already exists." });
        return;
      }
      setFormMessage(error.message ?? "We couldn't create your account. Try again.");
      return;
    }

    toast.success("Account created — check your inbox to verify your email.");
    router.push(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
  }

  async function onGoogle() {
    setPending("google");
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/learn",
    });
    setPending(null);
    if (error) toast.error(error.message ?? "Google sign-up failed");
  }

  return (
    <FadeIn direction="up" duration={0.4}>
      <div className="space-y-6">
        <AuthHeader
          title="Create your account"
          description="Learn from independent creators. Prove it with mentor-reviewed work."
        />

        {formMessage ? <FormAlert>{formMessage}</FormAlert> : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextField
            name="name"
            label="Name"
            error={errors.name}
            icon={<User className="size-4" />}
            inputProps={{ autoComplete: "name", autoFocus: true, placeholder: "Ada Lovelace" }}
          />
          <TextField
            name="email"
            label="Email"
            error={errors.email}
            icon={<Mail className="size-4" />}
            inputProps={{
              type: "email",
              autoComplete: "email",
              defaultValue: initialEmail,
              placeholder: "you@example.com",
            }}
          />

          <div className="space-y-2">
            <PasswordField
              name="password"
              label="Password"
              error={errors.password}
              autoComplete="new-password"
              value={password}
              onValueChange={setPassword}
            />
            <PasswordStrengthMeter password={password} />
          </div>

          <PasswordField
            name="confirmPassword"
            label="Confirm password"
            error={errors.confirmPassword}
            autoComplete="new-password"
          />

          <Field name="acceptTerms" error={errors.acceptTerms} className="space-y-2 pt-1">
            <div className="flex items-start gap-2.5">
              <Checkbox id="acceptTerms" name="acceptTerms" className="mt-0.5" />
              <Label htmlFor="acceptTerms" className="text-sm leading-snug font-normal">
                I agree to the{" "}
                <Link href="/terms" className="font-medium text-primary hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-medium text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </Label>
            </div>
          </Field>

          <div className="flex items-start gap-2.5">
            <Checkbox id="marketingOptIn" name="marketingOptIn" className="mt-0.5" />
            <Label htmlFor="marketingOptIn" className="text-sm leading-snug font-normal">
              Send me occasional updates about new courses and cohorts.
            </Label>
          </div>

          <SubmitButton pending={pending === "email"} pendingLabel="Creating account…">
            Create account
          </SubmitButton>
        </form>

        {googleEnabled ? (
          <>
            <OrDivider />
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full rounded-full"
              disabled={pending === "google"}
              onClick={onGoogle}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </FadeIn>
  );
}
