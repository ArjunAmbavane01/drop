import { Skeleton } from "@/components/ui/skeleton";
import BrandTextLogo from "@/components/ui/brand-text-logo";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background w-full">
      <div className="flex flex-col mx-auto max-w-3xl w-full p-3 sm:py-8 sm:px-5">
        {/* Header with App Branding */}
        <header className="flex items-center justify-between">
          <BrandTextLogo />
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </header>

        {/* Action Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-16 mb-10">
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
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28 rounded-md" />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>

          {/* Joined Rooms skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 rounded-md" />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
