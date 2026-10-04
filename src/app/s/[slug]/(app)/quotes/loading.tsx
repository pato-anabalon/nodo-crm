import { FiltersSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function QuotesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="flex gap-4 border-b pb-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-4 w-16" />
        ))}
      </div>

      <FiltersSkeleton />
      <TableSkeleton columns={7} />
    </div>
  );
}
