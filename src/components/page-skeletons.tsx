import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * The title, subtitle and (optional) primary action every list page opens
 * with. Shared because four pages open with exactly this, and a fifth
 * written by hand is how they'd drift.
 */
export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      {withAction ? <Skeleton className="h-9 w-28" /> : null}
    </div>
  );
}

/** The search box and the select every list page's filter bar carries. */
export function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

/**
 * The table itself, shaped like what replaces it so nothing jumps once the
 * real rows land — same reasoning as the reports panels.
 */
export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }, (_, col) => (
              <TableHead key={col}>
                <Skeleton className="h-3 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row}>
              {Array.from({ length: columns }, (_, col) => (
                <TableCell key={col}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

/** A row of card tiles, for the dashboard's metrics and settings' groups. */
export function CardRowSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: cards }, (_, index) => (
        <Card key={index}>
          <CardContent className="space-y-2 pt-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** A single card with a few lines, for pages built around one panel rather than a table. */
export function ListCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
