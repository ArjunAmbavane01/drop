import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <AuthForm mode="sign-in" />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link href="/sign-up" className="font-medium text-foreground">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
