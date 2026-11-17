import { FiltersSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/page-skeletons";

export default function ContactsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FiltersSkeleton />
      <TableSkeleton columns={5} />
    </div>
  );
}
