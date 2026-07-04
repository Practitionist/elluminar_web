"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <Button
      onClick={() => window.print()}
      variant="outline"
      className="rounded-full print:hidden"
    >
      <Printer className="size-4" /> {label}
    </Button>
  );
}
