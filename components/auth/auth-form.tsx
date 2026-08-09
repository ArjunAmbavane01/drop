"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";

import AnimatedInput from "@/components/ui/smoothui/animated-input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import {
  signInSchema,
  signUpSchema,
  type SignInValues,
  type SignUpValues,
} from "@/lib/validators";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const schema = mode === "sign-up" ? signUpSchema : signInSchema;

  const form = useForm<SignInValues | SignUpValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        if (mode === "sign-up") {
          const { error } = await authClient.signUp.email(values as SignUpValues);
          if (error) {
            toast.error(error.message ?? "Unable to create account.");
            return;
          }
        } else {
          const { error } = await authClient.signIn.email(values as SignInValues);
          if (error) {
            toast.error(error.message ?? "Unable to sign in.");
            return;
          }
        }

        toast.success(
          mode === "sign-up"
            ? "Account created successfully."
            : "Signed in successfully."
        );

        router.push("/");
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  });

  return (
    <div className="flex flex-col items-center w-full space-y-12 rounded-2xl py-8">
      <div className="text-center space-y-5">
        <h1 className="text-3xl font-medium tracking-tight">
          {mode === "sign-up"
            ? "Create your Drop account"
            : "Sign in to Drop"}
        </h1>

        <p className="text-muted-foreground text-balance">
          {mode === "sign-up"
            ? "Create a room, share the code, and keep your devices in sync."
            : "Open your room and continue where you left off."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 w-xs">
        {mode === "sign-up" && (
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <div>
                <AnimatedInput
                  {...field}
                  icon={<User className="size-4 text-gray-400" />}
                  label="Name"
                  placeholder="Arjun Patel"
                />
                {fieldState.error && (
                  <p className="mt-1 text-sm text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />
        )}

        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <div>
              <AnimatedInput
                {...field}
                type="email"
                icon={<Mail className="size-4 text-gray-400" />}
                label="Email"
                placeholder="you@example.com"
              />
              {fieldState.error && (
                <p className="mt-1 text-sm text-destructive">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />

        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <div>
              <AnimatedInput
                {...field}
                type="password"
                icon={<Lock className="size-4 text-gray-400" />}
                label="Password"
                placeholder="Enter your password"
              />
              {fieldState.error && (
                <p className="mt-1 text-sm text-destructive">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />

        <Button
          className="flex items-center w-full"
          disabled={isPending}
          type="submit"
        >
          {isPending ? (
            <>
              <Spinner />
              {mode === "sign-up"
                ? "Creating account..."
                : "Signing in..."}
            </>
          ) : mode === "sign-up" ? (
            "Create account"
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </div>
  );
}