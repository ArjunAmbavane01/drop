import { Skeleton } from "@/components/ui/skeleton";

export default function RoomLoading() {
  return (
    <main className="min-h-screen bg-background flex flex-col justify-stretch">
      <div className="mx-auto flex w-full max-w-3xl flex-col flex-1 px-4 py-6 sm:px-6 lg:py-8 justify-start">
        {/* Header skeleton */}
        <header className="flex items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-6 w-36 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </header>

        {/* Tab switchers skeleton */}
        <div className="flex flex-col flex-1 mt-4">
          <div className="flex items-center gap-6 pb-3">
            <Skeleton className="h-4 w-10 rounded" />
            <Skeleton className="h-4 w-10 rounded" />
          </div>

          {/* Surface panel skeleton */}
          <div className="flex-1 flex flex-col justify-stretch pt-2 min-h-0">
            <div className="flex items-center justify-end gap-2 px-0.5 mb-3">
              <Skeleton className="h-7 w-16 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
            <Skeleton className="flex-1 rounded-xl min-h-[420px] md:min-h-[500px]" />
          </div>
        </div>
      </div>
    </main>
  );
}
