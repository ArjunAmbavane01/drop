import { FolderOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background w-full">
      <div className="flex flex-col mx-auto max-w-3xl w-full p-3 sm:py-8 sm:px-5">
        {/* Header with App Branding */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 sm:size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FolderOpen className="size-4 sm:size-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Drop</h1>
          </div>

          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </header>

        {/* Action Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-3 mt-16 mb-10">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-44 rounded-md" />
            <Skeleton className="h-4 w-60 rounded-md" />
          </div>
          <div className="flex flex-col sm:flex-row shrink gap-2.5">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="space-y-16">
          {/* My Rooms skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-3">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-4 w-10 rounded-md" />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>

          {/* Joined Rooms skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-3">
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-4 w-10 rounded-md" />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
