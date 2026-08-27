"use client";

import { Globe } from "lucide-react";
import * as React from "react";

import { TextField } from "@/components/auth";

/**
 * Timezone picker backed by a native `<datalist>`.
 *
 * The alternative was a 400-item Select with no search, or building a combobox
 * on cmdk. A datalist gives free type-ahead in every browser, degrades to a
 * plain text input where it isn't supported, and the value is validated
 * server-side against the runtime's own tz database by `timezoneSchema` — so a
 * browser that ignores the list entirely still cannot store nonsense.
 */
export function TimezoneField({
  defaultValue,
  error,
}: {
  defaultValue: string;
  error?: string;
}) {
  const zones = React.useMemo(() => {
    const supported =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [];
    // Keep the stored value selectable even if this runtime doesn't list it
    // (renamed zones, or an older engine).
    return supported.includes(defaultValue) ? supported : [defaultValue, ...supported];
  }, [defaultValue]);

  return (
    <>
      <TextField
        name="timezone"
        label="Timezone"
        error={error}
        icon={<Globe className="size-4" />}
        description="Used for cohort times, live session reminders and deadlines."
        inputProps={{
          required: true,
          defaultValue,
          list: "timezone-options",
          autoComplete: "off",
          spellCheck: false,
        }}
      />
      <datalist id="timezone-options">
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    </>
  );
}
