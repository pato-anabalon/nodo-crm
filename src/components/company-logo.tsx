import { cn } from "@/lib/utils";

/** The company's logo, falling back to initials when none has been uploaded. */
export function CompanyLogo({
  name,
  logoUrl,
  size = "md",
  className,
}: {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  // `xl` is 140px (35 × the 0.25rem spacing step), and only the customer's own
  // quote uses it: there the logo is the company introducing itself, not a chip
  // identifying which tenant the sidebar belongs to.
  const dimensions = {
    sm: "size-7",
    md: "size-9",
    lg: "size-14",
    xl: "size-35",
  }[size];
  const text = { sm: "text-xs", md: "text-sm", lg: "text-lg", xl: "text-4xl" }[
    size
  ];

  if (logoUrl) {
    return (
      // Served from the blob store, or from whatever host a company pointed at
      // before uploads existed — so the host isn't known ahead of time.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={cn(dimensions, "rounded-md object-contain", className)}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        dimensions,
        text,
        "flex items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
