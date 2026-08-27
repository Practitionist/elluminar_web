import { z } from "zod";

/**
 * Credential-flow schemas. Shared by the client forms in `src/app/(auth)` (which
 * talk to BetterAuth directly via `authClient`) and by the `/account` server
 * actions — one definition, so the two can never drift.
 */

export const emailSchema = z.email("Enter a valid email address").max(255);

/**
 * BetterAuth's own floor is 8 characters (`emailAndPassword.minPasswordLength`
 * default). We keep that as the hard gate and express everything stronger as
 * advisory scoring, so we never lock a user out of a password the server
 * would have accepted.
 */
export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "At most 128 characters");

export type PasswordStrength = {
  /** 0–4. 0–1 weak, 2 fair, 3 good, 4 strong. */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  /** The single highest-value thing the user could do next, or null when strong. */
  hint: string | null;
};

/**
 * Deliberately dependency-free and deterministic — this runs on every keystroke
 * and its only job is to nudge, never to block. Blocking is `passwordSchema`.
 */
export function scorePassword(password: string): PasswordStrength {
  if (password.length < 8) {
    return { score: 0, label: "Too short", hint: "Use at least 8 characters" };
  }

  const checks = {
    length12: password.length >= 12,
    length16: password.length >= 16,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const variety = [checks.lower, checks.upper, checks.digit, checks.symbol].filter(
    Boolean,
  ).length;
  const raw = variety + (checks.length12 ? 1 : 0) + (checks.length16 ? 1 : 0);
  const score = Math.max(1, Math.min(4, raw - 1)) as 1 | 2 | 3 | 4;

  const hint = !checks.length12
    ? "Longer is stronger — aim for 12+ characters"
    : variety < 3
      ? "Mix in uppercase, numbers or symbols"
      : null;

  const label = (["Weak", "Fair", "Good", "Strong"] as const)[score - 1];
  return { score, label, hint };
}

export const signInSchema = z.object({
  email: emailSchema,
  // Not `passwordSchema`: an existing account may predate any rule we add, and
  // "at least 8 characters" on a sign-in form leaks our policy for no benefit.
  password: z.string().min(1, "Enter your password"),
  rememberMe: z.boolean().optional().default(true),
});

export const signUpSchema = z
  .object({
    name: z.string().min(2, "Tell us your name").max(80),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
    acceptTerms: z.literal(true, {
      error: "Please accept the terms to continue",
    }),
    marketingOptIn: z.boolean().optional().default(false),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
    /** Signing every other device out is the safe default after a rotation. */
    revokeOtherSessions: z.boolean().optional().default(true),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Choose a password you haven't used here before",
    path: ["newPassword"],
  });

export const changeEmailSchema = z.object({ newEmail: emailSchema });

export const ssoEmailSchema = z.object({ email: emailSchema });

/** TOTP and backup codes share one field; the shapes differ, so accept either. */
export const twoFactorCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, "Enter the 6-digit code")
    .max(24, "That code is too long"),
  trustDevice: z.boolean().optional().default(false),
});

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
});

export const enableTwoFactorSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type TwoFactorCodeInput = z.infer<typeof twoFactorCodeSchema>;
