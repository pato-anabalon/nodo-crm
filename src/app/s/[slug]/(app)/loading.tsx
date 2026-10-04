import { CardRowSkeleton, ListCardSkeleton } from "@/components/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      <CardRowSkeleton />

      {/* Funnel and latest quotes: same row, same height. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCardSkeleton rows={7} />
        <ListCardSkeleton rows={5} />
      </div>

      {/* Last sent and last accepted: same row, same height. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCardSkeleton rows={5} />
        <ListCardSkeleton rows={5} />
      </div>
    </div>
  );
}
