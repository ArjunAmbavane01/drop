import { Skeleton } from "@/components/ui/skeleton";

export default function RoomLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {/* Back button */}
            <Skeleton className="size-10 rounded-lg" />

            {/* Room name + code */}
            <Skeleton className="h-8 w-40 rounded-md" />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Theme button */}
            <Skeleton className="size-8 rounded-md" />

            {/* Clear room */}
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </header>

        {/* Tabs + actions */}
        <div className="mt-8 flex items-center justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-16 rounded-lg" />
            <Skeleton className="h-9 w-14 rounded-lg" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>

        {/* Text area */}
        <div className="mt-5">
          <Skeleton className="min-h-[calc(100vh-153px)] w-full rounded-xl" />
        </div>
      </div>
    </main>
  );
}