import { CardRowSkeleton, FiltersSkeleton, PageHeaderSkeleton } from "@/components/page-skeletons";

export default function JobsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FiltersSkeleton />
      <CardRowSkeleton cards={6} />
    </div>
  );
}
