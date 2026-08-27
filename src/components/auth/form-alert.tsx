import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
} as const;

/**
 * Form-level message that stays on screen. Toasts remain right for *outcomes*
 * ("Verification email sent"), but a failed sign-in needs to persist next to
 * the form the user is about to correct — a toast has usually vanished by the
 * time they look back at the fields.
 *
 * `role="alert"` on errors so it is announced immediately; success and info are
 * polite, since they follow an action the user just took.
 */
export function FormAlert({
  tone = "error",
  title,
  children,
  className,
}: {
  tone?: keyof typeof ICONS;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <Alert
      variant={tone === "error" ? "destructive" : "default"}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(
        "rounded-xl",
        tone === "success" &&
          "border-success/30 bg-success-subtle text-success-subtle-foreground",
        tone === "info" && "border-info/30 bg-info-subtle text-info-subtle-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  );
}
