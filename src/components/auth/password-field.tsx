"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import * as React from "react";

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { scorePassword, type PasswordStrength } from "@/lib/validation/auth";

/** Password input with a reveal toggle. */
export function PasswordField({
  name,
  label,
  error,
  autoComplete,
  description,
  value,
  onValueChange,
  required = true,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  autoComplete: "current-password" | "new-password";
  description?: string;
  /** Controlled only when a strength meter needs to observe it. */
  value?: string;
  onValueChange?: (v: string) => void;
  required?: boolean;
  children?: React.ReactNode;
}) {
  const [revealed, setRevealed] = React.useState(false);

  return (
    <Field name={name} error={error}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {children}
      </div>
      <InputGroup size="lg">
        <InputGroupAddon align="inline-start">
          <Lock className="size-4" />
        </InputGroupAddon>
        <FieldControl>
          <InputGroupInput
            type={revealed ? "text" : "password"}
            autoComplete={autoComplete}
            required={required}
            {...(onValueChange
              ? { value, onChange: (e) => onValueChange(e.target.value) }
              : {})}
          />
        </FieldControl>
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Hide password" : "Show password"}
            // The field's own state is what matters to a screen reader here;
            // aria-pressed makes the toggle itself legible too.
            aria-pressed={revealed}
          >
            {revealed ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

const STRENGTH_STYLES: Record<PasswordStrength["score"], string> = {
  0: "bg-border",
  1: "bg-destructive",
  2: "bg-distinction",
  3: "bg-info",
  4: "bg-success",
};

/**
 * Advisory only — `passwordSchema` is what actually gates submission. Showing a
 * bar that says "Weak" next to a password the server will happily accept is
 * fine; refusing it would not be.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label, hint } = scorePassword(password);

  if (!password) return null;

  return (
    <div className="space-y-1.5" data-slot="password-strength">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              segment <= score ? STRENGTH_STYLES[score] : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        <span className="font-medium text-foreground">{label}</span>
        {hint ? ` — ${hint}` : null}
      </p>
    </div>
  );
}
