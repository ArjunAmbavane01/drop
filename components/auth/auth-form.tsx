"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");

    try {
      if (mode === "sign-up") {
        const { error } = await authClient.signUp.email({
          name,
          email,
          password,
        });

        if (error) {
          throw new Error(error.message ?? "Unable to create account.");
        }
      } else {
        const { error } = await authClient.signIn.email({
          email,
          password,
        });

        if (error) {
          throw new Error(error.message ?? "Unable to sign in.");
        }
      }

      toast.success(mode === "sign-up" ? "Account created." : "Welcome back.");
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="surface w-full max-w-md rounded-[2rem] p-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {mode === "sign-up" ? "Create your Drop account" : "Sign in to Drop"}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {mode === "sign-up"
            ? "Create a room, share the code, and keep your devices in sync."
            : "Open your room and continue where you left off."}
        </p>
      </div>
      <form action={handleSubmit} className="space-y-5">
        {mode === "sign-up" ? (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Arjun Patel"
              required
              className="h-12 rounded-2xl"
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="h-12 rounded-2xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            className="h-12 rounded-2xl"
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="h-12 w-full rounded-2xl text-sm font-medium"
        >
          {isPending
            ? "Working..."
            : mode === "sign-up"
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
