"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The accessible field wrapper this app was missing. Before it, every form
 * surfaced validation as a `sonner` toast — which announces once, disappears,
 * and never associates itself with the control that was wrong.
 *
 * `Field` owns the ids so `FieldLabel`, the control, `FieldDescription` and
 * `FieldError` wire themselves together without the caller repeating them:
 * `htmlFor` / `id`, `aria-describedby`, `aria-invalid`, and a polite live
 * region so a screen reader hears the message when it appears.
 */

type FieldContextValue = {
  id: string;
  descriptionId: string;
  errorId: string;
  invalid: boolean;
  hasDescription: boolean;
  setHasDescription: (v: boolean) => void;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

function useFieldContext(component: string): FieldContextValue {
  const ctx = React.useContext(FieldContext);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <Field>`);
  return ctx;
}

function Field({
  className,
  name,
  error,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "id"> & {
  /** Also the control's id, so `errors[name]` maps straight onto the field. */
  name: string;
  error?: string;
}) {
  const [hasDescription, setHasDescription] = React.useState(false);
  const value = React.useMemo<FieldContextValue>(
    () => ({
      id: name,
      descriptionId: `${name}-description`,
      errorId: `${name}-error`,
      invalid: Boolean(error),
      hasDescription,
      setHasDescription,
    }),
    [name, error, hasDescription],
  );

  return (
    <FieldContext.Provider value={value}>
      <div
        data-slot="field"
        data-invalid={error ? "true" : undefined}
        className={cn("space-y-2", className)}
        {...props}
      >
        {children}
        <FieldError>{error}</FieldError>
      </div>
    </FieldContext.Provider>
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  const { id } = useFieldContext("FieldLabel");
  return <Label htmlFor={id} className={cn("gap-1", className)} {...props} />;
}

/**
 * Clones its single child with the ids and ARIA state. A clone rather than a
 * render prop so call sites read as plain markup:
 * `<FieldControl><Input name="email" /></FieldControl>`.
 */
function FieldControl({ children }: { children: React.ReactElement }) {
  const { id, descriptionId, errorId, invalid, hasDescription } =
    useFieldContext("FieldControl");

  const describedBy =
    [hasDescription ? descriptionId : null, invalid ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const childProps = children.props as Record<string, unknown>;

  return React.cloneElement(children, {
    id: (childProps.id as string | undefined) ?? id,
    name: (childProps.name as string | undefined) ?? id,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  } as Partial<typeof childProps>);
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { descriptionId, setHasDescription } = useFieldContext("FieldDescription");

  // Tells FieldControl to include this in aria-describedby. Effect rather than
  // render-time so we never write to context during another component's render.
  React.useEffect(() => {
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [setHasDescription]);

  return (
    <p
      id={descriptionId}
      data-slot="field-description"
      className={cn("text-xs leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Always mounted so the live region exists before the message does — a region
 * that appears at the same moment as its text is unreliably announced.
 */
function FieldError({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  const { errorId } = useFieldContext("FieldError");
  return (
    <p
      id={errorId}
      data-slot="field-error"
      aria-live="polite"
      className={cn(
        "text-xs font-medium text-destructive empty:hidden",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export { Field, FieldLabel, FieldControl, FieldDescription, FieldError };
