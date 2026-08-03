import { Skeleton } from "@/components/ui/skeleton";

export default function RoomLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="space-y-6">
        <Skeleton className="h-28 rounded-[2rem]" />
        <Skeleton className="h-72 rounded-[2rem]" />
        <Skeleton className="h-[28rem] rounded-[2rem]" />
      </div>
    </main>
  );
}
