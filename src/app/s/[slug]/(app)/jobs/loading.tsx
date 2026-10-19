import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/page-skeletons";

/** Shaped like the page — the job tiles and the recent activity beside them — so nothing jumps. */
export default function JobsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ul className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="flex h-32 flex-col gap-2 rounded-xl border bg-card p-4">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <div className="mt-auto flex -space-x-1.5">
                {Array.from({ length: 3 }, (_, avatar) => (
                  <Skeleton key={avatar} className="size-6 rounded-full border-2 border-card" />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <Card className="h-fit">
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-36" />
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex gap-2.5">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
