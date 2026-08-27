import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Decorative by default — pending state is announced by the button's own
 * `aria-busy`/label change, so a second announcement here would be noise.
 * Pass a `label` when the spinner is the only thing on screen.
 */
function Spinner({
  className,
  label,
  ...props
}: React.ComponentProps<"svg"> & { label?: string }) {
  return (
    <>
      <Loader2
        data-slot="spinner"
        aria-hidden="true"
        className={cn("size-4 shrink-0 animate-spin", className)}
        {...props}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}

export { Spinner };
