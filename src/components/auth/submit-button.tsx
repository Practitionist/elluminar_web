"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * The pending-state affordance the auth forms were missing. Previously every
 * page hand-rolled `const [loading, setLoading] = useState(false)` and swapped
 * the label text — which reads as a normal button to assistive tech and gives
 * no visual signal that anything is in flight.
 *
 * `aria-busy` is what announces the state; `pendingLabel` is for sighted users.
 */
export function SubmitButton({
  pending,
  children,
  pendingLabel,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  pending: boolean;
  pendingLabel?: string;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      aria-busy={pending || undefined}
      disabled={pending || props.disabled}
      className={cn("w-full rounded-full", className)}
      {...props}
    >
      {pending ? (
        <>
          <Spinner className="size-4" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
