import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <AuthForm mode="sign-up" />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-foreground">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
