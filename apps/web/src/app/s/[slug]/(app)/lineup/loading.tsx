import { Skeleton } from "@/components/ui/skeleton";

/** Where each placeholder bar starts and how far it runs, as a share of the window. */
const BARS = [
  [4, 30],
  [18, 45],
  [0, 22],
  [35, 40],
  [52, 28],
  [10, 60],
  [66, 26],
  [28, 34],
] as const;

const WEEKS = 12;

/** Shaped like the timeline — names on the left, a bar per job across the weeks — so nothing jumps. */
export default function LineupLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Skeleton className="size-9" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="size-9" />
          <Skeleton className="ml-2 h-4 w-32" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-[minmax(8rem,14rem)_1fr]">
          <div className="border-b border-r" />
          <div className="flex h-12 flex-col justify-between border-b px-1 py-1.5">
            <Skeleton className="h-3 w-28" />
            <div className="flex">
              {Array.from({ length: WEEKS }, (_, week) => (
                <div key={week} className="flex-1">
                  <Skeleton className="h-2.5 w-8 max-w-[80%]" />
                </div>
              ))}
            </div>
          </div>

          {BARS.map(([start, length], row) => (
            <div key={row} className="contents">
              <div className="flex h-11 items-center border-b border-r px-3">
                <Skeleton className="h-4 w-4/5" />
              </div>
              <div className="relative h-11 border-b">
                <Skeleton
                  className="absolute inset-y-2 rounded-md"
                  style={{ left: `${start}%`, width: `${length}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
