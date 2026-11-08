import { ListCardSkeleton } from "@/components/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-20" />
        ))}
      </div>

      <ListCardSkeleton rows={5} />
    </div>
  );
}
