import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Verify a certificate" };

async function verifyAction(formData: FormData) {
  "use server";
  const code = String(formData.get("code") || "").trim().toUpperCase();
  redirect(`/verify/${encodeURIComponent(code)}`);
}

export default function VerifyIndexPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center px-4">
      <Card>
        <CardHeader>
          <CardTitle>Verify a credential</CardTitle>
          <CardDescription>
            Every lms-web certificate carries a unique verification code. Enter
            it to confirm authenticity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={verifyAction} className="flex gap-2">
            <Input name="code" placeholder="XXXX-XXXX-XXXX" required className="uppercase" />
            <Button type="submit">Verify</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
