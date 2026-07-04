import Link from "next/link";

import { BRAND } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gradient-mesh flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link
        href="/"
        className="text-gradient mb-8 text-2xl font-extrabold tracking-tight"
      >
        {BRAND.name}
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 max-w-sm text-center text-xs text-muted-foreground">
        Courses, live cohorts, and mentor-reviewed projects — buy exactly what
        you need.
      </p>
    </div>
  );
}
