import { cn } from "@/lib/utils";

import { Pill, type PillTone } from "./pill";

export function SectionEyebrow({
  tone = "primary",
  icon,
  className,
  children,
}: {
  tone?: PillTone;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Pill tone={tone} className={cn("uppercase tracking-wide", className)}>
      {icon}
      {children}
    </Pill>
  );
}

/**
 * Editorial section heading in the Newsreader serif display face.
 * Pass a plain string, or JSX with a highlighted `<span>` for the accent word.
 */
export function SectionHeading({
  as: Tag = "h2",
  className,
  children,
}: {
  as?: "h1" | "h2" | "h3";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.1]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
