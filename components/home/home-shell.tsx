import Link from "next/link";
import { ArrowRight, CopyPlus, FolderUp, MonitorSmartphone } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: CopyPlus,
    title: "Instant shared text",
    description: "A single private note that stays in sync across every device in the room.",
  },
  {
    icon: FolderUp,
    title: "Drag files and folders",
    description: "Send screenshots, archives, and folders without turning your clipboard into a mess.",
  },
  {
    icon: MonitorSmartphone,
    title: "Built for handoff",
    description: "Open the same room on two laptops and move work across instantly.",
  },
];

export function HomeShell() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <CopyPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Drop</p>
            <p className="text-sm text-muted-foreground">Private cross-device transfer</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className={cn(buttonVariants({ variant: "ghost" }), "rounded-full px-5")}>
            Sign in
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants(), "rounded-full px-5")}>
            Create account
          </Link>
        </div>
      </header>

      <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-4 py-2 text-sm font-medium text-primary">
            One private room. Zero friction.
          </div>
          <div className="space-y-5">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
              Move text, files, folders, and screenshots between devices without the overhead.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Drop is a private shared workspace for your own devices and the people you trust.
              Open a room, paste, upload, and continue elsewhere.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}
            >
              Start your room
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/sign-in"
              className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "rounded-full px-6")}
            >
              Open existing room
            </Link>
          </div>
        </div>

        <div className="surface rounded-[2rem] p-5">
          <div className="rounded-[1.6rem] border border-white/50 bg-background/80 p-6 dark:border-white/10 dark:bg-background/70">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Room preview</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">Design Sprint</h2>
              </div>
              <div className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
                4F8M2K7Q
              </div>
            </div>
            <div className="space-y-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-[1.4rem] border border-border/70 bg-card/70 p-5 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <feature.icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
