"use client";

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
  InputGroupInput,
} from "@/components/ui/input-group";

/**
 * Labelled text input with an optional leading icon, wired to `Field` for
 * inline errors. The auth and account forms are uncontrolled and read via
 * `FormData` on submit — matching the convention used by all 23 existing
 * action-backed forms — so there is no `value` prop here by default.
 */
export function TextField({
  name,
  label,
  error,
  icon,
  description,
  action,
  inputProps,
}: {
  name: string;
  label: string;
  error?: string;
  icon?: React.ReactNode;
  description?: string;
  /** Rendered opposite the label, e.g. a "Forgot password?" link. */
  action?: React.ReactNode;
  inputProps?: Omit<React.ComponentProps<"input">, "id" | "name" | "size">;
}) {
  return (
    <Field name={name} error={error}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {action}
      </div>
      <InputGroup size="lg">
        {icon ? (
          <InputGroupAddon align="inline-start">{icon}</InputGroupAddon>
        ) : null}
        <FieldControl>
          <InputGroupInput {...inputProps} />
        </FieldControl>
      </InputGroup>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}
