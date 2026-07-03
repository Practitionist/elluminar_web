import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <Link href="/" className="mb-8 text-2xl font-semibold tracking-tight">
        lms-web
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 max-w-sm text-center text-xs text-muted-foreground">
        Courses, live cohorts, and mentor-reviewed projects — buy exactly what
        you need.
      </p>
    </div>
  );
}
