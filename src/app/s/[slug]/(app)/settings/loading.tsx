import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Four groups of cards, same shape as the real index. */}
      {[3, 3, 2, 1].map((count, group) => (
        <div key={group} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }, (_, index) => (
              <Card key={index}>
                <CardContent className="space-y-2 pt-6">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
