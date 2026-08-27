import { env } from "@/env";

import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create your account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <SignUpForm
      // Prefilled when arriving from an invitation email.
      initialEmail={email ?? ""}
      googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
    />
  );
}
