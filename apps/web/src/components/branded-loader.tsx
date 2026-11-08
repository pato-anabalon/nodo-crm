import type { LucideIcon } from "lucide-react";

/**
 * A full-pane "preparing X" screen: a spinning ring in the company's own
 * brand colour around a filled circle and icon, with a title and subtitle
 * underneath. Reusable wherever a page is worth more than a bare skeleton —
 * the first use is the quote detail view.
 */
export function BrandedLoader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="relative size-28 shrink-0">
        <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon className="size-7" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
