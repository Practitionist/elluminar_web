"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Labelled switch row. The label is clickable — the switch alone is a small target. */
export function PreferenceToggle({
  name,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  name: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={name} className="text-sm font-medium">
          {label}
        </Label>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        id={name}
        name={name}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}
