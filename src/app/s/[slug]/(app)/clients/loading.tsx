import { FiltersSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/page-skeletons";

export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FiltersSkeleton />
      <TableSkeleton columns={6} />
    </div>
  );
}
